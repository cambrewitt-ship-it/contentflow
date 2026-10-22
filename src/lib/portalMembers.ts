/**
 * Individual portal profiles (server only).
 *
 * A portal link identifies a client (and optionally a party). A portal *member*
 * is the person using it: they verify their email once per device with a
 * 6-digit code, and we keep them signed in with an httpOnly cookie scoped to
 * that client. Comments, replies and @mentions are attributed to the member.
 */
import { createHash, randomBytes, randomInt } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export const LOGIN_CODE_TTL_MINUTES = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
const SESSION_TTL_DAYS = 90;

// Palette for member avatars — assigned round-robin per client.
const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

export interface PortalMember {
  id: string;
  client_id: string;
  party_id: string | null;
  email: string;
  name: string;
  color: string | null;
  email_notifications: boolean;
}

const MEMBER_COLUMNS = 'id, client_id, party_id, email, name, color, email_notifications';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashLoginCode(code: string, clientId: string, email: string): string {
  return sha256(`${clientId}:${normalizeEmail(email)}:${code}`);
}

export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Cookie per client so one browser can be signed in to several clients' portals. */
export function memberCookieName(clientId: string): string {
  return `cm_portal_member_${clientId.replace(/-/g, '')}`;
}

export async function findMemberByEmail(clientId: string, email: string): Promise<PortalMember | null> {
  const { data } = await supabase
    .from('portal_members')
    .select(MEMBER_COLUMNS)
    .eq('client_id', clientId)
    // Emails are always stored normalised, so an exact match is enough
    .eq('email', normalizeEmail(email))
    .maybeSingle();
  return (data as PortalMember | null) ?? null;
}

/** Create the member, or update their name/party if they already exist. */
export async function upsertMember(params: {
  clientId: string;
  partyId: string | null;
  email: string;
  name: string;
}): Promise<PortalMember | null> {
  const email = normalizeEmail(params.email);
  const name = params.name.trim();
  const existing = await findMemberByEmail(params.clientId, email);

  if (existing) {
    const { data, error } = await supabase
      .from('portal_members')
      .update({
        name,
        party_id: params.partyId ?? existing.party_id,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select(MEMBER_COLUMNS)
      .single();
    if (error) {
      logger.error('Failed to update portal member:', error);
      return null;
    }
    return data as PortalMember;
  }

  const { count } = await supabase
    .from('portal_members')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', params.clientId);

  const { data, error } = await supabase
    .from('portal_members')
    .insert({
      client_id: params.clientId,
      party_id: params.partyId,
      email,
      name,
      color: MEMBER_COLORS[(count ?? 0) % MEMBER_COLORS.length],
    })
    .select(MEMBER_COLUMNS)
    .single();

  if (error) {
    logger.error('Failed to create portal member:', error);
    return null;
  }
  return data as PortalMember;
}

/** Start a device session and set its cookie on the response. */
export async function startMemberSession(member: PortalMember, response: NextResponse): Promise<boolean> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('portal_member_sessions').insert({
    member_id: member.id,
    token_hash: sha256(token),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    logger.error('Failed to create portal member session:', error);
    return false;
  }

  response.cookies.set(memberCookieName(member.client_id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return true;
}

/** The signed-in member for this client, or null. */
export async function getPortalMember(
  request: NextRequest,
  clientId: string
): Promise<PortalMember | null> {
  const token = request.cookies.get(memberCookieName(clientId))?.value;
  if (!token) return null;

  const { data: session } = await supabase
    .from('portal_member_sessions')
    .select(`id, expires_at, member:member_id (${MEMBER_COLUMNS})`)
    .eq('token_hash', sha256(token))
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('portal_member_sessions').delete().eq('id', session.id);
    return null;
  }

  const member = (Array.isArray(session.member) ? session.member[0] : session.member) as PortalMember | null;
  if (!member || member.client_id !== clientId) return null;
  return member;
}

/** Delete the current device session and clear its cookie. */
export async function endMemberSession(
  request: NextRequest,
  clientId: string,
  response: NextResponse
): Promise<void> {
  const name = memberCookieName(clientId);
  const token = request.cookies.get(name)?.value;
  if (token) {
    await supabase.from('portal_member_sessions').delete().eq('token_hash', sha256(token));
  }
  response.cookies.set(name, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function toPublicMember(member: PortalMember) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    color: member.color,
    party_id: member.party_id,
    email_notifications: member.email_notifications,
  };
}
