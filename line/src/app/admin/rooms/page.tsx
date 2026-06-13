'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { AdminPageLayout } from '@/components/admin/AdminPageLayout';
import { Room } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminRoomsPage() {
  const router = useRouter();
  const { getRooms, getMemberCounts, deleteRoom } = useAdmin();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    getRooms().then(async (data) => {
      setRooms(data);
      if (data.length) {
        const counts = await getMemberCounts(data.map((r) => r.id));
        setMemberCounts(counts);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (roomId: string) => {
    setDeleting(roomId);
    await deleteRoom(roomId);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setDeleting(null);
    setConfirmDelete(null);
  };

  const confirmRoom = rooms.find((r) => r.id === confirmDelete);

  return (
    <AdminPageLayout>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">{rooms.length}件</p>
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-lg flex-shrink-0">
                  #
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{room.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">メンバー: {memberCounts[room.id] ?? 0}人</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    最終更新: {formatDate(room.last_message_at ?? room.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => router.push(`/admin/rooms/${room.id}/messages`)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-100"
                >
                  メッセージを見る
                </button>
                <button
                  onClick={() => setConfirmDelete(room.id)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-500 border border-red-100"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">ルームを削除</h2>
            <p className="text-gray-500 text-sm mb-1">
              <span className="font-medium text-gray-700">「{confirmRoom?.name}」</span> を削除します。
            </p>
            <p className="text-gray-400 text-xs mb-6">すべてのメッセージも削除されます。この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
