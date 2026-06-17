import { LegalShell } from '@/components/ui/LegalShell';
import { APP_INFO } from '@/lib/appInfo';

export const metadata = { title: 'プライバシーポリシー' };

// ⚠️ 雛形です。実際の取得情報・利用目的に合わせて整備してください。
export default function PrivacyPage() {
  return (
    <LegalShell title="プライバシーポリシー">
      <p className="text-xs text-gray-400 mb-4">最終更新日: {APP_INFO.copyrightYear}年</p>

      <h2 className="font-bold mb-1">取得する情報</h2>
      <p className="mb-4">{APP_INFO.name}は、アカウント登録情報（メールアドレス・表示名・アバター画像）、送受信したメッセージ、利用状況（オンライン状態・既読情報）、プッシュ通知の購読情報を取得します。</p>

      <h2 className="font-bold mb-1">利用目的</h2>
      <p className="mb-4">取得した情報は、チャット機能の提供、本人確認、通知配信、不正利用の防止、サービス改善の目的で利用します。</p>

      <h2 className="font-bold mb-1">第三者提供</h2>
      <p className="mb-4">法令に基づく場合を除き、利用者の同意なく個人情報を第三者へ提供しません。データはSupabase（インフラ事業者）上で管理されます。</p>

      <h2 className="font-bold mb-1">データの削除</h2>
      <p className="mb-4">アカウント削除の請求があった場合、関連データを削除します。お問い合わせ先までご連絡ください。</p>

      <p className="text-xs text-gray-400 mt-6">お問い合わせ: {APP_INFO.contactEmail}</p>
    </LegalShell>
  );
}
