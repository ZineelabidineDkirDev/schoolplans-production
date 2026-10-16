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
  },
  {
    id: 2,
    firstName: 'Reda',
    lastName: 'Bennani',
    email: null,
    telephone: '0600000000',
    centreId: 'centre-a',
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
      { id: 10, subjectId: 20 },
      { id: 11, subjectId: 21 },
      { id: 12, subjectId: 22 },
    ];
    const subjects: StudentSubject[] = [
      { id: 20, name: 'Français' },
      { id: 21, name: 'Anglais' },
    ];

    expect(buildMyStudentList(students, enrollments, courses, subjects)).toEqual([
      { student: students[0], courses: ['Français', '?'] },
      { student: students[1], courses: ['Anglais'] },
    ]);
  });

  it('ignores enrollments for students or courses outside the loaded records', () => {
    const enrollments: StudentEnrollment[] = [
      { studentId: 1, courseId: 404 },
      { studentId: 404, courseId: 10 },
    ];
    const courses: StudentCourse[] = [{ id: 10, subjectId: null }];

    expect(buildMyStudentList(students, enrollments, courses, [])).toEqual([
      { student: students[0], courses: [] },
      { student: students[1], courses: [] },
    ]);
  });

  it('returns every student with no courses when the centre has no enrollments', () => {
    expect(buildMyStudentList(students, [], [], [])).toEqual([
      { student: students[0], courses: [] },
      { student: students[1], courses: [] },
    ]);
  });
});
