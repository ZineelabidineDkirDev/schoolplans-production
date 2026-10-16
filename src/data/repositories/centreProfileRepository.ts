import type { SupabaseClient } from '@supabase/supabase-js';

export type CentreProfile = {
  id: string;
  name: string;
  telephone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  logoUrl: string | null;
};

export type CentreProfileInput = Omit<CentreProfile, 'id' | 'logoUrl'>;

function parseCentreProfile(value: unknown): CentreProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Les informations du centre sont invalides.');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.nom !== 'string') {
    throw new Error('Les informations reçues ne contiennent pas les champs du centre attendus.');
  }
  return {
    id: row.id,
    name: row.nom,
    telephone: typeof row.telephone === 'string' ? row.telephone : null,
    email: typeof row.email === 'string' ? row.email : null,
    city: typeof row.ville === 'string' ? row.ville : null,
    address: typeof row.adresse === 'string' ? row.adresse : null,
    logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
  };
}

export async function getCentreProfile(
  client: SupabaseClient,
  centreId: string,
): Promise<CentreProfile> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  const { data, error } = await client
    .from('centres')
    .select('id,nom,telephone,email,ville,adresse,logo_url')
    .eq('id', centreId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Centre introuvable.');
  return parseCentreProfile(data);
}

export async function saveCentreProfile(
  client: SupabaseClient,
  centreId: string,
  input: CentreProfileInput,
  logoUrl?: string,
): Promise<CentreProfile> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  const name = input.name.trim();
  if (!name) throw new Error('Le nom du centre est obligatoire.');
  const payload: Record<string, string | null> = {
    nom: name,
    telephone: input.telephone?.trim() || null,
    email: input.email?.trim() || null,
    ville: input.city?.trim() || null,
    adresse: input.address?.trim() || null,
  };
  if (logoUrl) payload.logo_url = logoUrl;

  const { data, error } = await client
    .from('centres')
    .update(payload)
    .eq('id', centreId)
    .select('id,nom,telephone,email,ville,adresse,logo_url')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Le profil du centre n’a pas été modifié.');
  return parseCentreProfile(data);
}

export async function uploadCentreLogo(
  client: SupabaseClient,
  centreId: string,
  file: File,
): Promise<string> {
  if (!centreId) throw new Error('Votre profil n’est pas rattaché à un centre.');
  if (!file.type.startsWith('image/')) throw new Error('Sélectionnez un fichier image.');
  const safeName = file.name.toLocaleLowerCase('en').replace(/[^a-z0-9._-]+/g, '-');
  const path = `${centreId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from('centre-logos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from('centre-logos').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('L’URL publique du logo est introuvable.');
  return data.publicUrl;
}
