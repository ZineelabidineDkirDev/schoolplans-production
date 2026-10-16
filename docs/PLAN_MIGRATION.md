# Plan de migration incrémentale

## Phase A — Audit (réalisée dans cette livraison)

- Source lue : `legacy/vntest.html` (9 326 lignes); le chemin `reference/vntest(2).html` du cadrage n'existe pas dans le workspace.
- Livrables : inventaire fonctionnel, architecture, relevé Supabase, matrice de droits, plan et tests de régression.
- Aucun changement à la référence HTML ni aux fichiers de l'application legacy.

## Phase B — Initialisation (socle Auth et permissions en place)

- Ajout de React, TypeScript, Vite, React Router, client Supabase, Vitest, ESLint et Prettier.
- Entrée parallèle `react-app.html` pour laisser `index.html` historique intact.
- Types source des rôles, profil Auth, connexion e-mail/mot de passe, Google OAuth, création de compte et changement obligatoire de mot de passe.
- Fournisseur de session, routes protégées, navigation par rôle, permissions centralisées et accès centre fail-closed via `mc_droit`.
- Écrans métier en placeholders explicites; aucune migration de schéma ni modification de données Supabase exécutée.

## Lots suivants

1. **Vérification Supabase** : confirmer les colonnes/états réels de `profiles`, le RPC `mc_droit`, OAuth, le déclencheur profil et les politiques RLS sur un projet de test.
2. **Centre courant et inscriptions** : formulaire des demandes, sélection de centre super-admin, statut suspendu et vérification server-side de l'isolation tenant.
3. **Catalogue et ressources** : formations, groupes, modules, formateurs et salles.
4. **Cours et planning** : formulaires dépendants, filtres, conflits, calendrier, fermeture/annulation et calculs de progression.
5. **Étudiants et présence** : dossiers, affectations, inscriptions, présences, vues par rôle.
6. **Supports et certificats** : Storage, nettoyage après échec des métadonnées, URL signées, PDF.
7. **Tableaux de bord, historique et administration** : statistiques, demandes, centre, comptes, droits et historique.
8. **Basculement** : comparer avec la référence, tests e2e, décision d'URL/Netlify et retrait legacy uniquement sur décision explicite.

Les lots peuvent être réordonnés si les contrats Supabase réels l'exigent. Ne pas exécuter de migration SQL destructive et ne pas désactiver RLS.

## Conditions de sortie d'un lot métier

- Diff limité au module, type partagé ou repository nécessaire.
- Tests unitaires des règles métier et permissions; intégration Supabase seulement avec environnement autorisé.
- Vérification des comportements source concernés, y compris erreur, loading, conditions de rôle et séparation centre.
- Mise à jour des docs et liste explicite des points Supabase « À vérifier ».
- L'ancien HTML reste le comparateur et n'est pas supprimé.
