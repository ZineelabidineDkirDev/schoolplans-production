import { describe, expect, it } from 'vitest';
import { calculateAllFormationProgress, calculateFormationProgress } from './planningProgress';
import type { PlanningData } from '../../types/planning';

const data: PlanningData = {
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
      startsOn: '2026-10-05',
      endsOn: '2026-10-26',
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
        totalHours: 12,
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
  completedOccurrences: new Set(['1|2026-10-05', '1|2026-10-12']),
};

describe('formation progress', () => {
  it('calculates an entry for every formation, including formations without scheduled courses', () => {
    const result = calculateAllFormationProgress({
      ...data,
      filters: {
        ...data.filters,
        formations: [
          ...data.filters.formations,
          {
            id: 9,
            name: 'Bureautique',
            totalHours: 20,
            duration: null,
            hoursPerWeek: null,
            description: null,
            active: true,
          },
        ],
      },
    });

    expect(result).toHaveLength(2);
    expect(
      result.map(({ formation, progress }) => [formation.name, progress.plannedHours]),
    ).toEqual([
      ['Français', 12],
      ['Bureautique', 20],
    ]);
  });

  it('uses configured total hours and counts completed, non-cancelled, non-closed occurrences', () => {
    const result = calculateFormationProgress(
      {
        ...data,
        closedDates: { '2026-10-19': 'Fermé' },
        cancelledOccurrences: new Set(['1|2026-10-26']),
      },
      '2',
      new Date('2026-10-20T12:00:00'),
    );

    expect(result).toEqual({
      plannedHours: 12,
      completedHours: 4,
      remainingHours: 8,
      percentage: 33,
    });
  });

  it('falls back to scheduled hours when total hours are absent or non-numeric', () => {
    const withoutTotal = {
      ...data,
      filters: {
        ...data.filters,
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
      },
      completedOccurrences: new Set<string>(),
    };

    expect(
      calculateFormationProgress(withoutTotal, '2', new Date('2026-10-20T12:00:00')),
    ).toMatchObject({ plannedHours: 8, completedHours: 0, remainingHours: 8, percentage: 0 });
    expect(
      calculateFormationProgress(
        {
          ...withoutTotal,
          filters: {
            ...withoutTotal.filters,
            formations: [
              {
                id: 2,
                name: 'Français',
                totalHours: 'x',
                duration: null,
                hoursPerWeek: null,
                description: null,
                active: true,
              },
            ],
          },
        },
        '2',
        new Date('2026-10-20T12:00:00'),
      )?.plannedHours,
    ).toBe(8);
  });

  it('clamps group dates, caps percentage at 100 and never reports negative remaining time', () => {
    const result = calculateFormationProgress(
      {
        ...data,
        filters: {
          ...data.filters,
          formations: [
            {
              id: 2,
              name: 'Français',
              totalHours: 2,
              duration: null,
              hoursPerWeek: null,
              description: null,
              active: true,
            },
          ],
          groups: data.filters.groups.map((group) => ({
            ...group,
            startsOn: '2026-10-12',
            endsOn: '2026-10-12',
          })),
        },
      },
      '2',
      new Date('2026-10-20T12:00:00'),
    );

    expect(result).toEqual({
      plannedHours: 2,
      completedHours: 2,
      remainingHours: 0,
      percentage: 100,
    });
  });

  it('returns no progress for an unknown formation and ignores invalid or out-of-range courses', () => {
    expect(calculateFormationProgress(data, '99')).toBeNull();
    const result = calculateFormationProgress(
      {
        ...data,
        courses: [
          ...data.courses,
          { ...data.courses[0], id: 2, startsAt: 'bad', groupId: 5 },
          { ...data.courses[0], id: 3, groupId: null },
          { ...data.courses[0], id: 4, weekday: 6 },
        ],
        filters: {
          ...data.filters,
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
        },
      },
      '2',
      new Date('2026-10-20T12:00:00'),
    );
    expect(result?.plannedHours).toBe(8);
  });
});
