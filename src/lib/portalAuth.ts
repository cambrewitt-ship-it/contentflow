/**
 * Portal token resolution helper.
 *
 * Supports two token types:
 *  1. clients.portal_token  — legacy, no party identity
 *  2. portal_parties.portal_token — new multi-party tokens
 *
 * Always returns { clientId, party } where party may be null for legacy tokens.
 */
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

export interface ResolvedPortalToken {
  clientId: string;
  party: {
    id: string;
    name: string;
    role: string;
    color: string | null;
  } | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function resolvePortalToken(
  token: string
): Promise<ResolvedPortalToken | null> {
  if (!token) return null;

  // Try party token first — gracefully skip if portal_parties table doesn't exist yet
  try {
    const { data: party, error: partyError } = await supabase
      .from('portal_parties')
      .select('id, name, role, color, client_id')
      .eq('portal_token', token)
      .maybeSingle();

    if (!partyError && party) {
      logger.debug('Resolved portal party token', {
        partyId: party.id.substring(0, 8) + '...',
        role: party.role,
      });
      return {
        clientId: party.client_id,
        party: {
          id: party.id,
          name: party.name,
          role: party.role,
          color: party.color,
        },
      };
    }
  } catch (e) {
    logger.debug('portal_parties table not available, falling back to client token lookup');
  }

  // Fall back to client token
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('portal_token', token)
    .maybeSingle();

  if (!clientError && client) {
    logger.debug('Resolved legacy client portal token', {
      clientId: client.id.substring(0, 8) + '...',
    });
    return { clientId: client.id, party: null };
  }

  logger.warn('Invalid portal token presented', {
    tokenPreview: token.substring(0, 8) + '...',
  });
  return null;
}
