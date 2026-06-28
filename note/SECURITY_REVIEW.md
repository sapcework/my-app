# Security Review Checklist

## 機密情報

確認

- API Key
- Secret
- JWT
- Session
- Password
- OAuth Secret

確認事項

- Gitへ含まれていない
- ログへ出力されない
- Browserへ露出しない

---

## Supabase

確認

- RLS
- Policy
- auth.uid()
- JWT
- Session
- Role

禁止

- Service RoleをFrontendで使用

---

## Tauri

確認

- invoke
- File System
- Shell
- Plugin
- Path Traversal
- Command Injection

---

## IndexedDB

確認

- Token保存
- Password保存
- 個人情報

必要なら暗号化を提案

---

## Next.js

確認

- SSR
- API Route
- CSP
- Cookie

---

## TypeScript

確認

- any
- unknown
- strict mode

---

## XSS

確認

- dangerouslySetInnerHTML
- Markdown
- HTML

---

## SQL Injection

確認

- Query生成
- RPC
- Filter

---

## 認可

確認

- RBAC
- 所有者
- Admin

---

## 出力形式

Critical
High
Medium
Low

で分類してください。