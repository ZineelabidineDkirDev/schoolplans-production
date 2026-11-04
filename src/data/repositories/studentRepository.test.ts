import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getMyCentreStudents, parseCentreStudentRows } from './studentRepository';

describe('student repository contract', () => {
  it('maps the RPC fields and preserves nullable contact details', () => {
    expect(
      parseCentreStudentRows(
        [
          {
            id: 12,
            prenom: 'Nezha',
            nom: 'Alaoui',
            email: null,
            telephone: '0600000000',
            ville: 'Rabat',
            centre_id: 'centre-a',
            groupe_id: '7',
            groupe_nom: 'Groupe A',
            formation_nom: 'Français',
          },
        ],
        'centre-a',
      ),
    ).toEqual([
      {
        id: 12,
        firstName: 'Nezha',
        lastName: 'Alaoui',
        email: null,
        telephone: '0600000000',
        centreId: 'centre-a',
        groupId: '7',
        groupName: 'Groupe A',
        formationName: 'Français',
      },
    ]);
  });

  it('rejects students returned for another centre', () => {
    expect(() =>
      parseCentreStudentRows(
        [
          {
            id: 12,
            prenom: 'Nezha',
            nom: 'Alaoui',
            centre_id: 'centre-b',
          },
        ],
        'centre-a',
      ),
    ).toThrow('hors du centre actif');
  });

  it('requires a centre before issuing any Supabase query', async () => {
    const rpc = vi.fn();
    const from = vi.fn();
    const client = { rpc, from } as unknown as SupabaseClient;

    await expect(getMyCentreStudents(client, '', 'profile-a')).rejects.toThrow('n’est rattaché à aucun centre');
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('lists only students enrolled in courses assigned to the connected teacher', async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const rowsByTable: Record<string, unknown[]> = {
      formateurs: [{ id: 5 }],
      cours: [{ id: 10, matiere_id: 20, groupe_id: 8 }, { id: 11, matiere_id: 21, groupe_id: null }],
      inscriptions: [{ etudiant_id: 12, cours_id: 10 }],
      matieres: [{ id: 20, nom: 'Mathématiques' }, { id: 21, nom: 'Français' }],
      groupes: [{ id: 8, nom: 'Groupe B', formation_id: 30 }],
      formations: [{ id: 30, nom: 'Formation B' }],
    };
    const queryFor = (table: string) => {
      const query: Record<string, (...args: never[]) => unknown> = {};
      for (const method of ['select', 'eq', 'in', 'order']) {
        query[method] = (...args: never[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      query.maybeSingle = (() => Promise.resolve({ data: rowsByTable[table]?.[0] ?? null, error: null })) as
        (...args: never[]) => unknown;
      query.then = ((resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(resolve)) as
        (...args: never[]) => unknown;
      return query;
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: 12,
        prenom: 'Nezha',
        nom: 'Alaoui',
        email: null,
        telephone: null,
        centre_id: 'centre-a',
        groupe_id: '7',
        groupe_nom: 'Groupe A',
        formation_nom: 'Français',
      }],
      error: null,
    });
    const client = {
      from: vi.fn((table: string) => queryFor(table)),
      rpc,
    } as unknown as SupabaseClient;

    await expect(getMyCentreStudents(client, 'centre-a', 'profile-a')).resolves.toEqual([
      {
        student: {
          id: 12,
          firstName: 'Nezha',
          lastName: 'Alaoui',
          email: null,
          telephone: null,
          centreId: 'centre-a',
          groupId: '7',
          groupName: 'Groupe A',
          formationName: 'Français',
        },
        courses: ['Mathématiques'],
        groups: [
          { id: '7', name: 'Groupe A', formationName: 'Français' },
          { id: 8, name: 'Groupe B', formationName: 'Formation B' },
        ],
      },
    ]);
    expect(calls).toContainEqual({ table: 'cours', method: 'eq', args: ['formateur_id', 5] });
    expect(calls).toContainEqual({ table: 'inscriptions', method: 'in', args: ['cours_id', [10, 11]] });
  });
});
