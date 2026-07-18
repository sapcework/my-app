'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageLayout } from '@/components/admin/AdminPageLayout';
import { Report, ReportStatus } from '@/lib/types';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [opError, setOpError] = useState('');

  useEffect(() => {
    fetch('/api/admin/reports')
      .then(async (res) => {
        if (!res.ok) { setLoading(false); return; }
        const d = await res.json() as { reports: Report[] };
        setReports(d.reports);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStatus = async (reportId: string, status: ReportStatus) => {
    setUpdating(reportId);
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status }),
    });
    if (res.ok) {
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status } : r));
    } else {
      setOpError('更新に失敗しました');
      setTimeout(() => setOpError(''), 3000);
    }
    setUpdating(null);
  };

  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <AdminPageLayout>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">通報はありません</span>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {opError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{opError}</p>}
          <p className="text-xs text-gray-400">{reports.length}件（未対応 {openCount}件）</p>
          {reports.map((report) => (
            <div key={report.id} className={`bg-white rounded-xl shadow-sm p-4 ${report.status === 'resolved' ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${report.status === 'open' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  {report.status === 'open' ? '未対応' : '対応済み'}
                </span>
                <span className="text-xs text-gray-300">{formatDateTime(report.created_at)}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                <span className="font-medium text-gray-700">{report.reporter?.display_name ?? '不明'}</span> が
                <span className="font-medium text-red-500 mx-1">{report.reported_user?.display_name ?? '不明'}</span> を通報
              </p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 break-words mb-3">
                {report.message_content || '（本文なし）'}
              </p>
              <div className="flex gap-2">
                {report.room_id && (
                  <button
                    onClick={() => router.push(`/admin/rooms/${report.room_id}/messages`)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-100"
                  >
                    トークを見る
                  </button>
                )}
                <button
                  onClick={() => handleStatus(report.id, report.status === 'open' ? 'resolved' : 'open')}
                  disabled={updating === report.id}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 ${
                    report.status === 'open'
                      ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  {updating === report.id ? '...' : report.status === 'open' ? '対応済みにする' : '未対応に戻す'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPageLayout>
  );
}
