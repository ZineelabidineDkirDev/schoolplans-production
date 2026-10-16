# Schéma Supabase observable depuis le client

## Limite de source

Ce relevé ne constitue pas le schéma PostgreSQL. Il décrit uniquement les noms de tables, colonnes sélectionnées/écrites et relations utilisées dans [`legacy/vntest.html`](../legacy/vntest.html) ainsi que le SQL proposé dans `backend/supabase/rpc/get_my_centre_students.sql`. Le README backend indique qu'aucune migration n'a été appliquée. Contraintes, types réels, clés étrangères, fonctions installées, RLS, triggers, index et relations physiques : **À vérifier dans Supabase**.

## Tables observées

| Table                  | Usage / colonnes déductibles des requêtes                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | `id`, `full_name`, `role`, `statut`, `centre_id`; compteurs par rôle et centre.                                                                                                                            |
| `centres`              | `id`, `nom`, `slug`, `actif`, `droits`; coordonnées `telephone`, `email`, `ville`, `adresse`, `logo_url`; abonnement conditionnel `type_abonnement`, `statut_abonnement`, `date_debut`, `date_expiration`. |
| `formations`           | `id`, `nom`, `duree`, `heures_par_semaine`, `heures_totales`, `description`, `actif`, `centre_id`.                                                                                                         |
| `groupes`              | `id`, `nom`, `formation_id`, `formateur_id`, `date_debut`, `date_fin`, `capacite`, `actif`, `centre_id`.                                                                                                   |
| `domaines`             | `id`, `nom`.                                                                                                                                                                                               |
| `matieres`             | `id`, `code`, `nom`, `icone`, `domaine_id`.                                                                                                                                                                |
| `centre_matieres`      | `matiere_id` et associations au catalogue centre.                                                                                                                                                          |
| `formation_matieres`   | `formation_id`, `matiere_id`.                                                                                                                                                                              |
| `formateurs`           | `id`, `nom`, `profile_id`, `email`, `centre_id`.                                                                                                                                                           |
| `formateur_matieres`   | `formateur_id`, `matiere_id`.                                                                                                                                                                              |
| `salles`               | `id`, `nom`, `type`, `capacite`, `centre_id`.                                                                                                                                                              |
| `cours`                | Utilisé en `*`; champs explicitement utilisés : `id`, `centre_id`, `matiere_id`, `formateur_id`, `salle_id`, `groupe_id`, `jour`, `debut`, `fin`, `valable_du`, `valable_au`.                              |
| `annulations`          | `cours_id`, `date`, centre via helper de requête lorsqu'applicable.                                                                                                                                        |
| `fermetures`           | `date`, `libelle`, `centre_id`; upsert avec conflit déclaré `centre_id,date`.                                                                                                                              |
| `seances_realisees`    | `cours_id`, `date`, `centre_id`; upsert avec conflit déclaré `cours_id,date`.                                                                                                                              |
| `etudiants`            | `id`, `prenom`, `nom`, `email`, `telephone`, `ville`, `adresse`, `niveau_etudes`, `groupe_id`, `centre_id`.                                                                                                |
| `inscriptions`         | `cours_id`, `etudiant_id`, `centre_id`; `created_at` utilisé dans des agrégats.                                                                                                                            |
| `presences`            | `cours_id`, `date`, `etudiant_id`, `statut`, `centre_id`, `created_at`. Upsert déclaré sur cours/date/étudiant.                                                                                            |
| `demandes_inscription` | `id`, `user_id`, `prenom`, `nom`, `email`, `telephone`, `adresse`, `ville`, `niveau_etudes`, `centre_id`, `statut`, `motif`, `created_at`.                                                                 |
| `documents`            | `id`, `cours_id`, `titre`, `description`, `fichier_path`, `nom_fichier`, `taille`, `type_mime`, `centre_id`, `created_at`.                                                                                 |
| `certificats`          | `id`, `etudiant_id`, `module`, `date_debut`, `date_fin`, `heures`, `mention`, `centre_id`, `created_at`.                                                                                                   |
| `connexions`           | `user_id`, `email`, `full_name`, `role`, `methode`; journal de connexion.                                                                                                                                  |
| `licences_historique`  | `centre_id`, `created_at`; historique interrogé par l'interface/services.                                                                                                                                  |

Le champ `formations` est aussi utilisé comme relation imbriquée depuis `groupes` (`formations(nom)`); l'existence d'une FK et sa cardinalité sont **À vérifier dans Supabase**. Les relations fonctionnelles `groupes → formations`, `cours → groupes/formateurs/salles/matières`, `inscriptions → cours/étudiants`, `presences → cours/étudiants` sont inférées des filtres et jointures frontend, pas garanties par le code fourni.

## RPC et fonctions Edge

RPC appelées : `mc_droit(p_droit)`, `affecter_etudiant_groupe(p_etudiant_id,p_groupe_id)`, `get_my_centre_students()`, `approuver_demande(did)`, `refuser_demande(did,motif)`, `mc_role()`, `mc_centre()`.

Le module React « Mes étudiants » consomme `get_my_centre_students()` pour les étudiants du
formateur, puis lit les inscriptions et les cours filtrés par `centre_id`; les matières sont
utilisées pour restituer le libellé affiché par la référence. La RPC locale décrite ci-dessus
reste non appliquée et ce chemin n'a pas été vérifié contre un projet Supabase réel.

Le module React Inscriptions liste `demandes_inscription` avec les champs observés dans la
référence, filtre systématiquement sur le `centre_id` du profil et limite la lecture aux 200
demandes récentes (`created_at` décroissant), avec filtre facultatif sur `statut`. Les actions
appellent les RPC historiques `approuver_demande(did)` et `refuser_demande(did,motif)`; le motif
vide est transmis comme `null`. Les RPC, la portée centre effective et les politiques RLS doivent
être vérifiés sur un projet de test autorisé; aucune décision live n'a été exécutée.

Le parcours authentifié de demande d'inscription lit les centres actifs (`centres(id,nom)` filtré
sur `actif=true`) et cherche la demande de l'utilisateur avec `demandes_inscription.user_id`. Si
aucune demande n'existe, il insère les champs observés dans la référence (`user_id`, `email`,
`prenom`, `nom`, `telephone`, `adresse`, `ville`, `niveau_etudes`, `centre_id`); il ne transmet
pas de statut ni de date supposés. La lecture et l'insertion doivent être vérifiées avec les
politiques RLS du projet de test autorisé.

Le tableau de bord React lit aussi, selon le rôle, `cours`, `formateurs`, `etudiants`,
`inscriptions`, `presences`, `demandes_inscription`, `annulations`, `fermetures`, `matieres`,
`domaines`, `formations`, `groupes` et `salles`. Les sélections de centre sont limitées au
`centre_id` du profil courant; l'isolation effective doit être confirmée par RLS sur un projet de
test. La sélection de centre super-admin n'étant pas encore migrée, un compte sans centre courant
reçoit un état d'erreur explicite plutôt que des statistiques agrégées sans filtre.

Le module React Planning/Séances lit `cours`, `formateurs`, `salles`,
`groupes`, `formations`, `formation_matieres`, `matieres`, `domaines`,
`annulations`, `fermetures` et `seances_realisees`. Les ressources propres au centre sont
filtrées avec `centre_id`; les matières, domaines et tables d'association sont lues selon les
relations observées dans la référence. Les opérations de gestion de cours écrivent dans `cours`
avec les colonnes `matiere_id`, `formateur_id`, `salle_id`, `groupe_id`, `jour`, `debut`, `fin`,
`valable_du`, `valable_au` et `centre_id`; les insertions/modifications/suppressions sont
scopées au centre actif. Les annulations/rétablissements utilisent `annulations`; la validation
d'une séance utilise `seances_realisees` et est limitée au formateur lié. Ces contrats sont
déduits de la référence et implémentés côté client, mais les relations, contraintes, politiques RLS
et réponses réelles restent à vérifier sur un projet de test autorisé. Aucune écriture live ni
modification de schéma n'a été effectuée.

La progression de la formation sélectionnée lit également `formations.heures_totales`. Les
occurrences des cours de chaque formation sont générées entre les dates du cours et bornées par
celles du groupe; les annulations et fermetures sont exclues. Le volume prévu
utilise `heures_totales` lorsque cette valeur est numérique, sinon le total des heures du planning.
Les heures réalisées proviennent de `seances_realisees`. Ce calcul n'ajoute ni table ni colonne et
n'a pas été validé contre un projet Supabase live.

Les nouvelles pages de consultation réutilisent les lectures centre-scopées du repository Planning
pour `salles`, `formateurs`, `formations`, `groupes`, `cours` et les associations de matières. La
page admin Étudiants lit `etudiants(id,prenom,nom,email,telephone,ville,adresse,niveau_etudes,groupe_id)`,
les groupes et `inscriptions(etudiant_id,cours_id)` avec `centre_id`.

La feuille de présence lit les étudiants, groupes, inscriptions et `presences(cours_id,date,
etudiant_id,statut)` pour la date et les cours du centre. Le statut est enregistré par upsert sur le
conflit observé `cours_id,date,etudiant_id`, avec `centre_id`. Ces lectures et écritures reproduisent
le client historique; politiques RLS et contraintes physiques restent à valider sur un projet de
test autorisé.

La gestion des jours fermés ajoute/met à jour `fermetures(date,libelle,centre_id)` avec le conflit
`centre_id,date`; le retrait filtre sur la date et le centre actif. Le formulaire et le repository
réservent cette action aux profils admin/director qui disposent du droit Planning. L'accès et les
contraintes réels restent à valider en environnement de test; aucune écriture live n'a été
effectuée.

Le module Formations & Groupes écrit dans `formations(nom,duree,heures_par_semaine,description,
actif,centre_id)` et met à jour/supprime les lignes en filtrant par `centre_id`. Les associations
de modules sont synchronisées dans `formation_matieres(formation_id,matiere_id)`. Un nouveau
module est inséré dans `matieres(nom,code,domaine_id,icone)`, puis associé au centre par
`centre_matieres(centre_id,matiere_id)`; ces deux étapes ne sont pas transactionnelles. La création
d'un groupe utilise `groupes(nom,formation_id,formateur_id,date_debut,date_fin,actif,capacite,
centre_id)`; la date de fin est dérivée de la durée de la formation. Ces écritures suivent les
colonnes observées dans la référence mais les contraintes et les autorisations RLS restent à
confirmer en environnement de test.

Edge Functions définies dans `backend/edge-functions` : `centre-director-access` (actions `list`,
`reset`, `create_director`, `create_centre`) et `admin-users` (`create_user`, `reset_password`,
`delete_user`). Le repository React appelle ces fonctions via `supabase.functions.invoke`; aucun
secret de service n'est envoyé au navigateur. Les actions privilégiées ne sont pas vérifiées en
live dans le projet Supabase.

La page React « Gérer les centres » lit `centres(id,nom,slug,actif)` et `profiles(centre_id,role)`,
met à jour `centres.actif` selon le contrat existant dans la référence, et utilise
`centre-director-access` pour créer un centre avec son directeur, lister les directeurs et
réinitialiser leur mot de passe. L'autorisation effective et les champs disponibles doivent être
confirmés sur le projet de test; aucun schéma ni aucune donnée n'a été modifié pendant le portage.

Le fichier SQL local propose `get_my_centre_students()` en `SECURITY DEFINER`, filtrant par `public.mc_centre()`; il n'est pas la preuve que cette fonction existe en production. Les signatures/erreurs, droits EXECUTE, `search_path` effectif et comportement des autres fonctions sont **À vérifier dans Supabase**.

## Storage

- `supports`: les objets sont nommés `cours_id/timestamp-nom`; opérations observées : upload, suppression et URL signée de 120 secondes. Les métadonnées vont dans `documents`.
- `centre-logos`: chemin `centre_id/timestamp-nom`, upload, URL publique persistée dans `centres.logo_url`.

Visibilité, politiques Storage, limites serveur, MIME autorisés et règles de suppression sont **À vérifier dans Supabase**.

## Contrats portés pour supports, espace étudiant et certificats

- Supports : React lit `documents` avec `centre_id` et trie par `created_at` décroissant. L'étudiant dont le dossier correspond à son e-mail exact dans le centre n'obtient que les documents des cours associés à ses inscriptions. Les fichiers sont stockés dans le bucket `supports`, sous `cours_id/timestamp-nom`, limités à 20 MiB et servis par URL signée à expiration de 120 secondes. Le formateur peut supprimer uniquement un support associé à l'un de ses cours affectés. Si l'insertion des métadonnées échoue après l'upload, l'objet est supprimé; une erreur de nettoyage est signalée explicitement.
- Cours et présences étudiant : résolution du dossier via `etudiants(centre_id,email)`, puis lectures de `inscriptions`, `cours` et `presences` filtrées sur le centre et l'identifiant étudiant. Aucun fallback vers le premier étudiant de la table n'est autorisé.
- Certificats : lecture des 200 certificats récents filtrés par `centre_id`; création limitée aux responsables admin/directeur, avec les colonnes observées (`etudiant_id`, `module`, `date_debut`, `date_fin`, `heures`, `mention`, `centre_id`). Le PDF est généré localement avec jsPDF 4.2.1 et ne nécessite pas de bucket.
- Historique : les requêtes observées vers `connexions` ne démontrent pas de `centre_id` ni de politique RLS adéquate; la SPA n'affiche donc pas les lignes globales. Aucun changement de schéma ou de politique n'a été fait.

Les filtres côté client décrivent les contrats observés, mais ne remplacent pas les politiques RLS. La correspondance de l'e-mail étudiant, les règles Storage, la portée des certificats et leur autorisation doivent être vérifiées sur un projet Supabase de test autorisé.
