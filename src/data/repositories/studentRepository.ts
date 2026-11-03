import type { SupabaseClient } from '@supabase/supabase-js';
import { buildMyStudentList } from '../../business/students/studentList';
import type {
  CentreStudent,
  MyStudentListItem,
  StudentCourse,
  StudentEnrollment,
  StudentIdentifier,
  StudentSubject,
} from '../../types/students';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseIdentifier(value: unknown, field: string): StudentIdentifier {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Réponse Supabase invalide : identifiant ${field} manquant.`);
}

function parseRows<T>(
  value: unknown,
  resource: string,
  parseRow: (row: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Réponse Supabase invalide : liste ${resource} attendue.`);
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`Réponse Supabase invalide : ligne ${resource} inattendue.`);
    }
    return parseRow(entry);
  });
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseCentreStudentRows(value: unknown, centreId: string): CentreStudent[] {
  return parseRows(value, 'étudiants', (row) => {
    if (
      typeof row.centre_id !== 'string' ||
      row.centre_id.toLowerCase() !== centreId.toLowerCase()
    ) {
      throw new Error('La RPC get_my_centre_students a retourné un étudiant hors du centre actif.');
    }

    return {
      id: parseIdentifier(row.id, 'étudiant'),
      firstName: nullableString(row.prenom) ?? '',
      lastName: nullableString(row.nom) ?? '',
      email: nullableString(row.email),
      telephone: nullableString(row.telephone),
      centreId: row.centre_id,
    };
  });
}

function parseEnrollments(value: unknown): StudentEnrollment[] {
  return parseRows(value, 'inscriptions', (row) => ({
    studentId: parseIdentifier(row.etudiant_id, 'étudiant inscrit'),
    courseId: parseIdentifier(row.cours_id, 'cours inscrit'),
  }));
}

function parseCourses(value: unknown): StudentCourse[] {
  return parseRows(value, 'cours', (row) => ({
    id: parseIdentifier(row.id, 'cours'),
    subjectId: row.matiere_id === null ? null : parseIdentifier(row.matiere_id, 'matière du cours'),
  }));
}

function parseSubjects(value: unknown): StudentSubject[] {
  return parseRows(value, 'matières', (row) => ({
    id: parseIdentifier(row.id, 'matière'),
    name: nullableString(row.nom),
  }));
}

export async function getMyCentreStudents(
  client: SupabaseClient,
  centreId: string,
  profileId: string,
): Promise<MyStudentListItem[]> {
  if (!centreId) {
    throw new Error('Votre profil formateur n’est rattaché à aucun centre.');
  }
  if (!profileId) throw new Error('Votre profil formateur ne peut pas être vérifié.');

  const { data: teacher, error: teacherError } = await client
    .from('formateurs')
    .select('id')
    .eq('profile_id', profileId)
    .eq('centre_id', centreId)
    .maybeSingle();
  if (teacherError) throw teacherError;
  if (!teacher || (typeof teacher.id !== 'string' && typeof teacher.id !== 'number')) return [];

  const [studentsResult, coursesResult, subjectsResult] = await Promise.all([
    client.rpc('get_my_centre_students'),
    client
      .from('cours')
      .select('id,matiere_id')
      .eq('centre_id', centreId)
      .eq('formateur_id', teacher.id),
    client.from('matieres').select('id,nom'),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (coursesResult.error) throw coursesResult.error;
  if (subjectsResult.error) throw subjectsResult.error;

  const courses = parseCourses(coursesResult.data);
  const courseIds = courses.map(({ id }) => id);
  const enrollmentsResult = courseIds.length
    ? await client
        .from('inscriptions')
        .select('etudiant_id,cours_id')
        .eq('centre_id', centreId)
        .in('cours_id', courseIds)
    : { data: [], error: null };
  if (enrollmentsResult.error) throw enrollmentsResult.error;

  return buildMyStudentList(
    parseCentreStudentRows(studentsResult.data, centreId),
    parseEnrollments(enrollmentsResult.data),
    courses,
    parseSubjects(subjectsResult.data),
  );
}
