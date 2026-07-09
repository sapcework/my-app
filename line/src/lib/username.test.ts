import { describe, it, expect } from 'vitest';
import { USERNAME_RE, normalizeUsername, usernameToEmail, identifierToEmail } from './username';

describe('normalizeUsername', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeUsername('  Taro  ')).toBe('taro');
  });
});

describe('usernameToEmail', () => {
  it('maps a username to the synthetic domain', () => {
    expect(usernameToEmail('taro')).toBe('taro@talk.local');
  });

  it('normalizes before mapping', () => {
    expect(usernameToEmail(' Taro ')).toBe('taro@talk.local');
  });
});

describe('identifierToEmail', () => {
  it('treats input containing @ as an existing email', () => {
    expect(identifierToEmail('User@Example.com')).toBe('user@example.com');
  });

  it('treats input without @ as a username', () => {
    expect(identifierToEmail('taro')).toBe('taro@talk.local');
  });
});

describe('USERNAME_RE', () => {
  it('accepts lowercase letters, digits, and underscore (3-20 chars)', () => {
    expect(USERNAME_RE.test('taro_123')).toBe(true);
  });

  it('rejects uppercase letters', () => {
    expect(USERNAME_RE.test('Taro')).toBe(false);
  });

  it('rejects strings shorter than 3 chars', () => {
    expect(USERNAME_RE.test('ab')).toBe(false);
  });

  it('rejects strings longer than 20 chars', () => {
    expect(USERNAME_RE.test('a'.repeat(21))).toBe(false);
  });
});
