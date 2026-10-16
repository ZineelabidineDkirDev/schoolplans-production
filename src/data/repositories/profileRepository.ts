import type { SupabaseClient } from '@supabase/supabase-js';
import { SOURCE_ROLES, type AuthProfile, type SourceRole } from '../../types/auth';

function isSourceRole(value: unknown): value is SourceRole {
  return typeof value === 'string' && SOURCE_ROLES.includes(value as SourceRole);
}

export function parseAuthProfile(value: unknown, userId: string): AuthProfile {
  if (!value || typeof value !== 'object') {
    throw new Error(
      'Votre profil SchoolPlans est introuvable. Contactez l’administration du centre.',
    );
  }

  const row = value as Record<string, unknown>;
  if (!isSourceRole(row.role)) {
    throw new Error('Le rôle associé à votre profil est inconnu. Contactez l’administration.');
  }

  return {
    id: userId,
    fullName: typeof row.full_name === 'string' && row.full_name.trim() ? row.full_name.trim() : '',
    role: row.role,
    status: typeof row.statut === 'string' ? row.statut : null,
    centreId: typeof row.centre_id === 'string' ? row.centre_id : null,
  };
}

export async function getAuthProfile(client: SupabaseClient, userId: string): Promise<AuthProfile> {
  const { data, error } = await client
    .from('profiles')
    .select('full_name,role,statut,centre_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return parseAuthProfile(data, userId);
}
