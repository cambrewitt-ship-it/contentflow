'use client';

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportView } from '@/components/analytics/ReportView';
import type { ReportData } from '@/lib/analytics/reportTypes';

// A shared monthly report — no login; the link's token is the access.
export default function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reports/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.report) throw new Error(data.error || 'This report link is not valid.');
        setReport(data.report);
        document.title = `${data.report.clientName} · ${data.report.periodLabel} report`;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'This report link is not valid.'));
  }, [token]);

  return (
    <main className="min-h-screen bg-white">
      {error ? (
        <p className="p-12 text-center text-gray-600">{error}</p>
      ) : report ? (
        <ReportView report={report} />
      ) : (
        <p className="flex items-center justify-center gap-2 p-12 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading report…
        </p>
      )}
    </main>
  );
}
