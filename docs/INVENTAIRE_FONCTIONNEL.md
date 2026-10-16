# Inventaire fonctionnel — SchoolPlans

## Périmètre et méthode

Source observée : [`legacy/vntest.html`](../legacy/vntest.html), 9 326 lignes. Le texte de cadrage cite `reference/vntest(2).html`, absent de ce workspace; cet inventaire utilise le fichier effectivement présent et fourni comme référence. Il s'agit d'une analyse statique du HTML/JavaScript, pas d'une exécution de l'application ni d'une inspection du projet Supabase distant.

## Vues et navigation

| Vue                          | Fonctionnalités relevées                                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitrine (`#landing`)         | Carrousel, domaines et formations présentés, approche, étapes, FAQ, contact et liens vers l'espace membre.                                                                              |
| Connexion (`#login`)         | E-mail/mot de passe, création de compte, Google OAuth et messages d'erreur.                                                                                                             |
| Demande en attente (`#pend`) | Statut en attente/refus, motif éventuel, actualisation et déconnexion.                                                                                                                  |
| Espace membre (`#app`)       | En-tête utilisateur, accueil, thème clair/sombre, notification et navigation par onglets. La navigation est un état de page dans un document unique; aucun routeur d'URL n'est visible. |
| Planning                     | Calendrier hebdomadaire, filtres formation/groupe/formateur/module/salle, séances récurrentes ou ponctuelles, annulations, fermetures et progression.                                   |
| Tableau de bord              | Indicateurs, graphiques, filtres et plages de dates; rendu différent pour les formateurs.                                                                                               |
| Séances                      | Liste/rendu de séances et actions sur les cours accessibles au rôle.                                                                                                                    |
| Salles                       | Liste, ajout, modification et suppression conditionnelle.                                                                                                                               |
| Supports                     | Liste, aperçu, téléchargement et dépôt de documents associés à un cours.                                                                                                                |
| Mes cours / Mes présences    | Consultation des cours inscrits et statistiques/détails des présences par l'étudiant.                                                                                                   |
| Formateurs / Mes étudiants   | Gestion des formateurs et consultation des étudiants associés aux cours du formateur.                                                                                                   |
| Présences                    | Sélection d'une date, état par étudiant et inscriptions/retraits au cours selon le rôle.                                                                                                |
| Inscriptions                 | Demandes Google, filtre d'état, approbation ou refus.                                                                                                                                   |
| Étudiants                    | Recherche, création/modification, affectation à un groupe et gestion des inscriptions aux cours.                                                                                        |
| Formations & Groupes         | Création/modification de formations et groupes, association de modules, capacité, formateur et dates.                                                                                   |
| Certificats                  | Création/enregistrement et génération/téléchargement PDF.                                                                                                                               |
| Historique                   | Consultation filtrable par profil et historique d'activité/connexion.                                                                                                                   |
| Profil du centre             | Coordonnées du centre et téléversement du logo.                                                                                                                                         |
| Gestion des centres          | Vue super administrateur : centres, statut, utilisateurs, droits et abonnement si les colonnes sont disponibles; création/modification, suspension/réactivation et accès directeur.     |

Les vues sont des panneaux DOM (`data-v`) activés par JavaScript, non des pages séparées.

## Rôles et comportement conditionnel constatés

Les valeurs de `profiles.role` sont traduites en rôles d'interface : `admin`, `director` et `super_admin` deviennent « Admin »; `formateur` devient « Formateur »; `etudiant` devient « Étudiant ». `roleOriginal` et `sup` conservent certaines distinctions. Le menu formateur comprend Planning, Séances, Mes étudiants, Présences et Supports; l'étudiant voit Planning, Salles, Supports, Mes cours et Mes présences; admin/directeur ont un menu plus large, dont les certificats. La gestion des centres et l'accès directeur sont réservés au super administrateur. Le compte admin ne peut pas s'authentifier avec Google.

Les droits centre sont demandés par `mc_droit(p_droit)` et les droits non confirmés sont désactivés (fail-closed). Voir la [matrice des permissions](MATRICE_PERMISSIONS.md) : certaines clés de droits ne sont pas chargées alors qu'elles sont consultées par l'interface.

## Formulaires, contrôles et validations

Les formulaires présents sont : contact (`lcf`), connexion (`lf`), certificat (`cf`), support (`kf`), groupe (`fgGroupeFormSubmit`), formation/modules (`fgFormationFormSubmit`), profil centre (`centreProfileForm`), cours (`af`), étudiant (`ef`), mot de passe (`pwf`), demande d'inscription (`insf`), fermeture (`ff`), module (`mf`), salle (`slf`), centre/droits (`zf`), réinitialisation directeur (`zpf`) et formateur (`tf`).

- HTML : champs e-mail/date/téléphone/nombre, `required`, `min`, `max` et `maxlength` notamment pour formation, groupe, salle, profil, certificat et contacts.
- Authentification : création exige e-mail et 6 caractères minimum; changement obligatoire de mot de passe exige 10 caractères minimum et confirmation. Le flux de réinitialisation directeur limite à 10–72 caractères et exige une confirmation.
- Cours : contrôle du groupe et de sa formation, module autorisé par la formation, dates du groupe, dimanche interdit, fin après début, disponibilité formateur/salle et capacité du groupe. Les inscriptions modifiées sont ensuite écrites dans `inscriptions`.
- Dépendances du formulaire de cours : groupes et modules sont filtrés côté requête par centre/formation; les étudiants et inscriptions sont chargés au préalable puis filtrés en mémoire par formation/groupe. Le portage doit préserver le résultat tout en évitant de récupérer des listes plus larges que nécessaire.
- Étudiant : prénom/nom obligatoires; l'affectation de groupe passe par `affecter_etudiant_groupe`; options proposées limitées aux groupes actifs/non complets, avec exception pour conserver l'affectation actuelle.
- Support : cours, titre et fichier requis; taille maximale 20 MiB; échec de l'insertion de métadonnées déclenche la suppression de l'objet téléversé.
- Espace étudiant : l'accès au dossier étudiant est résolu par l'adresse exacte de connexion et le centre du profil; les cours, présences et supports sont ensuite limités à cet identifiant et à ses inscriptions.
- Formation : nom requis et heures/semaine entre 0,5 et 168; modules sélectionnés sont associés par `formation_matieres`.
- Salle : nom/type requis, capacité 1–500, détection de doublon et refus de suppression si utilisée par un cours.
- Inscriptions : prénom, nom, ville, niveau et centre requis; refus avec motif facultatif.
- Réalisations : confirmation utilisateur, vérification du compte formateur associé au cours, écriture idempotente via upsert sur cours/date.

## Actions, règles métier et calculs

- Authentification Supabase, événements de session, sélection de centre super admin en `localStorage`, marqueur de connexion par session en `sessionStorage`, et déconnexion.
- Un cours récurrent/ponctuel est associé à un groupe; les conflits de salle/formateur sont contrôlés côté client et la base peut aussi répondre avec le code `23P01`.
- Une séance réalisée est identifiée par `cours_id|date`; les séances annulées et jours de fermeture sont exclus du calcul des heures.
- La progression formation affiche heures réalisées, prévues, restantes et pourcentage plafonné à 100. Les heures réalisées additionnent les durées des occurrences marquées réalisées, non annulées et non fermées; les heures prévues prennent `formations.heures_totales` si numérique, sinon un total estimé à partir du planning.
- Le taux de présence étudiant considère tout statut autre que `absent` comme présent dans le taux, avec compteurs distincts `present`, `retard`, `absent`.
- Les tableaux de bord agrègent étudiants, inscriptions, présences, demandes et occurrences de cours selon période et filtres.
- Certificat : création des métadonnées centre-scopées, génération locale et téléchargement PDF; jsPDF est chargé localement à la demande.
- Historique : l'interface React n'affiche aucun journal car la table `connexions` observée ne porte pas de `centre_id` vérifié; les lignes globales ne sont pas divulguées.
- Logo centre : stockage dans `centre-logos`; URL publique construite par le client.

## Intégrations et limites probatoires

- Supabase JS v2.45.4 et jsPDF 2.5.1 étaient chargés depuis jsDelivr dans la référence; l'application React utilise les dépendances npm et jsPDF 4.2.1 pour l'émission locale.
- RPC : `mc_droit`, `affecter_etudiant_groupe`, `get_my_centre_students`, `approuver_demande`, `refuser_demande`, `mc_role`, `mc_centre`.
- Edge Functions : `centre-director-access`, `admin-users`.
- Buckets observés : `supports` (upload, remove, URL signée 120 secondes) et `centre-logos` (upload, URL publique).
- Taille maximale observée pour un support : 20 MiB.
- Le dossier backend indique qu'aucune migration n'a été appliquée et ne contient pas de définition RLS. Les fonctions serveur, signatures réelles, contraintes, relations physiques, politiques RLS, ACL Storage et configuration OAuth sont **À vérifier dans Supabase**.
- `mc_role()` et `mc_centre()` apparaissent dans un bloc de diagnostic en fin du HTML; leur usage normal côté interface n'est pas établi par cette seule référence.

## Isolation centre : éléments à confirmer

Plusieurs requêtes ajoutent `centre_id` explicitement, notamment celles de centres, formations, groupes, étudiants, cours, présences, demandes, documents et salles. Le chargeur planning emploie aussi un helper qui ajoute ce filtre lorsque `CURRENT_CENTRE_ID` existe. D'autres accès passent par les RPC (notamment la liste d'étudiants du formateur) ou interrogent les catalogues/associations sans filtre centre visible dans cette requête. Ce constat n'établit pas une fuite : la portée réelle dépend des vues, fonctions et RLS. Vérifier toutes les politiques et le périmètre réel des tables/RPC dans Supabase avant le portage.

## Incohérences ou doublons à préserver puis résoudre explicitement

1. `calculerHeuresRealiseesToutesFormations`, `heuresCours` et `renderDashFormateur` sont définies plus d'une fois dans le même fichier; les dernières définitions peuvent masquer les précédentes.
2. Le bouton « Ajouter une formation » reçoit à la fois `onclick` et un `addEventListener`, ce qui peut ouvrir/initialiser le même formulaire deux fois.
3. Les clés `formations` et `groupes` apparaissent dans la liste `DROITS`, mais `loadCentreDroits()` ne charge pas ces clés; `droitActif()` les refuse donc pour un non-super-admin, alors que l'affichage de l'onglet les vérifie.
4. `director` est affiché comme « Admin » mais certaines actions testent `roleOriginal`, d'autres seulement `role`; ne pas réduire ces distinctions lors du portage.
5. Une seule SPA HTML embarque l'ensemble des onglets et logique; l'absence de routes URL fait partie du comportement actuel.

## Contrôle de la liste proposée

Les fonctionnalités listées dans le cadrage sont présentes lorsqu'elles correspondent aux vues et actions ci-dessus. Les licences ne constituent pas un écran autonome observé : les métadonnées d'abonnement sont affichées conditionnellement dans la gestion des centres et `licences_historique` est interrogée. Les clés `rapports`, `import_excel` et `export_excel` existent dans les droits, mais aucun écran/action correspondant n'a été confirmé dans l'interface de cette référence. Ne pas inventer ces vues.
