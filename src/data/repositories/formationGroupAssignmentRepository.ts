import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentIdentifier } from '../../types/students';

export type FormationGroupStudentOption = {
  id: StudentIdentifier;
  firstName: string;
  lastName: string;
  assigned: boolean;
};

function parseOptions(value: unknown): FormationGroupStudentOption[] {
  if (!Array.isArray(value)) {
    throw new Error('Réponse Supabase invalide : étudiants du groupe attendus.');
  }
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Réponse Supabase invalide : étudiant du groupe inattendu.');
    }
    const row = entry as Record<string, unknown>;
    if (
      (typeof row.id !== 'string' && typeof row.id !== 'number') ||
      typeof row.assigned !== 'boolean'
    ) {
      throw new Error('Réponse Supabase invalide : données d’étudiant incomplètes.');
    }
    return {
      id: row.id,
      firstName: typeof row.prenom === 'string' ? row.prenom : '',
      lastName: typeof row.nom === 'string' ? row.nom : '',
      assigned: row.assigned,
    };
  });
}

export async function getMyFormationGroupStudents(
  client: SupabaseClient,
  groupId: StudentIdentifier,
): Promise<FormationGroupStudentOption[]> {
  const { data, error } = await client.rpc('get_my_formation_group_students', {
    p_group_id: String(groupId),
  });
  if (error) throw error;
  return parseOptions(data);
}

export async function saveMyFormationGroupStudents(
  client: SupabaseClient,
  groupId: StudentIdentifier,
  studentIds: StudentIdentifier[],
): Promise<void> {
  const { error } = await client.rpc('save_my_formation_group_students', {
    p_group_id: String(groupId),
    p_student_ids: [...new Set(studentIds.map(String))],
  });
  if (error) throw error;
}
