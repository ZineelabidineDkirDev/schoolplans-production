import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentIdentifier } from '../../types/students';

export type Certificate = {
  id: StudentIdentifier;
  studentId: StudentIdentifier;
  module: string;
  startsOn: string | null;
  endsOn: string | null;
  hours: number | null;
  mention: string | null;
  createdAt: string;
};

export type CertificateInput = {
  studentId: StudentIdentifier;
  module: string;
  startsOn: string | null;
  endsOn: string | null;
  hours: number | null;
  mention: string | null;
};

function parseCertificates(value: unknown): Certificate[] {
  if (!Array.isArray(value)) {
    throw new Error('Réponse Supabase invalide : liste de certificats attendue.');
  }
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Réponse Supabase invalide : certificat inattendu.');
    }
    const row = entry as Record<string, unknown>;
    if (
      (typeof row.id !== 'string' && typeof row.id !== 'number') ||
      (typeof row.etudiant_id !== 'string' && typeof row.etudiant_id !== 'number') ||
      typeof row.module !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('Réponse Supabase invalide : champs du certificat manquants.');
    }
    return {
      id: row.id,
      studentId: row.etudiant_id,
      module: row.module,
      startsOn: typeof row.date_debut === 'string' ? row.date_debut : null,
      endsOn: typeof row.date_fin === 'string' ? row.date_fin : null,
      hours: typeof row.heures === 'number' ? row.heures : null,
      mention: typeof row.mention === 'string' ? row.mention : null,
      createdAt: row.created_at,
    };
  });
}

export async function getCentreCertificates(
  client: SupabaseClient,
  centreId: string,
): Promise<Certificate[]> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  const { data, error } = await client
    .from('certificats')
    .select('id,etudiant_id,module,date_debut,date_fin,heures,mention,created_at')
    .eq('centre_id', centreId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return parseCertificates(data);
}

export async function createCentreCertificate(
  client: SupabaseClient,
  centreId: string,
  input: CertificateInput,
): Promise<Certificate> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (typeof input.studentId === 'string' && !input.studentId.trim()) {
    throw new Error('Choisissez un étudiant.');
  }
  const module = input.module.trim();
  if (!module) throw new Error('La formation est obligatoire.');
  if (input.hours !== null && (!Number.isFinite(input.hours) || input.hours <= 0)) {
    throw new Error('La durée doit être un nombre d’heures supérieur à zéro.');
  }
  if (input.startsOn && input.endsOn && input.startsOn > input.endsOn) {
    throw new Error('La date de fin doit être postérieure ou égale à la date de début.');
  }
  const { data, error } = await client
    .from('certificats')
    .insert({
      centre_id: centreId,
      etudiant_id: input.studentId,
      module,
      date_debut: input.startsOn,
      date_fin: input.endsOn,
      heures: input.hours,
      mention: input.mention?.trim() || null,
    })
    .select('id,etudiant_id,module,date_debut,date_fin,heures,mention,created_at')
    .single();
  if (error) throw error;
  return parseCertificates([data])[0];
}
