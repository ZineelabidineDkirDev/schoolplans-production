# Madrassa-Ti

Le workspace contient l'application HTML/JavaScript historique et une nouvelle amorce React destinée à une migration progressive.

## Référence et application actuelle

- Référence comportementale fournie : [`legacy/vntest.html`](legacy/vntest.html). Le chemin `reference/vntest(2).html` cité dans le brief n'existe pas ici.
- L'`index.html` et les ressources legacy sont conservés inchangés.
- La nouvelle SPA React démarre sur `react-app.html`; aucun module métier legacy n'est encore migré.
- L'authentification e-mail/mot de passe, Google OAuth, sessions, changement obligatoire de mot de passe et permissions centralisées sont initialisés. Les demandes d'inscription, la sélection de centre super-admin et les vues métier restent à migrer.
- Le build conserve aussi `index.html`; Netlify publie les deux entrées. Le déploiement/cutover de la racine attendra les fonctionnalités métier et leur validation.

## Développement

```sh
npm install
npm run dev
npm run build
npm run test
npm run lint
```

Le serveur de développement ouvre la SPA React sur `/react-app.html`. Le build Vite produit ce point d'entrée dans `dist/`.

Copier `.env.example` vers `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Les clés `service_role` ne doivent jamais être exposées au navigateur. Ne pas committer de secrets.

L'application explique l'absence de configuration si ces valeurs ne sont pas fournies. Les permissions RPC et l'authentification live restent à vérifier avec un projet Supabase de test. Aucune migration de schéma n'est exécutée par ce client.

## Audit

Voir `docs/INVENTAIRE_FONCTIONNEL.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA_SUPABASE.md`, `docs/MATRICE_PERMISSIONS.md`, `docs/PLAN_MIGRATION.md` et `docs/TESTS_REGRESSION.md`. Les politiques RLS, le schéma appliqué, les Edge Functions et les ACL Storage restent à vérifier dans Supabase.
