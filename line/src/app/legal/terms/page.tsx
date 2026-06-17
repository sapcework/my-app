import { LegalShell } from '@/components/ui/LegalShell';
import { APP_INFO } from '@/lib/appInfo';

export const metadata = { title: '利用規約' };

// ⚠️ 雛形です。実際の運用に合わせて条文を整備してください。
export default function TermsPage() {
  return (
    <LegalShell title="利用規約">
      <p className="text-xs text-gray-400 mb-4">最終更新日: {APP_INFO.copyrightYear}年</p>

      <h2 className="font-bold mb-1">第1条（適用）</h2>
      <p className="mb-4">本規約は、{APP_INFO.name}（以下「本サービス」）の利用に関する条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。</p>

      <h2 className="font-bold mb-1">第2条（禁止事項）</h2>
      <p className="mb-4">利用者は、法令または公序良俗に違反する行為、他の利用者・第三者の権利を侵害する行為、本サービスの運営を妨害する行為を行ってはなりません。</p>

      <h2 className="font-bold mb-1">第3条（免責）</h2>
      <p className="mb-4">本サービスは現状有姿で提供され、特定目的への適合性等を保証しません。利用者間のトラブルについて運営者は責任を負いません。</p>

      <h2 className="font-bold mb-1">第4条（規約の変更）</h2>
      <p className="mb-4">運営者は必要に応じて本規約を変更できるものとします。変更後の規約は本サービス上に表示した時点で効力を生じます。</p>

      <p className="text-xs text-gray-400 mt-6">お問い合わせ: {APP_INFO.contactEmail}</p>
    </LegalShell>
  );
}
