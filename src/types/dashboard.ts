import type { StudentIdentifier } from './students';

export type DashboardCourse = {
  id: StudentIdentifier;
  teacherId: StudentIdentifier | null;
  subjectId: StudentIdentifier | null;
  weekday: number;
  startsAt: string;
  endsAt: string;
  startsOn: string | null;
  endsOn: string | null;
  roomName: string | null;
};

export type DashboardSubject = {
  id: StudentIdentifier;
  name: string;
  domain: string | null;
};

export type DashboardPopularFormation = {
  name: string;
  studentCount: number;
};

export type DashboardTeacher = {
  id: StudentIdentifier;
  name: string;
};

export type DashboardEnrollment = {
  courseId: StudentIdentifier;
  studentId: StudentIdentifier;
  createdAt: string | null;
};

export type DashboardStudentCity = {
  city: string;
  studentCount: number;
};

export type DashboardPresence = {
  courseId: StudentIdentifier;
  date: string;
  status: string;
};

export type DashboardRegistrationRequest = {
  status: string;
  createdAt: string | null;
};

export type DashboardData = {
  linkedTeacher: DashboardTeacher | null;
  courses: DashboardCourse[];
  subjects: DashboardSubject[];
  teachers: DashboardTeacher[];
  studentIds: StudentIdentifier[];
  enrollments: DashboardEnrollment[];
  studentCities: DashboardStudentCity[];
  presences: DashboardPresence[];
  requests: DashboardRegistrationRequest[];
  formationCount: number | null;
  groupCount: number | null;
  popularFormations: DashboardPopularFormation[];
  closedDates: string[];
  cancelledOccurrences: string[];
};

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type DashboardFilters = {
  teacherId: string;
  courseId: string;
};

export type DashboardOccurrence = DashboardCourse & {
  date: string;
};

export type DashboardSummary = {
  occurrences: DashboardOccurrence[];
  previousOccurrences: DashboardOccurrence[];
  studentCount: number;
  teacherCount: number;
  attendanceRate: number | null;
  previousAttendanceRate: number | null;
  requestCounts: {
    pending: number;
    approved: number;
    refused: number;
  };
  popularSubjects: Array<{
    subject: string;
    teacher: string;
    studentCount: number;
    presentCount: number;
  }>;
  domainDistribution: Array<{ domain: string; count: number }>;
  attendanceCount: number;
};
