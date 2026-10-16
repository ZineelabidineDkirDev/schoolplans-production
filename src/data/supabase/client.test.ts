import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from './client';

describe('readSupabaseConfig', () => {
  it('requires both public Supabase environment values', () => {
    expect(() => readSupabaseConfig({})).toThrow('Supabase configuration is missing.');
  });

  it('returns trimmed URL and anon key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ' https://example.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' public-anon-key ',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'public-anon-key',
    });
  });
});
