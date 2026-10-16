import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function readSupabaseConfig(environment: SupabaseEnvironment) {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      'Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  return { url, anonKey };
}

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const { url, anonKey } = readSupabaseConfig(import.meta.env);
  client = createClient(url, anonKey);
  return client;
}
