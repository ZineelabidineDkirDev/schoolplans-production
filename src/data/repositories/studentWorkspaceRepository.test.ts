import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getStudentWorkspace } from './studentWorkspaceRepository';

describe('student workspace repository', () => {
  it('requires centre and signed-in email before querying student records', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(getStudentWorkspace(client, '', 'student@example.test')).rejects.toThrow(
      'n’est pas rattaché',
    );
    await expect(getStudentWorkspace(client, 'centre-a', '')).rejects.toThrow(
      'adresse e-mail vérifiable',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('looks up only the matching student email inside the active centre', async () => {
    const calls: Array<[string, unknown]> = [];
    const query: Record<string, (...args: never[]) => unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = ((...args: unknown[]) => {
      calls.push(args as [string, unknown]);
      return query;
    }) as (...args: never[]) => unknown;
    query.ilike = ((...args: unknown[]) => {
      calls.push(args as [string, unknown]);
      return query;
    }) as (...args: never[]) => unknown;
    query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(getStudentWorkspace(client, 'centre-a', 'student@example.test')).resolves.toEqual({
      studentFound: false,
      courses: [],
      attendance: [],
      realizedSessions: [],
      formation: null,
    });
    expect(calls).toEqual([
      ['centre_id', 'centre-a'],
      ['email', 'student@example.test'],
    ]);
  });
});
