 // Isli Formation : Edge Function "admin-users"
// Crée / réinitialise / supprime les comptes de connexion (formateurs, étudiants).
// Réservée à l'administrateur connecté par mot de passe.
//
// Version multi-centre (Jalon 5, étape 2). Les blocs modifiés sont repérés par « [ÉTAPE 2] ».
import { createClient } from  '@supabase/supabase-js';
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Mot de passe aléatoire de 12 caractères, sans caractères ambigus (0/O, 1/l/I)
function genPassword(n = 12) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => c[x % c.length]).join("");
}

// [ÉTAPE 2] Format d'un identifiant de centre
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// [ÉTAPE 2] Seuls ces comptes sont gérés ici ; directeurs et super administrateurs ne le sont jamais
const MANAGED_ROLES = ["formateur", "etudiant"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Vérifier que l'appelant est bien l'admin (connecté par mot de passe)
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await caller.rpc("est_admin");
    if (isAdmin !== true) {
      return json({ error: "Action réservée à l'administrateur connecté par mot de passe." }, 403);
    }

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    // [ÉTAPE 2] Identité, rôle et centre de l'appelant : lus côté serveur, jamais fournis par le client
    const { data: ud } = await caller.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    const callerId = ud?.user?.id;
    if (!callerId) return json({ error: "Non authentifié." }, 401);
    const { data: me } = await admin.from("profiles").select("role, centre_id").eq("id", callerId).maybeSingle();
    if (!me) return json({ error: "Profil introuvable." }, 403);
    const isSuper = me.role === "super_admin";

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse e-mail invalide." }, 400);

    async function findUser(e: string) {
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const u = data.users.find((x) => (x.email ?? "").toLowerCase() === e);
        if (u) return u;
        if (data.users.length < 200) return null;
        page++;
      }
    }
    // [ÉTAPE 2] remplace roleOf : rôle ET centre du compte visé
    async function profileOf(id: string) {
      const { data } = await admin.from("profiles").select("role, centre_id").eq("id", id).maybeSingle();
      return data as { role?: string; centre_id?: string | null } | null;
    }
    // [ÉTAPE 2] Un compte visé par reset/suppression doit être un formateur ou un étudiant de votre centre
    function targetRefusal(t: { role?: string; centre_id?: string | null } | null) {
      if (!t || !MANAGED_ROLES.includes(String(t.role))) {
        return json({ error: "Ce compte ne peut pas être modifié ici." }, 403);
      }
      if (!isSuper && t.centre_id !== me.centre_id) {
        return json({ error: "Ce compte appartient à un autre centre." }, 403);
      }
      return null;
    }

    // ---- Création d'un accès ----
    if (body.action === "create_user") {
      const role = body.role === "formateur" ? "formateur" : "etudiant";

      // [ÉTAPE 2] Centre cible, décidé côté serveur
      //   - par défaut : le centre de l'appelant ;
      //   - un centre_id fourni n'est accepté que du SUPER_ADMIN (les autres : uniquement leur propre centre).
      let centreId: string | null = me.centre_id ?? null;
      const asked = body.centre_id == null || body.centre_id === "" ? null : String(body.centre_id);
      if (asked !== null) {
        if (!UUID.test(asked)) return json({ error: "Centre invalide." }, 400);
        if (!isSuper && asked !== me.centre_id) {
          return json({ error: "Vous ne pouvez créer des comptes que dans votre centre." }, 403);
        }
        centreId = asked;
      }
      if (!centreId) return json({ error: "Aucun centre n'est associé à votre compte." }, 400);
      const { data: centre } = await admin.from("centres").select("id, actif").eq("id", centreId).maybeSingle();
      if (!centre) return json({ error: "Centre introuvable." }, 400);
      if (!isSuper && centre.actif === false) return json({ error: "Ce centre est suspendu." }, 403);

      // [ÉTAPE 2] Le formateur à relier doit appartenir à ce centre (vérifié AVANT de créer le compte)
      if (role === "formateur" && body.formateur_id) {
        const { data: f } = await admin.from("formateurs").select("id, centre_id").eq("id", body.formateur_id).maybeSingle();
        if (!f || f.centre_id !== centreId) return json({ error: "Ce formateur n'appartient pas à ce centre." }, 403);
      }

      if (await findUser(email)) {
        return json({ error: "Un compte existe déjà avec cet e-mail.", exists: true }, 409);
      }
      const password = genPassword();
      const fullName = String(body.full_name ?? "").slice(0, 80);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, must_change: true },
      });
      if (error || !data.user) return json({ error: error?.message ?? "Création impossible." }, 400);

      // [ÉTAPE 2] centre_id ajouté (avant : le profil gardait le centre par défaut posé par le trigger)
      const { error: pe } = await admin
        .from("profiles")
        .upsert({ id: data.user.id, full_name: fullName, role, statut: "approuve", centre_id: centreId });
      if (pe) {
        // [ÉTAPE 2] pas de compte à moitié créé : on retire le compte Auth qui vient d'être ajouté
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: "Profil non créé : " + pe.message }, 400);
      }
      if (role === "formateur" && body.formateur_id) {
        await admin.from("formateurs").update({ profile_id: data.user.id, email }).eq("id", body.formateur_id).eq("centre_id", centreId);
      }
      return json({ email, password });
    }

    // ---- Nouveau mot de passe ----
    if (body.action === "reset_password") {
      const u = await findUser(email);
      if (!u) return json({ error: "Aucun compte avec cet e-mail." }, 404);
      // [ÉTAPE 2] remplace le test « role === admin » : refuse tout compte privilégié et tout autre centre
      const refus = targetRefusal(await profileOf(u.id));
      if (refus) return refus;
      const password = genPassword();
      const { error } = await admin.auth.admin.updateUserById(u.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(u.user_metadata ?? {}), must_change: true },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ email, password });
    }

    // ---- Suppression d'un accès ----
    if (body.action === "delete_user") {
      const u = await findUser(email);
      if (!u) return json({ ok: true });
      // [ÉTAPE 2] idem
      const refus = targetRefusal(await profileOf(u.id));
      if (refus) return refus;
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});