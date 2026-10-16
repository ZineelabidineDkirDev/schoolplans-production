import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  deletePlanningClosure,
  getPlanningData,
  savePlanningClosure,
  savePlanningCourse,
} from './planningRepository';
import type { PlanningData } from '../../types/planning';

const writablePlanningData: PlanningData = {
  courses: [
    {
      id: 1,
      subjectId: 3,
      teacherId: 11,
      roomId: 4,
      groupId: 5,
      weekday: 0,
      startsAt: '09:00',
      endsAt: '11:00',
      startsOn: '2026-10-12',
      endsOn: '2026-10-31',
      subjectName: 'Français',
      domainName: 'Langues',
      teacherName: 'Nadia Martin',
      roomName: 'Salle 2',
      groupName: 'Groupe A',
      formationId: 2,
    },
  ],
  filters: {
    formations: [
      {
        id: 2,
        name: 'Français',
        totalHours: null,
        duration: null,
        hoursPerWeek: null,
        description: null,
        active: true,
      },
    ],
    groups: [
      {
        id: 5,
        name: 'Groupe A',
        formationId: 2,
        formationName: 'Français',
        teacherId: 11,
        capacity: 30,
        active: true,
        startsOn: '2026-10-01',
        endsOn: '2026-10-31',
      },
    ],
    subjects: [{ id: 3, name: 'Français', domainName: 'Langues' }],
    teachers: [{ id: 11, name: 'Nadia Martin', email: null, profileId: null }],
    rooms: [{ id: 4, name: 'Salle 2', type: 'Standard', capacity: 30 }],
  },
  subjectIdsByFormation: { '2': [3] },
  subjectIdsByTeacher: { '11': [3] },
  closedDates: {},
  cancelledOccurrences: new Set(),
  completedOccurrences: new Set(),
};

function createMutationClient() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  let tableName = '';
  const query: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'upsert', 'in']) {
    query[method] = (...args: unknown[]) => {
      calls.push({ table: tableName, method, args });
      return query;
    };
  }
  query.maybeSingle = async () => ({ data: { id: 1 }, error: null });
  query.then = (...args: unknown[]) => {
    const resolve = args[0];
    return typeof resolve === 'function'
      ? Promise.resolve({ data: null, error: null }).then(
          resolve as (value: { data: null; error: null }) => unknown,
        )
      : Promise.resolve({ data: null, error: null });
  };
  const from = vi.fn((table: string) => {
    tableName = table;
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

function createEmptyClient() {
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const selections: Array<{ table: string; columns: string }> = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn((columns: string) => {
        selections.push({ table, columns });
        return query;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value });
        return query;
      }),
      order: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      insert: vi.fn(() => query),
      update: vi.fn(() => query),
      delete: vi.fn(() => query),
      upsert: vi.fn(() => query),
      in: vi.fn(() => query),
      then: (resolve: (value: { data: never[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return query;
  });

  return {
    client: { from } as unknown as SupabaseClient,
    filters,
    selections,
    from,
  };
}

describe('planning repository scope', () => {
  it('requires an active centre before issuing Supabase requests', async () => {
    const { client, from } = createEmptyClient();

    await expect(getPlanningData(client, '', 'profile-a', 'admin')).rejects.toThrow(
      'n’est rattaché à aucun centre',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('scopes tenant-owned resources to the selected centre', async () => {
    const { client, filters, selections } = createEmptyClient();

    await getPlanningData(client, 'centre-a', 'profile-a', 'admin');

    expect(selections).toContainEqual({
      table: 'formations',
      columns: 'id,nom,duree,heures_par_semaine,heures_totales,description,actif',
    });
    for (const table of [
      'cours',
      'formateurs',
      'salles',
      'groupes',
      'formations',
      'annulations',
      'fermetures',
      'seances_realisees',
    ]) {
      expect(filters).toContainEqual({ table, column: 'centre_id', value: 'centre-a' });
    }
  });

  it('restricts a formateur query to the linked teacher identity', async () => {
    const filters: Array<{ table: string; column: string; value: unknown }> = [];
    const from = vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ table, column, value });
          return query;
        }),
        order: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: { id: 'teacher-a' }, error: null })),
        then: (resolve: (value: { data: never[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    });
    const client = { from } as unknown as SupabaseClient;

    await getPlanningData(client, 'centre-a', 'profile-a', 'formateur');

    expect(filters).toContainEqual({
      table: 'formateurs',
      column: 'profile_id',
      value: 'profile-a',
    });
    expect(filters).toContainEqual({
      table: 'cours',
      column: 'centre_id',
      value: 'centre-a',
    });
    expect(filters).toContainEqual({
      table: 'cours',
      column: 'formateur_id',
      value: 'teacher-a',
    });
    expect(filters).toContainEqual({
      table: 'formateurs',
      column: 'id',
      value: 'teacher-a',
    });
  });

  it('writes validated courses only with the active centre and expected legacy columns', async () => {
    const { client, calls } = createMutationClient();

    await savePlanningCourse(
      client,
      writablePlanningData,
      { role: 'admin', teacherId: null, centreId: 'centre-a' },
      {
        groupId: 5,
        subjectId: 3,
        date: '2026-10-19',
        startsAt: '12:00',
        endsAt: '14:00',
        roomId: 4,
        teacherId: 11,
        recurring: true,
      },
    );

    expect(calls).toContainEqual({
      table: 'cours',
      method: 'insert',
      args: [
        {
          matiere_id: 3,
          formateur_id: 11,
          salle_id: 4,
          groupe_id: 5,
          jour: 0,
          debut: '12:00',
          fin: '14:00',
          valable_du: '2026-10-19',
          valable_au: '2026-10-31',
          centre_id: 'centre-a',
        },
      ],
    });
  });

  it('upserts a closure with the active centre and defaults an empty label', async () => {
    const { client, calls } = createMutationClient();

    await savePlanningClosure(
      client,
      { role: 'admin', teacherId: null, centreId: 'centre-a' },
      '2026-11-01',
      '  ',
    );

    expect(calls).toContainEqual({
      table: 'fermetures',
      method: 'upsert',
      args: [
        { date: '2026-11-01', libelle: 'Fermé', centre_id: 'centre-a' },
        { onConflict: 'centre_id,date' },
      ],
    });
  });

  it('deletes only a closure belonging to the active centre', async () => {
    const { client, calls } = createMutationClient();

    await deletePlanningClosure(
      client,
      { role: 'director', teacherId: null, centreId: 'centre-a' },
      '2026-11-01',
    );

    expect(calls).toContainEqual({
      table: 'fermetures',
      method: 'delete',
      args: [],
    });
    expect(calls).toContainEqual({
      table: 'fermetures',
      method: 'eq',
      args: ['date', '2026-11-01'],
    });
    expect(calls).toContainEqual({
      table: 'fermetures',
      method: 'eq',
      args: ['centre_id', 'centre-a'],
    });
  });

  it('rejects closure writes without an authorized centre and valid input', async () => {
    const { client, calls } = createMutationClient();

    await expect(
      savePlanningClosure(
        client,
        { role: 'super_admin', teacherId: null, centreId: 'centre-a' },
        '2026-11-01',
        'Jour férié',
      ),
    ).rejects.toThrow('réservée à l’administration');
    await expect(
      savePlanningClosure(
        client,
        { role: 'admin', teacherId: null, centreId: 'centre-a' },
        '2026-02-30',
        'Jour férié',
      ),
    ).rejects.toThrow('date de fermeture est invalide');
    await expect(
      deletePlanningClosure(
        client,
        { role: 'admin', teacherId: null, centreId: null },
        '2026-11-01',
      ),
    ).rejects.toThrow('rattaché à un centre');
    expect(calls.some((call) => ['delete', 'upsert'].includes(call.method))).toBe(false);
  });

  it('rejects invalid input before making a Supabase write', async () => {
    const { client, calls } = createMutationClient();

    await expect(
      savePlanningCourse(
        client,
        writablePlanningData,
        { role: 'admin', teacherId: null, centreId: 'centre-a' },
        {
          groupId: 5,
          subjectId: 3,
          date: '2026-10-18',
          startsAt: '12:00',
          endsAt: '14:00',
          roomId: 4,
          teacherId: 11,
          recurring: true,
        },
      ),
    ).rejects.toThrow('fermé le dimanche');
    expect(
      calls.some((call) => ['insert', 'update', 'delete', 'upsert'].includes(call.method)),
    ).toBe(false);
  });
});
