import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentIdentifier } from '../../types/students';

export type CourseSupport = {
  id: StudentIdentifier;
  courseId: StudentIdentifier;
  title: string;
  description: string | null;
  filePath: string;
  fileName: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function parseSupports(value: unknown): CourseSupport[] {
  if (!Array.isArray(value))
    throw new Error('Réponse Supabase invalide : liste de supports attendue.');
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Réponse Supabase invalide : support inattendu.');
    }
    const row = entry as Record<string, unknown>;
    if (
      (typeof row.id !== 'string' && typeof row.id !== 'number') ||
      (typeof row.cours_id !== 'string' && typeof row.cours_id !== 'number') ||
      typeof row.titre !== 'string' ||
      typeof row.fichier_path !== 'string' ||
      typeof row.nom_fichier !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('Réponse Supabase invalide : champs de support manquants.');
    }
    return {
      id: row.id,
      courseId: row.cours_id,
      title: row.titre,
      description: typeof row.description === 'string' ? row.description : null,
      filePath: row.fichier_path,
      fileName: row.nom_fichier,
      size: typeof row.taille === 'number' ? row.taille : 0,
      mimeType: typeof row.type_mime === 'string' ? row.type_mime : null,
      createdAt: row.created_at,
    };
  });
}

export async function getCourseSupports(
  client: SupabaseClient,
  centreId: string,
  courseIds?: StudentIdentifier[],
): Promise<CourseSupport[]> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (courseIds && courseIds.length === 0) return [];
  let query = client
    .from('documents')
    .select('id,cours_id,titre,description,fichier_path,nom_fichier,taille,type_mime,created_at')
    .eq('centre_id', centreId)
    .order('created_at', { ascending: false });
  if (courseIds) query = query.in('cours_id', courseIds);
  const { data, error } = await query;
  if (error) throw error;
  return parseSupports(data);
}

export async function uploadCourseSupport(
  client: SupabaseClient,
  input: {
    centreId: string;
    courseId: StudentIdentifier;
    title: string;
    description: string;
    file: File;
  },
): Promise<CourseSupport> {
  const title = input.title.trim();
  if (!input.centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (!title) throw new Error('Donnez un titre au document.');
  if (!input.file) throw new Error('Choisissez un fichier.');
  if (input.file.size > MAX_FILE_SIZE) throw new Error('Fichier trop volumineux (20 Mo maximum).');

  const safeName = input.file.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `${input.courseId}/${Date.now()}-${safeName || 'support'}`;
  const storage = client.storage.from('supports');
  const { error: uploadError } = await storage.upload(path, input.file, {
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from('documents')
    .insert({
      cours_id: input.courseId,
      titre: title,
      description: input.description.trim() || null,
      fichier_path: path,
      nom_fichier: input.file.name,
      taille: input.file.size,
      type_mime: input.file.type || null,
      centre_id: input.centreId,
    })
    .select('id,cours_id,titre,description,fichier_path,nom_fichier,taille,type_mime,created_at')
    .single();
  if (error) {
    const { error: cleanupError } = await storage.remove([path]);
    if (cleanupError) {
      throw new Error(
        `Erreur d’enregistrement du support : ${error.message}. Le fichier temporaire n’a pas pu être supprimé : ${cleanupError.message}`,
      );
    }
    throw error;
  }
  return parseSupports([data])[0];
}

export async function getSupportSignedUrl(
  client: SupabaseClient,
  support: CourseSupport,
  download: boolean,
): Promise<string> {
  const { data, error } = await client.storage
    .from('supports')
    .createSignedUrl(support.filePath, 120, download ? { download: support.fileName } : undefined);
  if (error) throw error;
  if (!data.signedUrl) throw new Error('Le lien temporaire du support est introuvable.');
  return data.signedUrl;
}

export async function deleteCourseSupport(
  client: SupabaseClient,
  centreId: string,
  support: CourseSupport,
  allowedCourseIds: StudentIdentifier[],
): Promise<void> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (!allowedCourseIds.some((courseId) => String(courseId) === String(support.courseId))) {
    throw new Error('Vous ne pouvez supprimer que les supports de vos propres cours.');
  }
  const { error: storageError } = await client.storage.from('supports').remove([support.filePath]);
  if (storageError) throw storageError;
  const { error } = await client
    .from('documents')
    .delete()
    .eq('id', support.id)
    .eq('centre_id', centreId);
  if (error) throw error;
}
