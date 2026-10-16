# Plan de tests de non-régression

## Socle d'authentification

Les tests unitaires couvrent les variables de configuration Supabase, le décodage sûr de l'identité de connexion par mot de passe, la conversion du profil et les règles centralisées d'accès par rôle/droit. Les parcours live (password/Google OAuth, récupération de session, lecture de `profiles`, RPC `mc_droit` et changement de mot de passe) exigent un projet Supabase de test; aucun compte réel n'est utilisé.

## « Mes étudiants » — formateur

- Les tests unitaires vérifient que la liste conserve l'ordre RPC, associe chaque étudiant à ses
  cours inscrits, ignore les références de cours/étudiants absentes et affiche `?` si une matière
  référencée n'est pas disponible.
- La permission centralisée réserve la route `vn` au rôle `formateur`.
- Le test d'intégration Supabase sur les comptes synthétiques Nezha et Reda, la RPC
  `get_my_centre_students()` et l'isolation RLS reste à exécuter sur un projet de test autorisé.

## Tableau de bord — centre et formateur

- Vitest couvre les périodes calendaires, l'exclusion des jours fermés/annulés, les filtres de
  cours, les taux de présence, les statuts de demandes et les agrégats par matière/domaine.
- Le rendu React reprend le dashboard de `vntest.html` : cartes KPI avec icônes, sélecteur de
  période, contrôles de graphiques, courbe SVG avec axes/grille/remplissage, diagramme en anneau,
  cartes de présence et tables responsives.
- Les lectures réelles, les autorisations RLS, les comptes super-admin/centre courant et les
  correspondances formateur-cours doivent encore être vérifiés avec un compte de test autorisé.
- Vérification locale du lot précédent : `npm test` (27 tests réussis), `npm run build`,
  `npm run lint` et `npx prettier --check` réussis. Vérification navigateur desktop/mobile du
  tableau de bord effectuée avec une session existante; aucune mutation Supabase n'a été lancée.

## Gestion des centres et Edge Functions

- Les tests Vitest vérifient le nom des Edge Functions invoquées et valident les formes de réponses
  `admin-users` et `centre-director-access`; les erreurs applicatives sont propagées.
- La suite locale complète compte maintenant 35 tests; les contrôles live restent à effectuer
  dans un environnement de test autorisé.
- Le lot React expose la liste/recherche des centres, la création centre+directeur, la suspension
  ou réactivation, la lecture des directeurs et la réinitialisation de leur mot de passe.
- Les appels live aux Edge Functions et l'écriture du statut centre restent à vérifier avec un
  compte super-admin et un centre de test autorisés. Aucun changement de schéma n'est appliqué.

## Demandes d'inscription — administration

- Vitest couvre le filtre du statut, l'isolation des lectures par centre, le tri `created_at`
  décroissant, la limite de 200 demandes, le mapping des champs et les réponses invalides.
- Les tests du repository vérifient les contrats `approuver_demande(did)` et
  `refuser_demande(did,motif)`, la transmission d'un motif vide en `null` et la propagation des
  erreurs RPC. La matrice d'accès réserve l'onglet à admin/director.
- La vue React reprend le filtre En attente/Approuvées/Refusées/Toutes, les actions d'approbation
  et de refus avec motif facultatif et l'affichage des coordonnées/statuts.
- Les RPC, leur contrôle de centre et leur comportement RLS doivent être vérifiés sur un projet de
  test autorisé. Aucun appel de décision live n'a été exécuté.
- Le parcours étudiant après connexion vérifie l'existence d'une demande, propose le formulaire
  avec les centres actifs et les niveaux d'études historiques, puis affiche l'état en attente ou le
  motif de refus. Les tests du repository vérifient le filtre par utilisateur, la lecture des
  centres actifs, le payload historique, la normalisation des champs facultatifs et les validations.
- Vérification locale du lot : `npm test` (51 tests réussis), `npm run build`, `npm run lint` et
  Prettier réussis. Aucune mutation Supabase n'a été lancée.
- Vérification après formulaire étudiant : `npm test` (57 tests réussis), `npm run build`,
  `npm run lint` et Prettier réussis. Aucun formulaire n'a été soumis à Supabase live.

## Répertoires et feuilles de présence

- Les salles reprennent la carte historique avec son état actuel, son occupation hebdomadaire
  heure par heure, sa capacité et ses heures libres. Les cartes Formateurs et Présences s’affichent
  par quatre sur grand écran et s’adaptent aux écrans plus étroits.
- La rubrique Étudiants propose une recherche et une carte moderne par dossier (quatre colonnes
  sur grand écran), avec identité, contact, ville, niveau, groupe et nombre de cours.
- Le Planning permet de cliquer une formation pour afficher sa progression détaillée seule;
  aucune progression ne s’affiche tant qu’aucune formation n’est sélectionnée.
- La rubrique Présences filtre par date, liste les cours actifs et leurs étudiants inscrits et
  enregistre les statuts Présent/Retard/Absent par upsert. Vitest couvre la portée centre, les
  effectifs de cours, le groupe étudiant, le payload d'upsert et la validation de date.
- Les pages de référentiels sont actuellement en consultation; les opérations CRUD d'étudiants,
  formateurs, salles, formations/groupes, inscriptions aux cours et catalogue de modules restent à
  porter. Les écritures de présence, les lectures live et la RLS n'ont pas été validées sur un
  projet autorisé.
- Vérification locale : `npm test` (61 tests réussis), `npm run build`, `npm run lint` et Prettier.

## Planning et séances — consultation et gestion des cours

- Vitest couvre le début de semaine du lundi, les occurrences récurrentes, les bornes de dates,
  les jours fermés, les indicateurs d'annulation/réalisation, les filtres et les créneaux libres
  d'une salle. Les règles métier couvrent également les dates et horaires, l'association formation-
  matière, la compétence du formateur, les conflits de salle/formateur et les choix automatiques.
- Les tests du repository vérifient qu'un centre est requis, que les tables métier sont filtrées
  par centre, que les cours d'un formateur sont restreints à sa fiche liée, que l'insertion utilise
  les colonnes historiques avec le centre actif et qu'une entrée invalide n'entraîne aucune écriture.
  Ils couvrent aussi l'upsert des fermetures, le libellé par défaut, le retrait limité au centre,
  le contrôle du rôle et la validation de date.
- Le calendrier responsive et la liste de séances affichent les filtres Formation/Groupe/
  Formateur/Module, les fermetures et les états d'annulation/réalisation. Les commandes de cours
  comprennent ajout/modification/suppression, annulation/rétablissement d'une occurrence et
  validation d'une séance par son formateur. L'administration du centre peut ajouter et retirer des
  jours fermés depuis une fenêtre responsive dédiée. Après clic sur une formation, sa progression
  affiche les heures prévues/réalisées/restantes et le pourcentage; aucune autre progression
  détaillée n’est affichée en même temps. Vitest vérifie le volume explicite, le
  repli sur les occurrences, les limites de groupe, les fermetures, les annulations et le plafond de
  progression.
- Les lectures live, la RLS et l'affichage super-admin avec centre actif doivent être vérifiés sur
  un projet autorisé. Les écritures live n'ont pas été exécutées.
- Vérification du lot progression : `npm test` (55 tests réussis), `npm run build`,
  `npm run lint` et Prettier réussis. Le build conserve deux avertissements existants relatifs au
  script legacy non-module dans `index.html` et à la taille d'un chunk; aucune mutation Supabase
  n'a été lancée.
- Vérification après ajout des jours fermés : `npm test` (45 tests réussis), `npm run build`,
  `npm run lint` et Prettier réussis. La fenêtre n'a pas été soumise dans le navigateur partagé,
  qui affichait la référence historique; aucune mutation Supabase n'a été lancée.

## Formations, groupes, profil du centre et vitrine publique

- Les tests du repository formations/groupes couvrent le calcul de date de fin, l'association des
  modules, les validations horaires et les mutations limitées au centre. Les tests profil couvrent
  la lecture/mise à jour du centre, la validation du nom et le refus des fichiers non-image.
- La vitrine expose les ancres de navigation, les liens vers la connexion, le carousel de tarifs
  responsive, la FAQ et un formulaire qui compose un mailto avec les valeurs saisies. Le logo est
  prévisualisé localement avant l’envoi vers le bucket observé `centre-logos`.
- Vérification locale : `npm test` (71 tests réussis), `npm run build`, `npm run lint` et
  `npx prettier --check` réussis. Le build conserve l’avertissement existant sur le script
  historique non-module et la taille d’un chunk.
- Aucune session Supabase autorisée n’était disponible : les écritures, politiques RLS et droits
  Storage restent à vérifier sur un projet de test. Aucune mutation live ni modification de base
  n’a été exécutée.

## État initial de la référence

La référence `legacy/vntest.html` n'inclut pas de tests automatisés. Playwright et serveur Supabase de test ne sont pas configurés. L'accès à Supabase n'est pas supposé; les tests du nouveau socle ne sont pas extrapolés aux écrans métier.

## Scénarios de référence à automatiser par lots

### Authentification et demandes

- Mot de passe valide/incorrect, message invalide, création de compte avec seuil de 6 caractères et état de confirmation e-mail.
- Google OAuth `select_account`; refus du flux Google pour un admin; déconnexion et restauration de session.
- Mot de passe obligatoire : 10 caractères minimum, correspondance, `must_change` retiré seulement après succès.
- Étudiant en attente/refusé (motif)/approuvé; formulaire exige prénom, nom, ville, niveau et centre; actualisation et déconnexion.

### Rôles et tenant

- Réponse true/false/erreur de `mc_droit`; erreur ou clé absente reste refusée; super-admin.
- Menus distincts par rôle et maintien de `roleOriginal` (`director` n'est pas confondu avec admin dans les actions spécifiques).
- Admin/directeur voient leurs données de centre; super-admin change de centre; pas de fuite entre centres sur les lectures, écritures, Storage, RPC et dashboards.
- Un super-admin consultant un centre différent ne crée/modifie pas de cours.

### Formation, groupes, étudiant et cours

- Heures hebdomadaires 0,5–168, dates/capacité/noms et association formation-modules.
- À la sélection du groupe, modules limités à sa formation; la matière invalide est remise à vide.
- Étudiants proposés selon inscription à un cours d'un groupe de la formation choisie; cas sans groupe/formation.
- Groupe : dates, capacité, formateur; groupes inactifs/complets exclus, sauf affectation actuelle.
- Cours : jour interdit (dimanche), fin > début, intervalle du groupe, disponibilité salle/formateur, conflit PostgreSQL, insertion/mise à jour/suppression et cohérence des inscriptions.

### Planning, présence, supports, certificats

- Occurrence récurrente/ponctuelle, semaine, fermeture, annulation/rétablissement et séance réalisée par formateur affecté.
- Progression testée avec heures prévues explicites, repli planning, dates hors limites, annulations, fermetures, réalisées et fraction d'heure; pourcentage plafonné à 100.
- Présence `present`/`retard`/`absent`, taux étudiant, retrait/ajout et rôle non autorisé.
- Support : plafond 20 MiB (limite exacte), upload/read/download/delete, URL signée 120 secondes; supprimer l'objet si l'insertion `documents` échoue; formateur ne supprime que son cours.
- Certificat : validation de l'étudiant, insertion, génération/téléchargement PDF et absence de jsPDF.

### Administration et statistiques

- Profil centre/logo, gestion centres, suspension, droits, gestion des accès directeur et changement de mot de passe.
- Historique et compteurs avec filtres profil/période; tableau de bord formateur limité à ses cours/étudiants/présences.

## Automatisation prévue

- Vitest pour calculs et permissions purs; tests de repositories avec client mocké.
- Tests d'intégration Supabase seulement sur projet de test avec données synthétiques.
- Playwright dans une phase ultérieure, après la première migration fonctionnelle et une stratégie de données de test sécurisée.
- Vérifier `npm run lint`, `npm run test`, `npm run build` pour chaque lot React. Tests impossible sans credentials : signaler la raison, ne pas utiliser de compte réel ni désactiver RLS.

## Supports, espace étudiant, certificats et vitrine

- Vitest couvre les validations de centre/e-mail et certificat, la limite de 20 MiB, l'absence de
  requête supports sans cours inscrits, l'interdiction de suppression hors des cours affectés et le
  nettoyage du stockage si l'insertion des métadonnées échoue.
- Les permissions réservent les certificats aux responsables de centre et les supports formateur
  aux droits `supports` + `documents`; l'étudiant voit uniquement la rubrique filtrée par son
  dossier, son centre et ses inscriptions.
- Les parcours locaux des pages « Mes cours », « Mes présences », Supports et Certificats sont
  implémentés. Les appels live Supabase, la correspondance réelle e-mail/dossier, RLS, Storage et
  téléchargement PDF dans le navigateur doivent encore être testés avec un environnement autorisé.
- L'historique reste non affiché tant que la portée centre de `connexions` n'est pas établie.
