// IMPORTANT :
// - Le compte Auth est créé côté serveur uniquement.
// - Supabase peut créer automatiquement un profil lors de la création Auth.
// - Dans ce cas, on MET À JOUR ce profil au lieu d'en créer un second.
// - Le directeur reçoit must_change = true.
// - Aucune clé secrète n'est envoyée au frontend.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
    },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serverKey(): string {
  try {
    const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')?.default;

    if (k) return k;
  } catch {
    // Repli sur l'ancienne variable
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function validPassword(password: string) {
  return password.length >= 10 && password.length <= 72;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function alreadyExistsError(message: string) {
  const m = message.toLowerCase();

  return (
    m.includes('already registered') ||
    m.includes('already exists') ||
    m.includes('user already') ||
    m.includes('already been registered')
  );
}

/**
 * Crée uniquement le compte Auth du directeur.
 *
 * Le trigger actuel de la base peut créer automatiquement
 * la ligne profiles correspondante.
 */
async function createDirectorAuth(
  admin: SupabaseClient,
  fullName: string,
  email: string,
  password: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_change: true,
    },
  });

  if (error || !data?.user) {
    return {
      user: null,
      error,
    };
  }

  return {
    user: data.user,
    error: null,
  };
}

/**
 * Finalise le profil d'un directeur.
 *
 * Si Supabase a déjà créé profiles :
 *   UPDATE
 *
 * Sinon :
 *   INSERT
 */
async function finalizeDirectorProfile(
  admin: SupabaseClient,
  userId: string,
  fullName: string,
  centreId: string,
) {
  const { data: existingProfile, error: profileReadError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileReadError) {
    return {
      error: profileReadError,
    };
  }

  if (existingProfile) {
    const { error } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        role: 'director',
        statut: 'approuve',
        centre_id: centreId,
      })
      .eq('id', userId);

    return {
      error,
    };
  }

  const { error } = await admin.from('profiles').insert({
    id: userId,
    full_name: fullName,
    role: 'director',
    statut: 'approuve',
    centre_id: centreId,
  });

  return {
    error,
  };
}

Deno.serve(async (req: Request) => {
  // ============================================================
  // OPTIONS / METHOD
  // ============================================================

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  if (req.method !== 'POST') {
    return json(
      {
        error: 'Méthode non autorisée',
      },
      405,
    );
  }

  // ============================================================
  // CONFIGURATION SERVEUR
  // ============================================================

  const url = Deno.env.get('SUPABASE_URL') ?? '';

  const key = serverKey();

  if (!url || !key) {
    return json(
      {
        error: 'Configuration serveur incomplète',
      },
      500,
    );
  }

  const admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // ============================================================
  // AUTHENTIFICATION
  // ============================================================

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');

  if (!token) {
    return json(
      {
        error: 'Non authentifié',
      },
      401,
    );
  }

  const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token);

  const claims = claimsData?.claims;

  if (claimsErr || !claims?.sub || claims.role !== 'authenticated') {
    return json(
      {
        error: 'Non authentifié',
      },
      401,
    );
  }

  // ============================================================
  // SUPER ADMIN UNIQUEMENT
  // ============================================================

  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', claims.sub)
    .maybeSingle();

  if (!me || me.role !== 'super_admin') {
    return json(
      {
        error: 'Action réservée au super administrateur',
      },
      403,
    );
  }

  // ============================================================
  // BODY
  // ============================================================

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json(
      {
        error: 'Requête invalide',
      },
      400,
    );
  }

  const action = String(body?.action ?? '');

  // ============================================================
  // ACTION : REUSE EXISTING DIRECTOR/CENTRE FOR A DEMO REQUEST
  // Never reassign an existing account or reset the centre's trial dates.
  // ============================================================

  if (action === 'reuse_existing_director') {
    const email = normalizeEmail(String(body?.email ?? ''));
    const requestedCentreName = String(body?.centre_name ?? '').trim();
    if (!EMAIL.test(email) || !requestedCentreName) {
      return json({ error: 'E-mail ou nom du centre invalide.' }, 400);
    }

    let existingUser: { id: string; email?: string } | null = null;
    const perPage = 1000;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return json({ error: 'Vérification du compte existant impossible : ' + error.message }, 500);
      }
      existingUser = (data.users ?? []).find((u) => normalizeEmail(u.email ?? '') === email) ?? null;
      if (existingUser || (data.users ?? []).length < perPage) break;
    }

    if (!existingUser) return json({ found: false });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, role, centre_id')
      .eq('id', existingUser.id)
      .maybeSingle();

    if (profileError) {
      return json({ error: 'Lecture du profil existant impossible : ' + profileError.message }, 500);
    }
    if (!profile || profile.role !== 'director' || !profile.centre_id) {
      return json({
        error: "Cette adresse e-mail est déjà associée à un compte, mais pas à un directeur de centre réutilisable. Aucun compte ni centre n'a été modifié.",
      }, 409);
    }

    const { data: centre, error: centreError } = await admin
      .from('centres')
      .select('id, nom, date_debut, date_expiration')
      .eq('id', profile.centre_id)
      .maybeSingle();

    if (centreError) {
      return json({ error: 'Lecture du centre existant impossible : ' + centreError.message }, 500);
    }
    if (!centre) {
      return json({
        error: "Le compte directeur existe, mais son centre associé est introuvable. Aucune donnée n'a été modifiée.",
      }, 409);
    }

    const normalizeName = (value: string) =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalizeName(centre.nom) !== normalizeName(requestedCentreName)) {
      return json({
        error: `Cette adresse appartient déjà au centre « ${centre.nom} ». Le centre demandé « ${requestedCentreName} » est différent ; aucune association n'a été modifiée.`,
      }, 409);
    }

    return json({
      found: true,
      centre_id: centre.id,
      director_user_id: existingUser.id,
      centre_nom: centre.nom,
      date_debut: centre.date_debut ?? null,
      date_expiration: centre.date_expiration ?? null,
    });
  }

  // ============================================================
  // ACTION : LIST
  // ============================================================

  if (action === 'list') {
    const centreId = String(body?.centre_id ?? '');

    if (!UUID.test(centreId)) {
      return json(
        {
          error: 'Centre invalide',
        },
        400,
      );
    }

    const { data: profs, error } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('centre_id', centreId)
      .eq('role', 'director');

    if (error) {
      return json(
        {
          error: 'Lecture impossible',
        },
        500,
      );
    }

    const directors = [];

    for (const p of profs ?? []) {
      const { data } = await admin.auth.admin.getUserById(p.id);

      directors.push({
        user_id: p.id,
        full_name: p.full_name ?? null,
        email: data?.user?.email ?? null,
      });
    }

    return json({
      directors,
    });
  }

  // ============================================================
  // ACTION : RESET
  // ============================================================

  if (action === 'reset') {
    const centreId = String(body?.centre_id ?? '');

    const userId = String(body?.user_id ?? '');

    const password = String(body?.password ?? '');

    if (!UUID.test(centreId)) {
      return json(
        {
          error: 'Centre invalide',
        },
        400,
      );
    }

    if (!UUID.test(userId)) {
      return json(
        {
          error: 'Utilisateur invalide',
        },
        400,
      );
    }

    if (!validPassword(password)) {
      return json(
        {
          error: 'Le mot de passe doit contenir entre 10 et 72 caractères.',
        },
        400,
      );
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, role, centre_id')
      .eq('id', userId)
      .maybeSingle();

    if (!target || target.role !== 'director' || target.centre_id !== centreId) {
      return json(
        {
          error: "Ce compte n'est pas un directeur de ce centre.",
        },
        404,
      );
    }

    const { data: cur } = await admin.auth.admin.getUserById(target.id);

    const { error } = await admin.auth.admin.updateUserById(target.id, {
      password,
      user_metadata: {
        ...(cur?.user?.user_metadata ?? {}),
        must_change: true,
      },
    });

    if (error) {
      return json(
        {
          error: 'Réinitialisation impossible : ' + error.message,
        },
        400,
      );
    }

    console.log(
      JSON.stringify({
        event: 'director_password_reset',
        by: claims.sub,
        target: target.id,
        centre: centreId,
      }),
    );

    return json({
      ok: true,
    });
  }

  // ============================================================
  // ACTION : CREATE_DIRECTOR
  // Centre existant sans directeur
  // ============================================================

  if (action === 'create_director') {
    const centreId = String(body?.centre_id ?? '');

    if (!UUID.test(centreId)) {
      return json(
        {
          error: 'Centre invalide',
        },
        400,
      );
    }

    const rawDirector =
      typeof body?.director === 'object' && body.director !== null
        ? (body.director as Record<string, unknown>)
        : {};

    const fullName = String(rawDirector.full_name ?? '').trim();

    const email = normalizeEmail(String(rawDirector.email ?? ''));

    const password = String(rawDirector.password ?? '');

    if (!fullName) {
      return json(
        {
          error: 'Le nom complet du directeur est obligatoire.',
        },
        400,
      );
    }

    if (!EMAIL.test(email)) {
      return json(
        {
          error: "L'adresse e-mail du directeur est invalide.",
        },
        400,
      );
    }

    if (!validPassword(password)) {
      return json(
        {
          error: 'Le mot de passe doit contenir entre 10 et 72 caractères.',
        },
        400,
      );
    }

    // Vérifier le centre
    const { data: centre, error: centreErr } = await admin
      .from('centres')
      .select('id, nom')
      .eq('id', centreId)
      .maybeSingle();

    if (centreErr) {
      return json(
        {
          error: 'Impossible de vérifier le centre.',
        },
        500,
      );
    }

    if (!centre) {
      return json(
        {
          error: "Ce centre n'existe pas.",
        },
        404,
      );
    }

    // Vérifier qu'il n'a pas déjà de directeur
    const { data: existingDirector } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('centre_id', centreId)
      .eq('role', 'director')
      .limit(1)
      .maybeSingle();

    if (existingDirector) {
      return json(
        {
          error: 'Ce centre possède déjà un directeur.',
        },
        409,
      );
    }

    // Créer le compte Auth
    const { user, error: authError } = await createDirectorAuth(admin, fullName, email, password);

    if (authError || !user) {
      if (authError && alreadyExistsError(authError.message)) {
        return json(
          {
            error:
              'Ce compte existe déjà dans SchoolPlans. Utilisez ce compte ou choisissez une autre adresse e-mail.',
          },
          409,
        );
      }

      return json(
        {
          error:
            'Création du compte directeur impossible : ' +
            (authError?.message ?? 'Erreur inconnue'),
        },
        400,
      );
    }

    // Finaliser le profil automatique
    const { error: profileError } = await finalizeDirectorProfile(
      admin,
      user.id,
      fullName,
      centreId,
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(user.id);

      return json(
        {
          error: 'Création du profil directeur impossible : ' + profileError.message,
        },
        500,
      );
    }

    console.log(
      JSON.stringify({
        event: 'director_created',
        by: claims.sub,
        target: user.id,
        centre: centreId,
      }),
    );

    return json(
      {
        ok: true,
        centre_id: centreId,
        director_user_id: user.id,
        message: 'Directeur créé avec succès.',
      },
      201,
    );
  }

  // ============================================================
  // ACTION : CREATE_CENTRE
  // Centre + directeur
  // ============================================================

  if (action === 'create_centre') {
    const rawCentre =
      typeof body?.centre === 'object' && body.centre !== null
        ? (body.centre as Record<string, unknown>)
        : {};

    const rawDirector =
      typeof body?.director === 'object' && body.director !== null
        ? (body.director as Record<string, unknown>)
        : {};

    const nom = String(rawCentre.nom ?? '').trim();

    const slug = String(rawCentre.slug ?? '')
      .trim()
      .toLowerCase();

    const actif = rawCentre.actif === undefined ? true : Boolean(rawCentre.actif);

    const fullName = String(rawDirector.full_name ?? '').trim();

    const email = normalizeEmail(String(rawDirector.email ?? ''));

    const password = String(rawDirector.password ?? '');

    // ----------------------------------------------------------
    // Validation centre
    // ----------------------------------------------------------

    if (!nom) {
      return json(
        {
          error: 'Saisissez le nom du centre.',
        },
        400,
      );
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return json(
        {
          error: 'Slug invalide : lettres minuscules, chiffres et tirets uniquement.',
        },
        400,
      );
    }

    // ----------------------------------------------------------
    // Validation directeur
    // ----------------------------------------------------------

    if (!fullName) {
      return json(
        {
          error: 'Le nom complet du directeur est obligatoire.',
        },
        400,
      );
    }

    if (!EMAIL.test(email)) {
      return json(
        {
          error: "L'adresse e-mail du directeur est invalide.",
        },
        400,
      );
    }

    if (!validPassword(password)) {
      return json(
        {
          error: 'Le mot de passe du directeur doit contenir entre 10 et 72 caractères.',
        },
        400,
      );
    }

    // ----------------------------------------------------------
    // Vérifier slug
    // ----------------------------------------------------------

    const { data: existingCentre } = await admin
      .from('centres')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingCentre) {
      return json(
        {
          error: 'Ce slug est déjà utilisé.',
        },
        409,
      );
    }

    // ----------------------------------------------------------
    // A. Créer le compte Auth
    // ----------------------------------------------------------

    const { user, error: authError } = await createDirectorAuth(admin, fullName, email, password);

    if (authError || !user) {
      if (authError && alreadyExistsError(authError.message)) {
        return json(
          {
            error:
              'Ce compte existe déjà dans SchoolPlans. Utilisez ce compte ou choisissez une autre adresse e-mail.',
          },
          409,
        );
      }

      return json(
        {
          error:
            'Création du compte directeur impossible : ' +
            (authError?.message ?? 'Erreur inconnue'),
        },
        400,
      );
    }

    // ----------------------------------------------------------
    // B. Préparer les données du centre
    // ----------------------------------------------------------

    const centreData: Record<string, unknown> = {
      nom,
      slug,
      actif,
    };

    if (rawCentre.type_abonnement !== undefined) {
      centreData.type_abonnement = rawCentre.type_abonnement || null;
    }

    if (rawCentre.statut_abonnement !== undefined) {
      centreData.statut_abonnement = rawCentre.statut_abonnement || null;
    }

    if (rawCentre.date_debut !== undefined) {
      centreData.date_debut = rawCentre.date_debut || null;
    }

    if (rawCentre.date_expiration !== undefined) {
      centreData.date_expiration = rawCentre.date_expiration || null;
    }

    if (rawCentre.droits !== undefined) {
      const droits = rawCentre.droits;

      if (typeof droits === 'object' && droits !== null && !Array.isArray(droits)) {
        centreData.droits = droits;
      } else {
        await admin.auth.admin.deleteUser(user.id);

        return json(
          {
            error: 'Les droits du centre sont invalides.',
          },
          400,
        );
      }
    }

    // ----------------------------------------------------------
    // C. Créer le centre
    // ----------------------------------------------------------

    const { data: createdCentre, error: centreError } = await admin
      .from('centres')
      .insert(centreData)
      .select('id, nom, slug')
      .single();

    if (centreError || !createdCentre) {
      await admin.auth.admin.deleteUser(user.id);

      if (centreError?.code === '23505') {
        return json(
          {
            error: 'Ce slug est déjà utilisé.',
          },
          409,
        );
      }

      return json(
        {
          error: 'Création du centre impossible : ' + (centreError?.message ?? 'Erreur inconnue'),
        },
        400,
      );
    }

    // ----------------------------------------------------------
    // D. Finaliser le profil directeur
    // ----------------------------------------------------------

    const { error: profileError } = await finalizeDirectorProfile(
      admin,
      user.id,
      fullName,
      createdCentre.id,
    );

    if (profileError) {
      // Retour arrière :
      // suppression du centre
      // puis suppression du compte Auth
      await admin.from('centres').delete().eq('id', createdCentre.id);

      await admin.auth.admin.deleteUser(user.id);

      return json(
        {
          error: 'Création du profil directeur impossible : ' + profileError.message,
        },
        500,
      );
    }

    // ----------------------------------------------------------
    // E. Succès
    // ----------------------------------------------------------

    console.log(
      JSON.stringify({
        event: 'centre_and_director_created',
        by: claims.sub,
        centre: createdCentre.id,
        director: user.id,
      }),
    );

    return json(
      {
        ok: true,
        centre_id: createdCentre.id,
        director_user_id: user.id,
        message: 'Centre et directeur créés avec succès.',
      },
      201,
    );
  }

  // ============================================================
  // ACTION INCONNUE
  // ============================================================

  return json(
    {
      error: 'Action inconnue',
    },
    400,
  );
});
