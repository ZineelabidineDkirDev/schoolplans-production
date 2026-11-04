import { describe, expect, it } from 'vitest';
import {
  getGroupSubjectIds,
  getQualifiedTeacherIds,
  validatePlanningCourse,
} from './planningRules';
import type { PlanningCourseInput, PlanningData } from '../../types/planning';

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
    teachers: [{ id: 11, name: 'Nadia Martin', email: null, telephone: null, createdAt: null, profileId: null }],
    rooms: [{ id: 4, name: 'Salle 2', type: 'Standard', capacity: 30 }],
  },
  subjectIdsByFormation: { '2': [3] },
  subjectIdsByTeacher: { '11': [3] },
  closedDates: {},
  cancelledOccurrences: new Set(),
  completedOccurrences: new Set(),
};

const actor = { role: 'admin' as const, teacherId: null, centreId: 'centre-a' };
const input: PlanningCourseInput = {
  groupId: 5,
  subjectId: 3,
  date: '2026-10-19',
  startsAt: '12:00',
  endsAt: '14:00',
  roomId: 4,
  teacherId: 11,
  recurring: true,
};

describe('planning business rules', () => {
  it('limits group modules to the formation and assigned trainer skills', () => {
    expect(getGroupSubjectIds(data, data.filters.groups[0])).toEqual([3]);
    expect(getGroupSubjectIds(
      {
        ...data,
        subjectIdsByFormation: { '2': [3, 8] },
        subjectIdsByTeacher: { '11': [8] },
      },
      data.filters.groups[0],
    )).toEqual([8]);
    expect(getQualifiedTeacherIds(data, data.filters.groups[0], 3)).toEqual([11]);
    expect(getQualifiedTeacherIds(data, data.filters.groups[0], 8)).toEqual([]);
    expect(getQualifiedTeacherIds(
      {
        ...data,
        subjectIdsByFormation: { '2': [3, 8] },
        subjectIdsByTeacher: { '11': [8] },
      },
      data.filters.groups[0],
      8,
    )).toEqual([11]);
    expect(getGroupSubjectIds(
      { ...data, subjectIdsByTeacher: {} },
      data.filters.groups[0],
    )).toEqual([3]);
    expect(getQualifiedTeacherIds(
      { ...data, subjectIdsByTeacher: {} },
      data.filters.groups[0],
      3,
    )).toEqual([11]);
  });

  it('validates course date, group dates, training subject and period', () => {
    expect(validatePlanningCourse(input, data, actor)).toMatchObject({
      teacherId: 11,
      roomId: 4,
      startsOn: '2026-10-19',
      endsOn: '2026-10-31',
    });

    expect(() => validatePlanningCourse({ ...input, date: '2026-11-02' }, data, actor)).toThrow(
      'la formation se termine',
    );
    expect(() => validatePlanningCourse({ ...input, subjectId: 99 }, data, actor)).toThrow(
      'ne fait pas partie de la formation',
    );
  });

  it('validates the custom end date against the start and group dates', () => {
    expect(() =>
      validatePlanningCourse({ ...input, endsOn: '2026-10-18' }, data, actor),
    ).toThrow('postérieure ou égale');
    expect(() =>
      validatePlanningCourse({ ...input, endsOn: '2026-11-01' }, data, actor),
    ).toThrow('ne peut pas dépasser la fin du groupe');
    expect(validatePlanningCourse({ ...input, endsOn: '2026-10-30' }, data, actor).endsOn)
      .toBe('2026-10-30');
  });

  it('rejects Sundays, invalid time intervals and times outside opening hours', () => {
    expect(() => validatePlanningCourse({ ...input, date: '2026-10-18' }, data, actor)).toThrow(
      'fermé le dimanche',
    );
    expect(() =>
      validatePlanningCourse({ ...input, startsAt: '13:00', endsAt: '12:00' }, data, actor),
    ).toThrow("après l'heure de début");
    expect(() => validatePlanningCourse({ ...input, startsAt: '07:00' }, data, actor)).toThrow(
      'entre 08:00 et 19:00',
    );
    expect(() =>
      validatePlanningCourse(
        input,
        { ...data, closedDates: { '2026-10-19': 'Fermeture exceptionnelle' } },
        actor,
      ),
    ).toThrow('centre est fermé');
  });

  it('rejects recurring room and trainer conflicts across overlapping date ranges', () => {
    expect(() =>
      validatePlanningCourse({ ...input, startsAt: '10:00', endsAt: '12:00' }, data, actor),
    ).toThrow('Conflit');
  });

  it('auto-selects an available room and uses the group trainer', () => {
    const result = validatePlanningCourse(
      { ...input, roomId: null, teacherId: null },
      {
        ...data,
        courses: [],
      },
      actor,
    );
    expect(result).toMatchObject({ roomId: 4, teacherId: 11 });
  });

  it('enforces the assigned group trainer for trainer accounts', () => {
    expect(() =>
      validatePlanningCourse(input, data, {
        role: 'formateur',
        teacherId: '12',
        centreId: 'centre-a',
      }),
    ).toThrow('groupe d’un autre formateur');
    expect(
      validatePlanningCourse(input, { ...data, subjectIdsByTeacher: {} }, {
        role: 'formateur',
        teacherId: '11',
        centreId: 'centre-a',
      }),
    ).toMatchObject({ teacherId: 11 });
  });

  it('rejects a selected trainer who is not associated with the course module', () => {
    const unassignedGroup = { ...data.filters.groups[0], teacherId: null };
    const unassignedGroupData = {
      ...data,
      filters: {
        ...data.filters,
        groups: [unassignedGroup],
        teachers: [
          ...data.filters.teachers,
          { id: 12, name: 'Omar', email: null, telephone: null, createdAt: null, profileId: null },
        ],
      },
    };
    expect(() => validatePlanningCourse(
      { ...input, teacherId: 12 },
      unassignedGroupData,
      actor,
    )).toThrow('n’est pas associé à ce module');
  });
});
