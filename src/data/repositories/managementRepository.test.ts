import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  getAttendanceSheet,
  getCentreAttendanceSummary,
  getCentreStudents,
  saveAttendance,
} from './managementRepository';

function createClient(dataByTable: Record<string, unknown[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const from = vi.fn((table: string) => {
    const query: Record<string, (...args: never[]) => unknown> = {};
    for (const method of ['select', 'order', 'in', 'limit', 'gte', 'lte']) {
      query[method] = (...args: never[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }
    query.eq = ((column: string, value: unknown) => {
      calls.push({ table, method: 'eq', args: [column, value] });
      filters.push({ table, column, value });
      return query;
    }) as (...args: never[]) => unknown;
    query.upsert = ((...args: unknown[]) => {
      calls.push({ table, method: 'upsert', args });
      return query;
    }) as (...args: never[]) => unknown;
    query.then = ((resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: dataByTable[table] ?? [], error: null }).then(resolve)) as (
      ...args: never[]
    ) => unknown;
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, calls, filters, from };
}

const studentRow = {
  id: 21,
  prenom: 'Amina',
  nom: 'Benali',
  email: 'amina@example.test',
  telephone: null,
  nom_parent: 'Karim Benali',
  email_parent: 'karim@example.test',
  telephone_parent: '+212600000000',
  ville_parent: 'Rabat',
  ville: 'Rabat',
  adresse: null,
  niveau_etudes: 'Supérieur',
  groupe_id: 4,
  created_at: '2026-10-30T12:00:00Z',
};

describe('management repository', () => {
  it('lists centre-scoped students with group and course summaries', async () => {
    const { client, filters } = createClient({
      etudiants: [studentRow],
      groupes: [{ id: 4, nom: 'Groupe A' }],
      inscriptions: [
        { etudiant_id: 21, cours_id: 1 },
        { etudiant_id: 21, cours_id: 2 },
      ],
    });

    await expect(getCentreStudents(client, 'centre-a')).resolves.toEqual([
      {
        id: 21,
        firstName: 'Amina',
        lastName: 'Benali',
        email: 'amina@example.test',
        telephone: null,
        guardianName: 'Karim Benali',
        guardianEmail: 'karim@example.test',
        parentTelephone: '+212600000000',
        guardianCity: 'Rabat',
        city: 'Rabat',
        address: null,
        educationLevel: 'Supérieur',
        createdAt: '2026-10-30T12:00:00Z',
        groupId: 4,
        groupName: 'Groupe A',
        courseCount: 2,
      },
    ]);
    expect(filters).toContainEqual({ table: 'etudiants', column: 'centre_id', value: 'centre-a' });
    expect(filters).toContainEqual({ table: 'groupes', column: 'centre_id', value: 'centre-a' });
    expect(filters).toContainEqual({
      table: 'inscriptions',
      column: 'centre_id',
      value: 'centre-a',
    });
  });

  it('calculates the overall attendance rate from recorded attendance statuses', async () => {
    const { client } = createClient({
      presences: [
        { statut: 'present' },
        { statut: 'retard' },
        { statut: 'absent' },
        { statut: 'present' },
      ],
    });

    await expect(getCentreAttendanceSummary(client, 'centre-a')).resolves.toEqual({
      rate: 75,
      recordedCount: 4,
    });
  });

  it('builds a dated attendance sheet only from enrolled centre students and matching session statuses', async () => {
    const { client, filters, calls } = createClient({
      etudiants: [studentRow, { ...studentRow, id: 22, prenom: 'Noor', groupe_id: null }],
      groupes: [{ id: 4, nom: 'Groupe A' }],
      inscriptions: [
        { etudiant_id: 21, cours_id: 8 },
        { etudiant_id: 21, cours_id: 8 },
      ],
      presences: [
        { cours_id: 8, etudiant_id: 21, date: '2026-10-16', statut: 'retard' },
        { cours_id: 8, etudiant_id: 21, date: '2026-10-17', statut: 'absent' },
      ],
    });

    await expect(getAttendanceSheet(client, 'centre-a', '2026-10-16', '2026-10-17', [
      { courseId: 8, date: '2026-10-16' },
      { courseId: 8, date: '2026-10-17' },
    ])).resolves.toEqual({
      courses: [
        {
          courseId: 8,
          date: '2026-10-16',
          students: [
            {
              student: expect.objectContaining({ id: 21, groupName: 'Groupe A' }),
              status: 'retard',
            },
          ],
        },
        {
          courseId: 8,
          date: '2026-10-17',
          students: [
            {
              student: expect.objectContaining({ id: 21, groupName: 'Groupe A' }),
              status: 'absent',
            },
          ],
        },
      ],
    });
    expect(calls).toContainEqual({ table: 'presences', method: 'gte', args: ['date', '2026-10-16'] });
    expect(calls).toContainEqual({ table: 'presences', method: 'lte', args: ['date', '2026-10-17'] });
    expect(filters).toContainEqual({
      table: 'inscriptions',
      column: 'centre_id',
      value: 'centre-a',
    });

  });

  it('rejects invalid date ranges before querying attendance', async () => {
    const { client, from } = createClient({});
    await expect(getAttendanceSheet(client, 'centre-a', '2026-10-18', '2026-10-17', [])).rejects.toThrow(
      'période des présences est invalide',
    );
    await expect(getAttendanceSheet(client, 'centre-a', '2026-02-31', '2026-03-01', [])).rejects.toThrow(
      'période des présences est invalide',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('upserts one attendance status with the observed conflict key and active centre', async () => {
    const { client, calls, from } = createClient({});
    await saveAttendance(client, 'centre-a', 8, 21, '2026-10-16', 'present');
    expect(calls).toContainEqual({
      table: 'presences',
      method: 'upsert',
      args: [
        {
          cours_id: 8,
          date: '2026-10-16',
          etudiant_id: 21,
          statut: 'present',
          centre_id: 'centre-a',
        },
        { onConflict: 'cours_id,date,etudiant_id' },
      ],
    });

    await expect(saveAttendance(client, 'centre-a', 8, 21, 'bad-date', 'absent')).rejects.toThrow(
      'date de présence est invalide',
    );
    expect(from).toHaveBeenCalledTimes(1);
  });
});
