import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../types/dashboard';
import { getDashboardDateRange, getNextCourseDates, summarizeDashboard } from './dashboardMetrics';

const data: DashboardData = {
  studentCities: [],
  linkedTeacher: null,
  courses: [
    {
      id: 10,
      teacherId: 1,
      subjectId: 20,
      weekday: 0,
      startsAt: '09:00',
      endsAt: '11:00',
      startsOn: '2026-10-05',
      endsOn: '2026-11-30',
      roomName: 'A1',
    },
    {
      id: 11,
      teacherId: 2,
      subjectId: 21,
      weekday: 1,
      startsAt: '10:00',
      endsAt: '12:00',
      startsOn: '2026-10-05',
      endsOn: '2026-11-30',
      roomName: null,
    },
  ],
  subjects: [
    { id: 20, name: 'Français', domain: 'Langues' },
    { id: 21, name: 'Anglais', domain: 'Langues' },
  ],
  teachers: [
    { id: 1, name: 'Nezha' },
    { id: 2, name: 'Reda' },
  ],
  studentIds: [100, 101, 102],
  enrollments: [
    { courseId: 10, studentId: 100, createdAt: '2026-10-06T10:00:00Z' },
    { courseId: 10, studentId: 101, createdAt: '2026-10-06T10:00:00Z' },
    { courseId: 11, studentId: 101, createdAt: '2026-10-06T10:00:00Z' },
  ],
  presences: [
    { courseId: 10, date: '2026-10-05', status: 'present' },
    { courseId: 10, date: '2026-10-12', status: 'absent' },
    { courseId: 11, date: '2026-10-06', status: 'retard' },
  ],
  requests: [
    { status: 'en_attente', createdAt: null },
    { status: 'approuvee', createdAt: null },
  ],
  formationCount: 3,
  groupCount: 2,
  popularFormations: [],
  closedDates: [],
  cancelledOccurrences: [],
};

describe('dashboard date ranges', () => {
  it('uses calendar boundaries for week, month and year presets', () => {
    const now = new Date(2026, 9, 16, 12);
    expect(getDashboardDateRange('w', now)).toEqual({ from: '2026-10-12', to: '2026-10-17' });
    expect(getDashboardDateRange('m', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(getDashboardDateRange('y', now)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('summarizeDashboard', () => {
  it('excludes closed dates, cancelled occurrences and Sundays while filtering course counts', () => {
    const result = summarizeDashboard(
      data,
      { from: '2026-10-05', to: '2026-10-12' },
      { teacherId: '', courseId: '' },
      new Set(['2026-10-06']),
      new Set(['10|2026-10-12']),
    );

    expect(result.occurrences.map(({ id, date }) => `${id}|${date}`)).toEqual(['10|2026-10-05']);
    expect(result.teacherCount).toBe(1);
  });

  it('filters attendance and student totals to selected course occurrences', () => {
    const result = summarizeDashboard(
      data,
      { from: '2026-10-05', to: '2026-10-12' },
      { teacherId: '', courseId: '10' },
    );

    expect(result.studentCount).toBe(2);
    expect(result.attendanceCount).toBe(2);
    expect(result.attendanceRate).toBe(50);
  });

  it('counts every non-absent status as present and preserves request statuses', () => {
    const result = summarizeDashboard(
      data,
      { from: '2026-10-05', to: '2026-10-12' },
      { teacherId: '', courseId: '' },
    );

    expect(result.attendanceRate).toBeCloseTo(66.67, 1);
    expect(result.requestCounts).toEqual({ pending: 1, approved: 1, refused: 0 });
    expect(result.domainDistribution).toEqual([{ domain: 'Langues', count: 3 }]);
  });

  it('aggregates subject attendance once per course instead of once per weekly occurrence', () => {
    const result = summarizeDashboard(
      data,
      { from: '2026-10-05', to: '2026-10-12' },
      { teacherId: '', courseId: '' },
    );

    expect(result.popularSubjects).toEqual([
      { subject: 'Français', teacher: 'Nezha', studentCount: 2, presentCount: 1 },
      { subject: 'Anglais', teacher: 'Reda', studentCount: 1, presentCount: 1 },
    ]);
  });

  it('returns the next five course dates respecting start and end dates', () => {
    const next = getNextCourseDates(data.courses, new Date('2026-10-05T08:00:00'));

    expect(
      next.map(({ course, date }) => `${course.id}|${date.toISOString().slice(0, 10)}`),
    ).toEqual(['10|2026-10-05', '11|2026-10-06']);
  });
});
