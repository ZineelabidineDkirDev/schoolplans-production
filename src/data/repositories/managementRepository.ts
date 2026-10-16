import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentIdentifier } from '../../types/students';
import type { AttendanceSheet, AttendanceStatus, ManagedStudent } from '../../types/management';

type Row = Record<string, unknown>;

function rows(value: unknown, label: string): Row[] {
  if (!Array.isArray(value))
    throw new Error(`Réponse Supabase invalide : liste ${label} attendue.`);
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Réponse Supabase invalide : ligne ${label} inattendue.`);
    }
    return entry as Row;
  });
}

function id(value: unknown, label: string): StudentIdentifier {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) return value;
  throw new Error(`Réponse Supabase invalide : identifiant ${label} manquant.`);
}

function optionalId(value: unknown, label: string): StudentIdentifier | null {
  return value === null || value === undefined ? null : id(value, label);
}

function optionalString(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Réponse Supabase invalide : ${label} attendu.`);
  return value;
}

function parseStudents(
  studentRows: Row[],
  groups: Map<string, string>,
  courseCounts: Map<string, number>,
): ManagedStudent[] {
  return studentRows.map((row) => {
    const groupId = optionalId(row.groupe_id, 'groupe étudiant');
    return {
      id: id(row.id, 'étudiant'),
      firstName: optionalString(row.prenom, 'prénom') ?? '',
      lastName: optionalString(row.nom, 'nom') ?? '',
      email: optionalString(row.email, 'e-mail'),
      telephone: optionalString(row.telephone, 'téléphone'),
      city: optionalString(row.ville, 'ville'),
      address: optionalString(row.adresse, 'adresse'),
      educationLevel: optionalString(row.niveau_etudes, 'niveau'),
      groupId,
      groupName: groupId ? (groups.get(String(groupId)) ?? null) : null,
      courseCount: courseCounts.get(String(row.id)) ?? 0,
    };
  });
}

export async function getCentreStudents(
  client: SupabaseClient,
  centreId: string,
): Promise<ManagedStudent[]> {
  if (!centreId) throw new Error('Sélectionnez un centre avant de consulter les étudiants.');
  const [studentsResult, groupsResult, enrollmentsResult] = await Promise.all([
    client
      .from('etudiants')
      .select('id,prenom,nom,email,telephone,ville,adresse,niveau_etudes,groupe_id')
      .eq('centre_id', centreId)
      .order('nom'),
    client.from('groupes').select('id,nom').eq('centre_id', centreId),
    client.from('inscriptions').select('etudiant_id,cours_id').eq('centre_id', centreId),
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (groupsResult.error) throw groupsResult.error;
  if (enrollmentsResult.error) throw enrollmentsResult.error;
  const groups = new Map(
    rows(groupsResult.data, 'groupes').map((group) => [
      String(id(group.id, 'groupe')),
      typeof group.nom === 'string' ? group.nom : '',
    ]),
  );
  const courseCounts = new Map<string, number>();
  for (const enrollment of rows(enrollmentsResult.data, 'inscriptions')) {
    const studentId = String(id(enrollment.etudiant_id, 'étudiant inscrit'));
    courseCounts.set(studentId, (courseCounts.get(studentId) ?? 0) + 1);
  }
  return parseStudents(rows(studentsResult.data, 'étudiants'), groups, courseCounts);
}

export async function getAttendanceSheet(
  client: SupabaseClient,
  centreId: string,
  date: string,
  courseIds: StudentIdentifier[],
): Promise<AttendanceSheet> {
  if (!centreId) throw new Error('Sélectionnez un centre avant de consulter les présences.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La date de présence est invalide.');
  if (courseIds.length === 0) return { courses: [] };

  const [studentsResult, groupsResult, enrollmentsResult, attendanceResult] = await Promise.all([
    client
      .from('etudiants')
      .select('id,prenom,nom,email,telephone,ville,adresse,niveau_etudes,groupe_id')
      .eq('centre_id', centreId)
      .order('nom'),
    client.from('groupes').select('id,nom').eq('centre_id', centreId),
    client
      .from('inscriptions')
      .select('etudiant_id,cours_id')
      .eq('centre_id', centreId)
      .in('cours_id', courseIds),
    client
      .from('presences')
      .select('cours_id,etudiant_id,statut')
      .eq('centre_id', centreId)
      .eq('date', date)
      .in('cours_id', courseIds),
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (groupsResult.error) throw groupsResult.error;
  if (enrollmentsResult.error) throw enrollmentsResult.error;
  if (attendanceResult.error) throw attendanceResult.error;

  const groups = new Map(
    rows(groupsResult.data, 'groupes').map((group) => [
      String(id(group.id, 'groupe')),
      typeof group.nom === 'string' ? group.nom : '',
    ]),
  );
  const studentRows = rows(studentsResult.data, 'étudiants');
  const enrollmentRows = rows(enrollmentsResult.data, 'inscriptions');
  const studentIds = new Set(enrollmentRows.map((row) => String(id(row.etudiant_id, 'étudiant'))));
  const students = parseStudents(
    studentRows.filter((student) => studentIds.has(String(student.id))),
    groups,
    new Map(),
  );
  const studentById = new Map(students.map((student) => [String(student.id), student]));
  const attendance = new Map<string, AttendanceStatus>();
  for (const row of rows(attendanceResult.data, 'présences')) {
    if (row.statut !== 'present' && row.statut !== 'retard' && row.statut !== 'absent') {
      throw new Error('Réponse Supabase invalide : statut de présence inattendu.');
    }
    attendance.set(
      `${String(id(row.cours_id, 'cours'))}|${String(id(row.etudiant_id, 'étudiant'))}`,
      row.statut,
    );
  }

  return {
    courses: courseIds.map((courseId) => ({
      courseId,
      students: enrollmentRows
        .filter((enrollment) => String(enrollment.cours_id) === String(courseId))
        .flatMap((enrollment) => {
          const studentId = id(enrollment.etudiant_id, 'étudiant inscrit');
          const student = studentById.get(String(studentId));
          if (!student) return [];
          return [
            {
              student,
              status: attendance.get(`${String(courseId)}|${String(studentId)}`) ?? null,
            },
          ];
        })
        .sort((left, right) =>
          `${left.student.lastName} ${left.student.firstName}`.localeCompare(
            `${right.student.lastName} ${right.student.firstName}`,
            'fr',
          ),
        ),
    })),
  };
}

export async function saveAttendance(
  client: SupabaseClient,
  centreId: string,
  courseId: StudentIdentifier,
  studentId: StudentIdentifier,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  if (!centreId) throw new Error('Sélectionnez un centre avant d’enregistrer une présence.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La date de présence est invalide.');
  if (!['present', 'retard', 'absent'].includes(status)) {
    throw new Error('Le statut de présence est invalide.');
  }
  const { error } = await client.from('presences').upsert(
    {
      cours_id: courseId,
      date,
      etudiant_id: studentId,
      statut: status,
      centre_id: centreId,
    },
    { onConflict: 'cours_id,date,etudiant_id' },
  );
  if (error) throw error;
}
