import type { StudentIdentifier } from './students';

export type ManagedStudent = {
  id: StudentIdentifier;
  firstName: string;
  lastName: string;
  email: string | null;
  telephone: string | null;
  parentTelephone: string | null;
  city: string | null;
  address: string | null;
  educationLevel: string | null;
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
  students: AttendanceStudent[];
};

export type AttendanceSheet = {
  courses: AttendanceCourse[];
};
