import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { createNotification } from '@/lib/notifications';
import { generateReport, monthRange, previousMonth, ReportError } from '@/lib/analytics/reports';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron: at the start of each month, build last month's report for every connected
 * client and tell the account owner it's ready to review and send. Idempotent — clients
 * that already have the month's report are skipped — so the workflow runs it a few
 * times on the day to get through a large agency within the time limit.
 * Triggered by .github/workflows/cron-monthly-reports.yml.
 */

const TIME_BUDGET_MS = 240_000;
const CONCURRENCY = 3;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized monthly reports cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const month = previousMonth();
  const { start, label } = monthRange(month);
  const admin = createSupabaseAdmin();

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, name, user_id')
    .not('late_profile_id', 'is', null);
  if (error) {
    logger.error('Monthly reports: client query failed', error);
    return NextResponse.json({ error: 'Client query failed' }, { status: 500 });
  }

  const { data: done, error: doneError } = await admin.from('client_reports').select('client_id').eq('period_start', start);
  if (doneError) {
    logger.error('Monthly reports: report query failed (migration 035 run?)', doneError);
    return NextResponse.json({ error: 'Report query failed' }, { status: 500 });
  }
  const already = new Set((done ?? []).map((r) => r.client_id as string));
  const queue = (clients ?? []).filter((c) => !already.has(c.id));
  let built = 0;
  const skipped: string[] = [];

  const worker = async () => {
    while (queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const client = queue.shift()!;
      try {
        const report = await generateReport(admin, client.id, month, null);
        built++;
        if (client.user_id) {
          await createNotification({
            userId: client.user_id,
            clientId: client.id,
            type: 'monthly_report_ready',
            title: `${label} report ready for ${client.name}`,
            body: `${report.data.summary.headline} — review it and send the client their link.`,
            link: `/report/${report.shareToken}`,
          });
        }
      } catch (err) {
        // No posts / no analytics / not connected: nothing to report, not a failure
        skipped.push(`${client.name}: ${err instanceof ReportError ? err.message : String(err)}`);
        if (!(err instanceof ReportError)) logger.error('Monthly report failed', { clientId: client.id, err });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  logger.info('Monthly reports done', { month, built, skipped: skipped.length, remaining: queue.length });
  return NextResponse.json({ month, built, skipped, remaining: queue.length });
}
