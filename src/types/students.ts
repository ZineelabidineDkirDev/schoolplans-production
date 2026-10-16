export type StudentIdentifier = number | string;

export type CentreStudent = {
  id: StudentIdentifier;
  firstName: string;
  lastName: string;
  email: string | null;
  telephone: string | null;
  centreId: string;
};

export type MyStudentListItem = {
  student: CentreStudent;
  courses: string[];
};

export type StudentEnrollment = {
  studentId: StudentIdentifier;
  courseId: StudentIdentifier;
};

export type StudentCourse = {
  id: StudentIdentifier;
  subjectId: StudentIdentifier | null;
};

export type StudentSubject = {
  id: StudentIdentifier;
  name: string | null;
};
