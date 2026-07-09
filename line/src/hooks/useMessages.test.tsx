import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMessages } from './useMessages';

interface MockResult {
  data: unknown;
  error: unknown;
}

const state: {
  selectResult: MockResult;
  insertResult: MockResult;
  deleteResult: MockResult;
} = {
  selectResult: { data: [], error: null },
  insertResult: { data: null, error: null },
  deleteResult: { data: null, error: null },
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve(state.selectResult),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(state.insertResult),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve(state.deleteResult),
      }),
    }),
    channel: () => {
      const ch = {
        on: () => ch,
        subscribe: () => ch,
        send: () => Promise.resolve(),
      };
      return ch;
    },
    removeChannel: () => {},
  }),
}));

describe('useMessages', () => {
  beforeEach(() => {
    localStorage.clear();
    state.selectResult = { data: [], error: null };
    state.insertResult = { data: null, error: null };
    state.deleteResult = { data: null, error: null };
  });

  it('loads existing messages on mount', async () => {
    state.selectResult = {
      data: [{ id: 'm1', room_id: 'room1', sender_id: 'u1', content: 'hi', type: 'text', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    };

    const { result } = renderHook(() => useMessages('room1', 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('hi');
    expect(result.current.messages[0].status).toBe('sent');
  });

  it('shows an optimistic "sending" message that becomes "sent" once the insert succeeds', async () => {
    const { result } = renderHook(() => useMessages('room1', 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    state.insertResult = {
      data: { id: 'real-id', room_id: 'room1', sender_id: 'u1', content: 'hello', type: 'text', created_at: '2026-01-01T00:00:00Z' },
      error: null,
    };

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('hello');
    });
    // 楽観的更新：送信APIの応答を待たず即座に'sending'で表示される
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('sending');

    await act(async () => { await sendPromise; });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('sent');
    expect(result.current.messages[0].id).toBe('real-id');
  });

  it('marks the message as failed when the insert fails (so it can be retried)', async () => {
    const { result } = renderHook(() => useMessages('room1', 'u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    state.insertResult = { data: null, error: { message: 'boom' } };

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.messages[0].status).toBe('failed');
  });

  it('removes the message optimistically on delete', async () => {
    state.selectResult = {
      data: [{ id: 'm1', room_id: 'room1', sender_id: 'u1', content: 'hi', type: 'text', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    };

    const { result } = renderHook(() => useMessages('room1', 'u1'));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.deleteMessage('m1');
    });

    expect(result.current.messages).toHaveLength(0);
  });
});
