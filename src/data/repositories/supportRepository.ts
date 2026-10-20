import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentIdentifier } from '../../types/students';

export type CourseSupport = {
  id: StudentIdentifier;
  courseId: StudentIdentifier;
  title: string;
  description: string | null;
  resourceType: 'file' | 'link';
  filePath: string | null;
  fileName: string;
  size: number;
  mimeType: string | null;
  externalUrl: string | null;
  sortOrder: number;
  createdAt: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORT_SELECT = 'id,cours_id,titre,description,fichier_path,nom_fichier,taille,type_mime,created_at,resource_type,external_url,sort_order';

function parseSupports(value: unknown): CourseSupport[] {
  if (!Array.isArray(value)) {
    throw new Error('Réponse Supabase invalide : liste de supports attendue.');
  }
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Réponse Supabase invalide : support inattendu.');
    }
    const row = entry as Record<string, unknown>;
    const resourceType = row.resource_type === 'link' ? 'link' : 'file';
    if (
      (typeof row.id !== 'string' && typeof row.id !== 'number') ||
      (typeof row.cours_id !== 'string' && typeof row.cours_id !== 'number') ||
      typeof row.titre !== 'string' ||
      (resourceType === 'file' && typeof row.fichier_path !== 'string') ||
      typeof row.nom_fichier !== 'string' ||
      typeof row.created_at !== 'string' ||
      (resourceType === 'link' && typeof row.external_url !== 'string')
    ) {
      throw new Error('Réponse Supabase invalide : champs de support manquants.');
    }
    return {
      id: row.id as StudentIdentifier,
      courseId: row.cours_id as StudentIdentifier,
      title: row.titre,
      description: typeof row.description === 'string' ? row.description : null,
      resourceType,
      filePath: typeof row.fichier_path === 'string' ? row.fichier_path : null,
      fileName: row.nom_fichier,
      size: typeof row.taille === 'number' ? row.taille : 0,
      mimeType: typeof row.type_mime === 'string' ? row.type_mime : null,
      externalUrl: typeof row.external_url === 'string' ? row.external_url : null,
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      createdAt: row.created_at,
    };
  });
}

function normalizeHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Saisissez une adresse URL valide.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Le lien doit commencer par https:// ou http://.');
  }
  return parsed.toString();
}

function assertOwnCourse(
  centreId: string,
  courseId: StudentIdentifier,
  allowedCourseIds: StudentIdentifier[],
) {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (!allowedCourseIds.some((id) => String(id) === String(courseId))) {
    throw new Error('Vous ne pouvez gérer que les supports de vos propres cours.');
  }
}

async function nextSortOrder(
  client: SupabaseClient,
  centreId: string,
  courseId: StudentIdentifier,
): Promise<number> {
  const { data, error } = await client
    .from('documents')
    .select('sort_order')
    .eq('centre_id', centreId)
    .eq('cours_id', courseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const current = typeof data?.sort_order === 'number' ? data.sort_order : 0;
  return current + 1;
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
    .select(SUPPORT_SELECT)
    .eq('centre_id', centreId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
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

  const sortOrder = await nextSortOrder(client, input.centreId, input.courseId);
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
      resource_type: 'file',
      external_url: null,
      sort_order: sortOrder,
    })
    .select(SUPPORT_SELECT)
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

export async function createLinkCourseSupport(
  client: SupabaseClient,
  input: {
    centreId: string;
    courseId: StudentIdentifier;
    title: string;
    description: string;
    url: string;
  },
): Promise<CourseSupport> {
  const title = input.title.trim();
  if (!input.centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (!title) throw new Error('Donnez un titre à la ressource.');
  const url = normalizeHttpUrl(input.url);
  const sortOrder = await nextSortOrder(client, input.centreId, input.courseId);
  const host = new URL(url).hostname;

  const { data, error } = await client
    .from('documents')
    .insert({
      cours_id: input.courseId,
      titre: title,
      description: input.description.trim() || null,
      fichier_path: null,
      nom_fichier: host,
      taille: 0,
      type_mime: null,
      centre_id: input.centreId,
      resource_type: 'link',
      external_url: url,
      sort_order: sortOrder,
    })
    .select(SUPPORT_SELECT)
    .single();
  if (error) throw error;
  return parseSupports([data])[0];
}

export async function updateCourseSupport(
  client: SupabaseClient,
  centreId: string,
  support: CourseSupport,
  allowedCourseIds: StudentIdentifier[],
  input: { title: string; description: string; url?: string },
): Promise<CourseSupport> {
  assertOwnCourse(centreId, support.courseId, allowedCourseIds);
  const title = input.title.trim();
  if (!title) throw new Error('Donnez un titre à la ressource.');

  const payload: Record<string, unknown> = {
    titre: title,
    description: input.description.trim() || null,
  };
  if (support.resourceType === 'link') {
    const url = normalizeHttpUrl(input.url ?? '');
    payload.external_url = url;
    payload.nom_fichier = new URL(url).hostname;
  }

  const { data, error } = await client
    .from('documents')
    .update(payload)
    .eq('id', support.id)
    .eq('centre_id', centreId)
    .eq('cours_id', support.courseId)
    .select(SUPPORT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Support introuvable ou modification non autorisée.');
  return parseSupports([data])[0];
}

export async function swapCourseSupportOrder(
  client: SupabaseClient,
  centreId: string,
  current: CourseSupport,
  neighbor: CourseSupport,
  allowedCourseIds: StudentIdentifier[],
): Promise<void> {
  assertOwnCourse(centreId, current.courseId, allowedCourseIds);
  assertOwnCourse(centreId, neighbor.courseId, allowedCourseIds);
  if (String(current.courseId) !== String(neighbor.courseId)) {
    throw new Error('Les supports ne peuvent être réorganisés qu’au sein du même cours.');
  }

  const { data: first, error: firstError } = await client
    .from('documents')
    .update({ sort_order: neighbor.sortOrder })
    .eq('id', current.id)
    .eq('centre_id', centreId)
    .eq('cours_id', current.courseId)
    .select('id')
    .maybeSingle();
  if (firstError) throw firstError;
  if (!first) throw new Error('Support introuvable ou réorganisation non autorisée.');

  const { data: second, error: secondError } = await client
    .from('documents')
    .update({ sort_order: current.sortOrder })
    .eq('id', neighbor.id)
    .eq('centre_id', centreId)
    .eq('cours_id', neighbor.courseId)
    .select('id')
    .maybeSingle();
  if (secondError) throw secondError;
  if (!second) throw new Error('Le premier support a été déplacé, mais le second n’a pas pu être réordonné. Rechargez la liste.');
}

export async function getSupportSignedUrl(
  client: SupabaseClient,
  support: CourseSupport,
  download: boolean,
): Promise<string> {
  if (support.resourceType !== 'file' || !support.filePath) {
    throw new Error('Cette ressource est un lien externe, pas un fichier à télécharger.');
  }
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
  assertOwnCourse(centreId, support.courseId, allowedCourseIds);
  const { data: deleted, error: deleteError } = await client
    .from('documents')
    .delete()
    .eq('id', support.id)
    .eq('centre_id', centreId)
    .select('id')
    .maybeSingle();

  if (deleteError) throw deleteError;
  if (!deleted) {
    throw new Error('Support introuvable ou suppression non autorisée pour ce centre.');
  }

  if (support.resourceType === 'file' && support.filePath) {
    const { error: storageError } = await client.storage.from('supports').remove([support.filePath]);
    if (storageError) {
      throw new Error(
        `Le support a été retiré de la liste, mais son fichier n’a pas pu être nettoyé dans Storage : ${storageError.message}`,
      );
    }
  }
}
