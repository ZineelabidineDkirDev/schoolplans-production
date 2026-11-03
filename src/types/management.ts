import type { StudentIdentifier } from './students';

export type ManagedStudent = {
  id: StudentIdentifier;
  firstName: string;
  lastName: string;
  email: string | null;
  telephone: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  parentTelephone: string | null;
  guardianCity: string | null;
  city: string | null;
  address: string | null;
  educationLevel: string | null;
  createdAt: string | null;
  groupId: StudentIdentifier | null;
  groupName: string | null;
  courseCount: number;
};

export type AttendanceStatus = 'present' | 'retard' | 'absent';

export type AttendanceStudent = {
  student: ManagedStudent;
  status: AttendanceStatus | null;
};

export type AttendanceCourse = {
  courseId: StudentIdentifier;
  date: string;
  students: AttendanceStudent[];
};

export type AttendanceSheet = {
  courses: AttendanceCourse[];
};
