export type StudentIdentifier = number | string;

export type CentreStudent = {
  id: StudentIdentifier;
  firstName: string;
  lastName: string;
  email: string | null;
  telephone: string | null;
  centreId: string;
  groupId: StudentIdentifier | null;
  groupName: string | null;
  formationName: string | null;
};

export type MyStudentGroup = {
  id: StudentIdentifier;
  name: string;
  formationName: string | null;
};

export type MyStudentListItem = {
  student: CentreStudent;
  courses: string[];
  groups: MyStudentGroup[];
};

export type StudentEnrollment = {
  studentId: StudentIdentifier;
  courseId: StudentIdentifier;
};

export type StudentCourse = {
  id: StudentIdentifier;
  subjectId: StudentIdentifier | null;
  group: MyStudentGroup | null;
};

export type StudentSubject = {
  id: StudentIdentifier;
  name: string | null;
};
