import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  calculateGroupEndDate,
  createGroup,
  deleteFormation,
  saveFormation,
} from './formationGroupRepository';

function createClient(singleByTable: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const from = vi.fn((table: string) => {
    const query: Record<string, (...args: never[]) => unknown> = {};
    for (const method of ['select', 'eq', 'in', 'insert', 'update', 'delete', 'order']) {
      query[method] = ((...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      }) as (...args: never[]) => unknown;
    }
    query.maybeSingle = vi.fn(async () => ({ data: singleByTable[table] ?? null, error: null }));
    query.single = vi.fn(async () => ({ data: singleByTable[table] ?? { id: 44 }, error: null }));
    query.then = ((resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve)) as (...args: never[]) => unknown;
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe('formation and group repository', () => {
  it('calculates group end dates from the start day and formation duration', () => {
    expect(calculateGroupEndDate('2026-01-31', '1 mois')).toBe('2026-02-28');
    expect(calculateGroupEndDate('2024-02-29', '1 an')).toBe('2025-02-28');
    expect(() => calculateGroupEndDate('2026-02-30', '1 mois')).toThrow('date de début valide');
    expect(() => calculateGroupEndDate('2026-02-28', 'durée libre')).toThrow('Durée invalide');
  });

  it('saves formation fields in the active centre and associates selected modules', async () => {
    const { client, calls } = createClient({ formations: { id: 7 } });
    await saveFormation(client, 'centre-a', {
      name: 'Développement web',
      duration: '6 mois',
      hoursPerWeek: 5,
      description: ' Parcours pratique ',
      moduleIds: [2, 3],
    });

    expect(calls).toContainEqual({
      table: 'formations',
      method: 'insert',
      args: [
        {
          nom: 'Développement web',
          duree: '6 mois',
          heures_par_semaine: 5,
          description: 'Parcours pratique',
          actif: true,
          centre_id: 'centre-a',
        },
      ],
    });
    expect(calls).toContainEqual({
      table: 'formation_matieres',
      method: 'insert',
      args: [
        [
          { formation_id: 7, matiere_id: 2 },
          { formation_id: 7, matiere_id: 3 },
        ],
      ],
    });
  });

  it('rejects invalid formation hour limits before querying Supabase', async () => {
    const { client, from } = createClient();
    await expect(
      saveFormation(client, 'centre-a', {
        name: 'Français',
        duration: '',
        hoursPerWeek: 169,
        description: '',
        moduleIds: [],
      }),
    ).rejects.toThrow('entre 0,5 et 168');
    expect(from).not.toHaveBeenCalled();
  });

  it('creates groups with a duration-derived end date and active centre scope', async () => {
    const { client, calls } = createClient({ formations: { duree: '3 mois' } });
    await createGroup(client, 'centre-a', {
      name: 'Groupe A',
      formationId: 7,
      teacherId: 11,
      startsOn: '2026-10-31',
      capacity: 25,
    });

    expect(calls).toContainEqual({
      table: 'formations',
      method: 'eq',
      args: ['centre_id', 'centre-a'],
    });
    expect(calls).toContainEqual({
      table: 'groupes',
      method: 'insert',
      args: [
        {
          nom: 'Groupe A',
          formation_id: 7,
          formateur_id: 11,
          date_debut: '2026-10-31',
          date_fin: '2027-01-31',
          actif: true,
          capacite: 25,
          centre_id: 'centre-a',
        },
      ],
    });
  });

  it('scopes formation deletion to the centre', async () => {
    const { client, calls } = createClient();
    await deleteFormation(client, 'centre-a', 7);
    expect(calls).toContainEqual({
      table: 'formations',
      method: 'eq',
      args: ['id', 7],
    });
    expect(calls).toContainEqual({
      table: 'formations',
      method: 'eq',
      args: ['centre_id', 'centre-a'],
    });
  });
});
