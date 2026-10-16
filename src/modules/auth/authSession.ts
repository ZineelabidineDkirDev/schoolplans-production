import type { Session } from '@supabase/supabase-js';

export function hasPasswordAuthMethod(session: Pick<Session, 'access_token'>): boolean {
  try {
    const payload = session.access_token.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const claims: unknown = JSON.parse(decoded);
    if (!claims || typeof claims !== 'object') return false;
    const methods = (claims as { amr?: unknown }).amr;
    return (
      Array.isArray(methods) &&
      methods.some(
        (method) =>
          method &&
          typeof method === 'object' &&
          (method as { method?: unknown }).method === 'password',
      )
    );
  } catch {
    return false;
  }
}
