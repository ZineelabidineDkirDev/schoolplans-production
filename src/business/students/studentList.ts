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
  const courseIdsByStudent = new Map<string, Set<string>>();

  for (const enrollment of enrollments) {
    const studentKey = String(enrollment.studentId);
    const course = courseById.get(String(enrollment.courseId));
    if (!studentById.has(studentKey) || !course) continue;
    const courseIds = courseIdsByStudent.get(studentKey) ?? new Set<string>();
    if (courseIds.has(String(course.id))) continue;
    courseIds.add(String(course.id));
    courseIdsByStudent.set(studentKey, courseIds);

    const courseName =
      course.subjectId === null ? '?' : (subjectNameById.get(String(course.subjectId)) ?? '?');
    const studentCourses = courseNamesByStudent.get(studentKey) ?? [];
    studentCourses.push(courseName);
    courseNamesByStudent.set(studentKey, studentCourses);
  }

  return students.flatMap((student) => {
    const courses = courseNamesByStudent.get(String(student.id)) ?? [];
    return courses.length ? [{ student, courses }] : [];
  });
}
