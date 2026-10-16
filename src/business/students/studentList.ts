import type {
  CentreStudent,
  MyStudentListItem,
  StudentCourse,
  StudentEnrollment,
  StudentSubject,
} from '../../types/students';

export function buildMyStudentList(
  students: CentreStudent[],
  enrollments: StudentEnrollment[],
  courses: StudentCourse[],
  subjects: StudentSubject[],
): MyStudentListItem[] {
  const studentById = new Map(students.map((student) => [String(student.id), student]));
  const courseById = new Map(courses.map((course) => [String(course.id), course]));
  const subjectNameById = new Map(
    subjects.map((subject) => [String(subject.id), subject.name || '?']),
  );
  const courseNamesByStudent = new Map<string, string[]>();

  for (const enrollment of enrollments) {
    const studentKey = String(enrollment.studentId);
    const course = courseById.get(String(enrollment.courseId));
    if (!studentById.has(studentKey) || !course) continue;

    const courseName =
      course.subjectId === null ? '?' : (subjectNameById.get(String(course.subjectId)) ?? '?');
    const studentCourses = courseNamesByStudent.get(studentKey) ?? [];
    studentCourses.push(courseName);
    courseNamesByStudent.set(studentKey, studentCourses);
  }

  return students.map((student) => ({
    student,
    courses: courseNamesByStudent.get(String(student.id)) ?? [],
  }));
}
