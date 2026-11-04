import { describe, expect, it } from 'vitest';
import type {
  CentreStudent,
  StudentCourse,
  StudentEnrollment,
  StudentSubject,
} from '../../types/students';
import { buildMyStudentList } from './studentList';

const students: CentreStudent[] = [
  {
    id: 1,
    firstName: 'Nezha',
    lastName: 'Alaoui',
    email: 'nezha@example.test',
    telephone: null,
    centreId: 'centre-a',
    groupId: 7,
    groupName: 'Groupe A',
    formationName: 'Français',
  },
  {
    id: 2,
    firstName: 'Reda',
    lastName: 'Bennani',
    email: null,
    telephone: '0600000000',
    centreId: 'centre-a',
    groupId: null,
    groupName: null,
    formationName: null,
  },
];

describe('buildMyStudentList', () => {
  it('preserves student order and derives enrolled course names', () => {
    const enrollments: StudentEnrollment[] = [
      { studentId: 1, courseId: 10 },
      { studentId: 2, courseId: 11 },
      { studentId: 1, courseId: 12 },
    ];
    const courses: StudentCourse[] = [
      { id: 10, subjectId: 20, group: null },
      { id: 11, subjectId: 21, group: null },
      { id: 12, subjectId: 22, group: null },
    ];
    const subjects: StudentSubject[] = [
      { id: 20, name: 'Français' },
      { id: 21, name: 'Anglais' },
    ];

    expect(buildMyStudentList(students, enrollments, courses, subjects)).toEqual([
      {
        student: students[0],
        courses: ['Français', '?'],
        groups: [{ id: 7, name: 'Groupe A', formationName: 'Français' }],
      },
      { student: students[1], courses: ['Anglais'], groups: [] },
    ]);
  });

  it('ignores enrollments for students or courses outside the loaded records', () => {
    const enrollments: StudentEnrollment[] = [
      { studentId: 1, courseId: 404 },
      { studentId: 404, courseId: 10 },
    ];
    const courses: StudentCourse[] = [{ id: 10, subjectId: null, group: null }];

    expect(buildMyStudentList(students, enrollments, courses, [])).toEqual([{
      student: students[0],
      courses: [],
      groups: [{ id: 7, name: 'Groupe A', formationName: 'Français' }],
    }]);
  });

  it('includes group students even when they have no course enrollment', () => {
    expect(buildMyStudentList(students, [], [], [])).toEqual([
      {
        student: students[0],
        courses: [],
        groups: [{ id: 7, name: 'Groupe A', formationName: 'Français' }],
      },
    ]);
  });

  it('omits students with neither a group nor an assigned course', () => {
    expect(buildMyStudentList([students[1]], [], [], [])).toEqual([]);
  });

  it('associates a student with the group of an enrolled teacher course', () => {
    expect(buildMyStudentList(
      [students[1]],
      [{ studentId: 2, courseId: 10 }],
      [{
        id: 10,
        subjectId: 20,
        group: { id: 8, name: 'Groupe B', formationName: 'Mathématiques' },
      }],
      [{ id: 20, name: 'Mathématiques' }],
    )).toEqual([{
      student: students[1],
      courses: ['Mathématiques'],
      groups: [{ id: 8, name: 'Groupe B', formationName: 'Mathématiques' }],
    }]);
  });

  it('does not duplicate a course when its enrollment row is repeated', () => {
    expect(buildMyStudentList(
      students,
      [{ studentId: 1, courseId: 10 }, { studentId: 1, courseId: 10 }],
      [{
        id: 10,
        subjectId: 20,
        group: { id: 8, name: 'Groupe B', formationName: 'Mathématiques' },
      }],
      [{ id: 20, name: 'Français' }],
    )).toEqual([{
      student: students[0],
      courses: ['Français'],
      groups: [
        { id: 7, name: 'Groupe A', formationName: 'Français' },
        { id: 8, name: 'Groupe B', formationName: 'Mathématiques' },
      ],
    }]);
  });
});
