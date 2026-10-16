import { describe, expect, it } from 'vitest';
import {
  addDays,
  getMonday,
  getRoomAvailability,
  getWeekOccurrences,
  matchesPlanningFilters,
} from './planningSchedule';
import type { PlanningCourse } from '../../types/planning';

const course: PlanningCourse = {
  id: 7,
  subjectId: 3,
  teacherId: 11,
  roomId: 4,
  groupId: 5,
  weekday: 0,
  startsAt: '09:00',
  endsAt: '11:00',
  startsOn: '2026-10-01',
  endsOn: '2026-10-31',
  subjectName: 'Français',
  domainName: 'Langues',
  teacherName: 'Nadia Martin',
  roomName: 'Salle 2',
  groupName: 'Groupe A',
  formationId: 2,
};

describe('planning schedule', () => {
  it('starts weeks on Monday and adds days without changing the input date', () => {
    const sunday = new Date(2026, 9, 18, 15);

    expect(getMonday(sunday)).toEqual(new Date(2026, 9, 12, 12));
    expect(addDays(new Date(2026, 9, 12, 12), 5)).toEqual(new Date(2026, 9, 17, 12));
    expect(sunday.getDate()).toBe(18);
  });

  it('expands recurring courses and excludes out-of-range and closed dates', () => {
    const results = getWeekOccurrences(
      [
        course,
        {
          ...course,
          id: 8,
          weekday: 1,
          startsOn: '2026-10-20',
          endsOn: '2026-10-30',
        },
      ],
      new Date(2026, 9, 19),
      { '2026-10-19': 'Jour férié' },
      new Set(),
      new Set(),
    );

    expect(results.map((item) => item.id)).toEqual([8]);
    expect(results[0]).toMatchObject({
      date: '2026-10-20',
      startsAtMinutes: 540,
      endsAtMinutes: 660,
      cancelled: false,
      completed: false,
    });
  });

  it('retains cancelled occurrences and marks completed occurrences', () => {
    const results = getWeekOccurrences(
      [course],
      new Date(2026, 9, 12),
      {},
      new Set(['7|2026-10-12']),
      new Set(['7|2026-10-12']),
    );

    expect(results[0]).toMatchObject({ cancelled: true, completed: true });
  });

  it('applies formation, group, module, and teacher filters', () => {
    const groups = [
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
    ];

    expect(
      matchesPlanningFilters(
        course,
        groups,
        {
          formationId: '2',
          groupId: '5',
          subjectId: '3',
          teacherId: '11',
        },
        '2026-10-12',
      ),
    ).toBe(true);
    expect(
      matchesPlanningFilters(
        course,
        groups,
        {
          formationId: '9',
          groupId: '',
          subjectId: '',
          teacherId: '',
        },
        '2026-10-12',
      ),
    ).toBe(false);
    expect(
      matchesPlanningFilters(
        course,
        groups,
        { formationId: '', groupId: '', subjectId: '', teacherId: '' },
        '2026-11-02',
      ),
    ).toBe(false);
  });

  it('calculates room gaps over the legacy opening hours', () => {
    const occurrences = getWeekOccurrences(
      [course],
      new Date(2026, 9, 12),
      {},
      new Set(),
      new Set(),
    );

    expect(getRoomAvailability(occurrences, '4', 0)).toEqual(['08:00–09:00', '11:00–19:00']);
  });
});
