import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContentPlan } from '@/lib/autopilot-engine';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — allow time for multiple clients

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/** Return the Monday of the next calendar week (UTC). */
function nextMondayUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  return monday;
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Cron job: auto-generate Autopilot content plans for qualifying clients.
 *
 * Runs every Sunday at 09:00 UTC (per vercel.json schedule "0 9 * * 0").
 * Processes clients where autopilot_enabled = true and auto_generate = true.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (matches pattern in check-trial-expiry route)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized autopilot cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const weekStart = nextMondayUTC();
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);

  logger.info('Autopilot cron: starting', { weekStart: weekStartStr, weekEnd: weekEndStr });

  // Fetch all clients with autopilot_enabled = true
  const { data: clients, error: clientsErr } = await supabaseAdmin
    .from('clients')
    .select('id, user_id, name, autopilot_enabled, autopilot_settings')
    .eq('autopilot_enabled', true);

  if (clientsErr) {
    logger.error('Autopilot cron: failed to fetch clients', clientsErr);
    return NextResponse.json({ error: clientsErr.message }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    logger.info('Autopilot cron: no autopilot-enabled clients found');
    return NextResponse.json({ success: true, generated: 0, failed: 0, errors: [] });
  }

  // Filter to clients with auto_generate enabled in autopilot_settings
  const today = new Date();
  const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(); // e.g. "sunday"

  const qualifying = clients.filter(client => {
    const settings = (client.autopilot_settings ?? {}) as Record<string, unknown>;

    // Must have auto_generate = true
    if (settings.auto_generate !== true && settings.auto_generate !== 'true') return false;

    // If a generation_day is set, only run on that day
    const generationDay = (settings.generation_day as string | undefined)?.toLowerCase();
    if (generationDay && generationDay !== todayDayName) return false;

    return true;
  });

  logger.info(`Autopilot cron: ${qualifying.length} qualifying client(s) of ${clients.length} total`);

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const client of qualifying) {
    try {
      // Check for an existing non-failed plan covering next week
      const { data: existingPlan } = await supabaseAdmin
        .from('autopilot_plans')
        .select('id, status')
        .eq('client_id', client.id)
        .neq('status', 'failed')
        .gte('plan_week_start', weekStartStr)
        .lte('plan_week_end', weekEndStr)
        .maybeSingle();

      if (existingPlan) {
        logger.info(`Autopilot cron: skipping ${client.name} — plan already exists (${existingPlan.id})`);
        continue;
      }

      logger.info(`Autopilot cron: generating plan for client ${client.name} (${client.id})`);

      await generateContentPlan(client.id, client.user_id, weekStart, weekEnd);

      logger.info(`Autopilot cron: plan generated for ${client.name}`);
      generated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Autopilot cron: failed for client ${client.name} (${client.id}):`, err);
      errors.push(`${client.name} (${client.id}): ${msg}`);
      failed++;
    }
  }

  const result = { success: true, generated, failed, errors };
  logger.info('Autopilot cron: completed', result);
  return NextResponse.json(result);
}
