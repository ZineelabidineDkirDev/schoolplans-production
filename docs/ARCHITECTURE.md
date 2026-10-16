# Architecture observée et cible incrémentale

## État source

La référence effective est [`legacy/vntest.html`](../legacy/vntest.html), un document HTML unique contenant le balisage, les styles et un long script impératif. L'application s'initialise sur une seule page; les vues sont rendues en masquant/affichant des sections. Le client Supabase est global et la logique interface, requêtes et domaine est imbriquée dans le script. Aucun routeur d'URL, séparation de services, tests ou configuration de build React n'est visible dans ce fichier.

Le workspace contient aussi un `index.html`, `css/app.css`, `js/app.js`, des services JavaScript préparés mais explicitement non branchés, un plan structurel et un dossier backend de préparation. Ces fichiers ne remplacent pas la référence officielle et restent inchangés pendant l'initialisation.

## Cible de migration progressive

Le nouveau point d'entrée React sera `react-app.html`, indépendant de l'`index.html` existant; le code sera dans `src/`. Cette frontière permet d'exécuter/construire la nouvelle SPA sans couper l'ancienne. Chaque domaine pourra ensuite migrer derrière des composants/services testables : auth, centres/droits, formations/groupes/modules, formateurs, étudiants/inscriptions, cours/planning, présence, salles, supports, certificats, tableaux de bord/historique.

### Couches prévues

- `src/app`: démarrage et routeur React.
- `src/ui`: pages et navigation.
- `src/modules`: comportements de domaine par fonctionnalité.
- `src/business`: permissions, planning et calculs purs.
- `src/data`: client Supabase et repositories, seul niveau autorisé à porter les requêtes.
- `src/hooks`, `src/types`, `src/utils`, `src/styles`: état partagé et présentation.
- `supabase/`: uniquement définitions contrôlées/versionnées; aucune migration réelle n'est lancée par cette phase.

## Contrats d'architecture

- Le HTML historique et l'application `index.html` restent intacts.
- Les variables de navigateur ne sont pas une frontière de sécurité : RLS et fonctions existantes doivent demeurer responsables des restrictions multi-centres. Leur définition n'étant pas disponible, tout contrôle serveur est **À vérifier dans Supabase**.
- Les requêtes doivent conserver leurs filtres `centre_id`, appels RPC et Edge Functions observés; ne pas convertir une opération privilégiée en écriture frontend.
- Garder distincts le rôle original (`admin`, `director`, `super_admin`, `formateur`, `etudiant`) et son libellé d'interface.
- Garder les calculs de progression et les exceptions/formules de capacité à l'identique jusqu'à ce qu'un test de référence prouve le résultat.

## Frontière de cette phase

Le socle fournit React, TypeScript, Vite, React Router, le client Supabase depuis les variables d'environnement, le fournisseur de session, la connexion e-mail/mot de passe, Google OAuth, création de compte, changement obligatoire de mot de passe, contrôle d'accès aux routes et permissions centralisées. Le build inclut aussi l'entrée historique pour préserver la racine publiée; la SPA React s'ouvre sur `/react-app.html`.

Les vues métier restent des placeholders. Les demandes de nouveaux étudiants, le flux complet d'approbation, la sélection de centre super-admin et le contrôle d'un centre suspendu ne sont pas encore branchés; ils dépendent de flux et de contrats Supabase à valider. Aucune lecture/écriture de données métier ou modification de schéma n'est exécutée pendant l'initialisation. Le basculement de production est à décider après le portage fonctionnel.
