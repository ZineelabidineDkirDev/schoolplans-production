import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardCourse,
  DashboardData,
  DashboardEnrollment,
  DashboardPopularFormation,
  DashboardPresence,
  DashboardRegistrationRequest,
  DashboardSubject,
  DashboardStudentCity,
  DashboardTeacher,
} from '../../types/dashboard';
import type { StudentIdentifier } from '../../types/students';

function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Réponse Supabase invalide : ligne ${name} inattendue.`);
  }
  return value as Record<string, unknown>;
}

function rows(value: unknown, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`Réponse Supabase invalide : liste ${name} attendue.`);
  }
  return value.map((row) => record(row, name));
}

function identifier(value: unknown, field: string): StudentIdentifier {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) return value;
  throw new Error(`Réponse Supabase invalide : identifiant ${field} manquant.`);
}

function optionalIdentifier(value: unknown): StudentIdentifier | null {
  if (value === null || value === undefined) return null;
  return identifier(value, 'associé');
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Réponse Supabase invalide : ${field} manquant.`);
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseTeachers(value: unknown): DashboardTeacher[] {
  return rows(value, 'formateurs').map((row) => ({
    id: identifier(row.id, 'formateur'),
    name: string(row.nom, 'nom du formateur'),
  }));
}

function parseCourses(
  value: unknown,
  roomNames: Map<string, string> = new Map(),
): DashboardCourse[] {
  return rows(value, 'cours').map((row) => ({
    id: identifier(row.id, 'cours'),
    teacherId: optionalIdentifier(row.formateur_id),
    subjectId: optionalIdentifier(row.matiere_id),
    weekday: typeof row.jour === 'number' ? row.jour : Number(row.jour),
    startsAt: string(row.debut, 'heure de début'),
    endsAt: string(row.fin, 'heure de fin'),
    startsOn: optionalString(row.valable_du),
    endsOn: optionalString(row.valable_au),
    roomName:
      row.salle_id === null || row.salle_id === undefined
        ? null
        : (roomNames.get(String(row.salle_id)) ?? null),
  }));
}

function parseSubjects(value: unknown): DashboardSubject[] {
  return rows(value, 'matières').map((row) => ({
    id: identifier(row.id, 'matière'),
    name: optionalString(row.nom) ?? '?',
    domain: optionalString(row.domaine_nom),
  }));
}

function parsePopularFormations(
  formationsValue: unknown,
  groupsValue: unknown,
  studentsValue: unknown,
): DashboardPopularFormation[] {
  const formations = new Map(
    rows(formationsValue, 'formations populaires').map((formation) => [
      String(identifier(formation.id, 'formation')),
      optionalString(formation.nom) ?? 'Formation sans nom',
    ]),
  );
  const formationsByGroup = new Map(
    rows(groupsValue, 'groupes de formation')
      .filter((group) => group.formation_id !== null && group.formation_id !== undefined)
      .map((group) => [
        String(identifier(group.id, 'groupe')),
        String(identifier(group.formation_id, 'formation')),
      ]),
  );
  const studentsByFormation = new Map<string, number>();
  for (const student of rows(studentsValue, 'groupes des étudiants')) {
    if (student.groupe_id === null || student.groupe_id === undefined) continue;
    const formationId = formationsByGroup.get(String(student.groupe_id));
    if (formationId) {
      studentsByFormation.set(formationId, (studentsByFormation.get(formationId) ?? 0) + 1);
    }
  }

  return [...formations]
    .map(([id, name]) => ({ name, studentCount: studentsByFormation.get(id) ?? 0 }))
    .sort(
      (left, right) =>
        right.studentCount - left.studentCount || left.name.localeCompare(right.name, 'fr'),
    )
    .slice(0, 5);
}

function parseEnrollments(value: unknown): DashboardEnrollment[] {
  return rows(value, 'inscriptions').map((row) => ({
    courseId: identifier(row.cours_id, 'cours inscrit'),
    studentId: identifier(row.etudiant_id, 'étudiant inscrit'),
    createdAt: optionalString(row.created_at),
  }));
}

function parseStudentCities(value: unknown): DashboardStudentCity[] {
  const counts = new Map<string, number>();
  for (const row of rows(value, 'villes des étudiants')) {
    const city = optionalString(row.ville)?.trim();
    if (!city) continue;
    const key = city.toLocaleLowerCase('fr');
    const existing = [...counts.keys()].find((name) => name.toLocaleLowerCase('fr') === key);
    counts.set(existing ?? city, (counts.get(existing ?? city) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([city, studentCount]) => ({ city, studentCount }))
    .sort((left, right) => right.studentCount - left.studentCount || left.city.localeCompare(right.city, 'fr'));
}

function parsePresences(value: unknown): DashboardPresence[] {
  return rows(value, 'présences').map((row) => ({
    courseId: identifier(row.cours_id, 'cours de présence'),
    date: string(row.date, 'date de présence'),
    status: string(row.statut, 'statut de présence'),
  }));
}

function parseRequests(value: unknown): DashboardRegistrationRequest[] {
  return rows(value, 'demandes d’inscription').map((row) => ({
    status: string(row.statut, 'statut de demande'),
    createdAt: optionalString(row.created_at),
  }));
}

function parseDates(value: unknown, field: string): string[] {
  return rows(value, field).map((row) => string(row.date, `date ${field}`));
}

export async function getDashboardData(
  client: SupabaseClient,
  centreId: string,
  profileId: string,
  role: 'admin' | 'director' | 'super_admin' | 'formateur',
): Promise<DashboardData> {
  if (!centreId) {
    throw new Error(
      role === 'super_admin'
        ? 'Sélectionnez un centre avant d’ouvrir le tableau de bord.'
        : 'Votre profil n’est rattaché à aucun centre.',
    );
  }

  let teacherId: StudentIdentifier | null = null;
  let linkedTeacher: DashboardTeacher | null = null;
  if (role === 'formateur') {
    const { data, error } = await client
      .from('formateurs')
      .select('id,nom')
      .eq('profile_id', profileId)
      .eq('centre_id', centreId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const [teacher] = parseTeachers([data]);
      linkedTeacher = teacher;
      teacherId = teacher.id;
    }
    if (!linkedTeacher) {
      return {
        linkedTeacher: null,
        courses: [],
        subjects: [],
        teachers: [],
        studentIds: [],
        enrollments: [],
        studentCities: [],
        presences: [],
        requests: [],
        formationCount: null,
        groupCount: null,
        popularFormations: [],
        closedDates: [],
        cancelledOccurrences: [],
      };
    }
  }

  let courseQuery = client
    .from('cours')
    .select('id,formateur_id,matiere_id,jour,debut,fin,valable_du,valable_au,salle_id');
  courseQuery = courseQuery.eq('centre_id', centreId);
  if (teacherId !== null) courseQuery = courseQuery.eq('formateur_id', teacherId);

  let teachersQuery = client.from('formateurs').select('id,nom').eq('centre_id', centreId);
  if (teacherId !== null) teachersQuery = teachersQuery.eq('id', teacherId);

  const studentsQuery = client.from('etudiants').select('id').eq('centre_id', centreId);
  const enrollmentsQuery = client
    .from('inscriptions')
    .select('cours_id,etudiant_id,created_at')
    .eq('centre_id', centreId);
  const presencesQuery = client
    .from('presences')
    .select('cours_id,date,statut')
    .eq('centre_id', centreId)
    .limit(10000);
  if (teacherId !== null) {
    const { data: teacherCourses, error } = await courseQuery;
    if (error) throw error;
    const rawCourses = rows(teacherCourses, 'cours');
    const roomIds = rawCourses
      .map((course) => optionalIdentifier(course.salle_id))
      .filter((id): id is StudentIdentifier => id !== null);
    const roomsResult = roomIds.length
      ? await client.from('salles').select('id,nom').in('id', roomIds)
      : { data: [], error: null };
    if (roomsResult.error) throw roomsResult.error;
    const roomNames = new Map(
      rows(roomsResult.data, 'salles').map((room) => [
        String(identifier(room.id, 'salle')),
        string(room.nom, 'nom de salle'),
      ]),
    );
    const courses = parseCourses(rawCourses, roomNames);
    const courseIds = courses.map((course) => course.id);
    const [enrollmentsResult, presencesResult, subjectsResult] = await Promise.all([
      courseIds.length
        ? client
            .from('inscriptions')
            .select('cours_id,etudiant_id,created_at')
            .eq('centre_id', centreId)
            .in('cours_id', courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? client
            .from('presences')
            .select('cours_id,date,statut')
            .eq('centre_id', centreId)
            .in('cours_id', courseIds)
            .limit(10000)
        : Promise.resolve({ data: [], error: null }),
      client.from('matieres').select('id,nom'),
    ]);
    if (enrollmentsResult.error) throw enrollmentsResult.error;
    if (presencesResult.error) throw presencesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;

    const teacherEnrollments = parseEnrollments(enrollmentsResult.data);
    const uniqueStudentIds = [...new Map(teacherEnrollments.map((enrollment) => [String(enrollment.studentId), enrollment.studentId])).values()];
    const studentsResult = uniqueStudentIds.length
      ? await client
          .from('etudiants')
          .select('id,ville')
          .eq('centre_id', centreId)
          .in('id', uniqueStudentIds)
      : { data: [], error: null };
    if (studentsResult.error) throw studentsResult.error;

    return {
      linkedTeacher,
      courses,
      subjects: parseSubjects(subjectsResult.data),
      teachers: linkedTeacher ? [linkedTeacher] : [],
      studentIds: [],
      enrollments: teacherEnrollments,
      studentCities: parseStudentCities(studentsResult.data), 
      presences: parsePresences(presencesResult.data),
      requests: [],
      formationCount: null,
      groupCount: null,
      popularFormations: [],
      closedDates: [],
      cancelledOccurrences: [],
    };
  }

  const [
    coursesResult,
    teachersResult,
    studentsResult,
    enrollmentsResult,
    presencesResult,
    requestsResult,
    cancellationsResult,
    closuresResult,
    subjectsResult,
    formationCountResult,
    groupCountResult,
    roomsResult,
    domainsResult,
    formationsResult,
    groupsResult,
    studentGroupsResult,
  ] = await Promise.all([
    courseQuery,
    teachersQuery,
    studentsQuery,
    enrollmentsQuery,
    presencesQuery,
    client.from('demandes_inscription').select('statut,created_at').eq('centre_id', centreId),
    client.from('annulations').select('cours_id,date').eq('centre_id', centreId),
    client.from('fermetures').select('date').eq('centre_id', centreId),
    client.from('matieres').select('id,nom,domaine_id'),
    client
      .from('formations')
      .select('id', { count: 'exact', head: true })
      .eq('centre_id', centreId),
    client.from('groupes').select('id', { count: 'exact', head: true }).eq('centre_id', centreId),
    client.from('salles').select('id,nom').eq('centre_id', centreId),
    client.from('domaines').select('id,nom'),
    client.from('formations').select('id,nom').eq('centre_id', centreId),
    client.from('groupes').select('id,formation_id').eq('centre_id', centreId),
    client.from('etudiants').select('groupe_id').eq('centre_id', centreId),
  ]);

  const results = [
    coursesResult,
    teachersResult,
    studentsResult,
    enrollmentsResult,
    presencesResult,
    requestsResult,
    cancellationsResult,
    closuresResult,
    subjectsResult,
    formationCountResult,
    groupCountResult,
    roomsResult,
    domainsResult,
    formationsResult,
    groupsResult,
    studentGroupsResult,
  ];
  const failure = results.find((result) => result.error);
  if (failure?.error) throw failure.error;

  const roomNames = new Map(
    rows(roomsResult.data, 'salles').map((room) => [
      String(identifier(room.id, 'salle')),
      string(room.nom, 'nom de salle'),
    ]),
  );
  const domainNames = new Map(
    rows(domainsResult.data, 'domaines').map((domain) => [
      String(identifier(domain.id, 'domaine')),
      string(domain.nom, 'nom de domaine'),
    ]),
  );
  const subjectsWithDomains = rows(subjectsResult.data, 'matières').map((subject) => ({
    ...subject,
    domaine_nom:
      subject.domaine_id === null || subject.domaine_id === undefined
        ? null
        : (domainNames.get(String(subject.domaine_id)) ?? null),
  }));
  const courses = parseCourses(coursesResult.data, roomNames);
  return {
    linkedTeacher: null,
    courses,
    subjects: parseSubjects(subjectsWithDomains),
    teachers: parseTeachers(teachersResult.data),
    studentIds: rows(studentsResult.data, 'étudiants').map((row) => identifier(row.id, 'étudiant')),
    enrollments: parseEnrollments(enrollmentsResult.data),
    presences: parsePresences(presencesResult.data),
    requests: parseRequests(requestsResult.data),
    formationCount: formationCountResult.count,
    groupCount: groupCountResult.count,
    popularFormations: parsePopularFormations(
      formationsResult.data,
      groupsResult.data,
      studentGroupsResult.data,
    ),
    closedDates: parseDates(closuresResult.data, 'fermetures'),
    cancelledOccurrences: rows(cancellationsResult.data, 'annulations').map(
      (row) => `${identifier(row.cours_id, 'cours annulé')}|${string(row.date, 'date annulée')}`,
    ),
  };
}
