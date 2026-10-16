import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ENROLLMENT_EDUCATION_LEVELS,
  ENROLLMENT_REQUEST_STATUSES,
  type ActiveEnrollmentCentre,
  type EnrollmentRequest,
  type EnrollmentRequestFilter,
  type EnrollmentRequestSubmission,
  type EnrollmentRequestStatus,
} from '../../types/enrollmentRequests';
import type { StudentIdentifier } from '../../types/students';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseIdentifier(value: unknown): StudentIdentifier {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error('Réponse Supabase invalide : identifiant de demande manquant.');
}

function requiredString(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== 'string') {
    throw new Error(`Réponse Supabase invalide : ${key} de demande manquant.`);
  }
  return row[key];
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string')
    throw new Error('Réponse Supabase invalide : champ texte attendu.');
  return value;
}

function isEnrollmentRequestStatus(value: unknown): value is EnrollmentRequestStatus {
  return (
    typeof value === 'string' && ENROLLMENT_REQUEST_STATUSES.some((status) => status === value)
  );
}

function parseStatus(value: unknown): EnrollmentRequestStatus {
  if (!isEnrollmentRequestStatus(value)) {
    throw new Error('Réponse Supabase invalide : statut de demande invalide.');
  }
  return value;
}

function parseRequest(value: unknown): EnrollmentRequest {
  if (!isRecord(value)) throw new Error('Réponse Supabase invalide : demande inattendue.');
  const userId = optionalString(value.user_id);
  return {
    id: parseIdentifier(value.id),
    userId,
    firstName: requiredString(value, 'prenom'),
    lastName: requiredString(value, 'nom'),
    email: requiredString(value, 'email'),
    telephone: optionalString(value.telephone),
    address: optionalString(value.adresse),
    city: requiredString(value, 'ville'),
    educationLevel: requiredString(value, 'niveau_etudes'),
    status: parseStatus(value.statut),
    refusalReason: optionalString(value.motif),
    createdAt: requiredString(value, 'created_at'),
  };
}

function parseActiveCentre(value: unknown): ActiveEnrollmentCentre {
  if (!isRecord(value)) throw new Error('Réponse Supabase invalide : centre inattendu.');
  return {
    id: String(parseIdentifier(value.id)),
    name: requiredString(value, 'nom'),
  };
}

function toRpcRequestId(id: StudentIdentifier): number {
  if (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) return id;
  throw new Error(
    'La décision ne peut pas être envoyée : identifiant numérique de demande invalide.',
  );
}

export async function getActiveEnrollmentCentres(
  client: SupabaseClient,
): Promise<ActiveEnrollmentCentre[]> {
  const { data, error } = await client
    .from('centres')
    .select('id,nom')
    .eq('actif', true)
    .order('nom');
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error('Réponse Supabase invalide : liste de centres attendue.');
  }
  return data.map(parseActiveCentre);
}

export async function getEnrollmentRequestForUser(
  client: SupabaseClient,
  userId: string,
): Promise<EnrollmentRequest | null> {
  if (!userId) throw new Error('Votre compte ne peut pas être associé à une demande.');
  const { data, error } = await client
    .from('demandes_inscription')
    .select(
      'id,user_id,prenom,nom,email,telephone,adresse,ville,niveau_etudes,statut,motif,created_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : parseRequest(data);
}

export async function createEnrollmentRequest(
  client: SupabaseClient,
  userId: string,
  email: string,
  submission: EnrollmentRequestSubmission,
): Promise<void> {
  const firstName = submission.firstName.trim();
  const lastName = submission.lastName.trim();
  const city = submission.city.trim();
  const centreId = submission.centreId.trim();
  const normalizedEmail = email.trim();
  if (!userId || !normalizedEmail) {
    throw new Error('Votre compte doit disposer d’une adresse e-mail pour demander un accès.');
  }
  if (!firstName || !lastName || !city || !submission.educationLevel) {
    throw new Error('Complétez tous les champs obligatoires.');
  }
  if (!centreId) throw new Error('Veuillez sélectionner votre centre de formation.');
  if (!ENROLLMENT_EDUCATION_LEVELS.includes(submission.educationLevel)) {
    throw new Error('Sélectionnez un niveau d’études proposé.');
  }

  const { error } = await client.from('demandes_inscription').insert({
    user_id: userId,
    email: normalizedEmail,
    prenom: firstName,
    nom: lastName,
    telephone: submission.telephone.trim() || null,
    adresse: submission.address.trim() || null,
    ville: city,
    niveau_etudes: submission.educationLevel,
    centre_id: centreId,
  });
  if (error) throw error;
}

export async function getEnrollmentRequests(
  client: SupabaseClient,
  centreId: string,
  filter: EnrollmentRequestFilter,
): Promise<EnrollmentRequest[]> {
  if (!centreId) throw new Error('Sélectionnez un centre avant de consulter les inscriptions.');

  let query = client
    .from('demandes_inscription')
    .select(
      'id,user_id,prenom,nom,email,telephone,adresse,ville,niveau_etudes,statut,motif,created_at',
    )
    .eq('centre_id', centreId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter !== 'all') query = query.eq('statut', filter);

  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error('Réponse Supabase invalide : liste de demandes attendue.');
  }
  return data.map(parseRequest);
}

export async function approveEnrollmentRequest(
  client: SupabaseClient,
  id: StudentIdentifier,
): Promise<void> {
  const { error } = await client.rpc('approuver_demande', { did: toRpcRequestId(id) });
  if (error) throw error;
}

export async function rejectEnrollmentRequest(
  client: SupabaseClient,
  id: StudentIdentifier,
  reason: string | null,
): Promise<void> {
  const { error } = await client.rpc('refuser_demande', {
    did: toRpcRequestId(id),
    motif: reason?.trim() || null,
  });
  if (error) throw error;
}
