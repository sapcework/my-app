import { LegalShell } from '@/components/ui/LegalShell';

export const metadata = { title: 'オープンソースライセンス' };

// 主要な依存ライブラリとライセンス。バージョンは package.json に準拠。
const LIBRARIES = [
  { name: 'Next.js', license: 'MIT', url: 'https://github.com/vercel/next.js' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Supabase JS (@supabase/supabase-js, @supabase/ssr)', license: 'MIT', url: 'https://github.com/supabase/supabase-js' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'web-push', license: 'MPL-2.0', url: 'https://github.com/web-push-libs/web-push' },
  { name: 'TypeScript', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript' },
];

export default function LicensesPage() {
  return (
    <LegalShell title="オープンソースライセンス">
      <p className="mb-4 text-gray-600">本アプリは以下のオープンソースソフトウェアを利用しています。各ソフトウェアの著作権は各権利者に帰属します。</p>
      <ul className="space-y-3">
        {LIBRARIES.map((lib) => (
          <li key={lib.name} className="border-b border-gray-100 pb-3">
            <p className="font-medium text-gray-800">{lib.name}</p>
            <p className="text-xs text-gray-500">ライセンス: {lib.license}</p>
            <a href={lib.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4CAF50] break-all">{lib.url}</a>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
