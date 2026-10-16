import type {
  DashboardCourse,
  DashboardData,
  DashboardDateRange,
  DashboardFilters,
  DashboardOccurrence,
  DashboardSummary,
} from '../../types/dashboard';
import type { StudentIdentifier } from '../../types/students';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function dateFromIso(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function isoDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function courseOccurrences(
  courses: DashboardCourse[],
  range: DashboardDateRange,
  filters: DashboardFilters,
  closedDates: Set<string>,
  cancelledOccurrences: Set<string>,
): DashboardOccurrence[] {
  const from = dateFromIso(range.from);
  const to = dateFromIso(range.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) return [];

  const occurrences: DashboardOccurrence[] = [];
  for (let date = from, days = 0; date <= to && days < 400; date = addDays(date, 1), days += 1) {
    const dateKey = isoDate(date);
    const weekday = (date.getDay() + 6) % 7;
    if (weekday > 5 || closedDates.has(dateKey)) continue;

    for (const course of courses) {
      if (course.weekday !== weekday) continue;
      if (course.startsOn && dateKey < course.startsOn) continue;
      if (course.endsOn && dateKey > course.endsOn) continue;
      if (filters.teacherId && String(course.teacherId) !== filters.teacherId) continue;
      if (filters.courseId && String(course.id) !== filters.courseId) continue;
      if (cancelledOccurrences.has(`${course.id}|${dateKey}`)) continue;
      occurrences.push({ ...course, date: dateKey });
    }
  }
  return occurrences;
}

function attendanceRate(
  presences: DashboardData['presences'],
  range: DashboardDateRange,
  courseIds: Set<string> | null,
): { count: number; rate: number | null } {
  const entries = presences.filter(
    (presence) =>
      presence.date >= range.from &&
      presence.date <= range.to &&
      (!courseIds || courseIds.has(String(presence.courseId))),
  );

  return {
    count: entries.length,
    rate: entries.length
      ? (entries.filter((presence) => presence.status !== 'absent').length / entries.length) * 100
      : null,
  };
}

function previousRange(range: DashboardDateRange): DashboardDateRange {
  const from = dateFromIso(range.from);
  const to = dateFromIso(range.to);
  const length = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const previousTo = addDays(from, -1);
  return { from: isoDate(addDays(previousTo, -length + 1)), to: isoDate(previousTo) };
}

export function summarizeDashboard(
  data: DashboardData,
  range: DashboardDateRange,
  filters: DashboardFilters,
  closedDates: Set<string> = new Set(),
  cancelledOccurrences: Set<string> = new Set(),
): DashboardSummary {
  const occurrences = courseOccurrences(
    data.courses,
    range,
    filters,
    closedDates,
    cancelledOccurrences,
  );
  const previous = previousRange(range);
  const previousOccurrences = courseOccurrences(
    data.courses,
    previous,
    filters,
    closedDates,
    cancelledOccurrences,
  );
  const selectedCourseIds = new Set(occurrences.map((course) => String(course.id)));
  const previousCourseIds = new Set(previousOccurrences.map((course) => String(course.id)));
  const isScoped = Boolean(filters.teacherId || filters.courseId);
  const selectedStudentIds = new Set(
    data.enrollments
      .filter((enrollment) => !isScoped || selectedCourseIds.has(String(enrollment.courseId)))
      .map((enrollment) => String(enrollment.studentId)),
  );
  const currentAttendance = attendanceRate(
    data.presences,
    range,
    isScoped ? selectedCourseIds : null,
  );
  const previousAttendance = attendanceRate(
    data.presences,
    previous,
    isScoped ? previousCourseIds : null,
  );
  const teachers = new Map(data.teachers.map((teacher) => [String(teacher.id), teacher.name]));
  const subjects = new Map(data.subjects.map((subject) => [String(subject.id), subject.name]));
  const subjectDomains = new Map(
    data.subjects.map((subject) => [String(subject.id), subject.domain]),
  );
  const domainCounts = new Map<string, number>();
  for (const course of occurrences) {
    const domain = course.subjectId === null ? null : subjectDomains.get(String(course.subjectId));
    if (domain) domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }
  const uniqueCourses = new Map(occurrences.map((course) => [String(course.id), course]));
  const popular = new Map<
    string,
    { subject: string; teacher: string; students: Set<string>; presentCount: number }
  >();

  for (const course of uniqueCourses.values()) {
    const key = `${course.subjectId ?? '?'}|${course.teacherId ?? '?'}`;
    const entry = popular.get(key) ?? {
      subject: subjects.get(String(course.subjectId)) ?? '?',
      teacher: teachers.get(String(course.teacherId)) ?? '',
      students: new Set<string>(),
      presentCount: 0,
    };
    for (const enrollment of data.enrollments) {
      if (String(enrollment.courseId) === String(course.id)) {
        entry.students.add(String(enrollment.studentId));
      }
    }
    entry.presentCount += data.presences.filter(
      (presence) =>
        String(presence.courseId) === String(course.id) &&
        presence.date >= range.from &&
        presence.date <= range.to &&
        presence.status !== 'absent',
    ).length;
    popular.set(key, entry);
  }

  return {
    occurrences,
    previousOccurrences,
    studentCount: isScoped ? selectedStudentIds.size : data.studentIds.length,
    teacherCount: new Set(occurrences.map((course) => String(course.teacherId))).size,
    attendanceRate: currentAttendance.rate,
    previousAttendanceRate: previousAttendance.rate,
    requestCounts: {
      pending: data.requests.filter((request) => request.status === 'en_attente').length,
      approved: data.requests.filter((request) => request.status === 'approuvee').length,
      refused: data.requests.filter((request) => request.status === 'refusee').length,
    },
    popularSubjects: [...popular.values()]
      .map((entry) => ({
        subject: entry.subject,
        teacher: entry.teacher,
        studentCount: entry.students.size,
        presentCount: entry.presentCount,
      }))
      .sort((left, right) => right.studentCount - left.studentCount)
      .slice(0, 5),
    domainDistribution: [...domainCounts]
      .map(([domain, count]) => ({ domain, count }))
      .sort((left, right) => right.count - left.count),
    attendanceCount: currentAttendance.count,
  };
}

export function getDashboardDateRange(preset: 'd' | 'w' | 'm' | 'y', now = new Date()) {
  const from = new Date(now);
  const to = new Date(now);

  if (preset === 'w') {
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 5);
  } else if (preset === 'm') {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === 'y') {
    from.setMonth(0, 1);
    to.setMonth(11, 31);
  }

  return { from: isoDate(from), to: isoDate(to) };
}

export function formatDashboardTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getDashboardWeekday(index: number): string {
  return DAY_LABELS[index] ?? '—';
}

export function getNextCourseDates(courses: DashboardCourse[], now = new Date()) {
  return courses
    .map((course) => {
      const date = new Date(now);
      const currentWeekday = (date.getDay() + 6) % 7;
      let delta = course.weekday - currentWeekday;
      if (delta < 0) delta += 7;
      date.setDate(date.getDate() + delta);

      if (course.startsOn && isoDate(date) < course.startsOn) {
        const firstDate = dateFromIso(course.startsOn);
        const offset = (course.weekday - ((firstDate.getDay() + 6) % 7) + 7) % 7;
        firstDate.setDate(firstDate.getDate() + offset);
        date.setTime(firstDate.getTime());
      }

      const [hours, minutes] = course.startsAt.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
      return { course, date };
    })
    .filter(({ course, date }) => date >= now && (!course.endsOn || isoDate(date) <= course.endsOn))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, 5);
}

export function uniqueStudentIds(values: StudentIdentifier[]): StudentIdentifier[] {
  return [...new Map(values.map((value) => [String(value), value])).values()];
}
