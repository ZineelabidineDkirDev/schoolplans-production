# Matrice des permissions observées

## Règles communes

- Le rôle est lu depuis `profiles.role`. `admin`, `director` et `super_admin` sont tous affichés « Admin », mais `roleOriginal` et `me.sup` sont utilisés dans des branches différentes; les distinguer dans le modèle cible.
- Les droits centre sont récupérés via `mc_droit(p_droit)` pour un non-super-admin. Seule une réponse sans erreur et `data === true` active le droit; erreur ou valeur inconnue = refus. Le super-admin contourne ces droits côté interface.
- Les filtres `centre_id`, rôles d'UI et RPC visibles ne prouvent pas la sécurité côté base. RLS/Edge Functions/Storage sont **À vérifier dans Supabase**.

## Accès aux onglets et actions

| Rôle source | Accès/éléments explicitement visibles |
|---|---|
| `super_admin` | Planning et salles communs; gestion des centres, tableau de bord et profil centre dans les branches super-admin; sélection d'un centre actif, affichage à lecture seule d'un autre centre. Gestion d'accès directeur et réinitialisation de son mot de passe via Edge Function. Peut changer de centre et charger les données correspondantes. |
| `admin` | Onglets visibles dans le menu: planning, salles, formateurs, tableau de bord, historique, séances, supports, présences, inscriptions, étudiants, formations/groupes et profil du centre. Les droits centre peuvent retirer des onglets/fonctions. |
| `director` | Mêmes vues d'administration que le menu admin, mais sa valeur source est distincte; la barre de création rapide est explicitement liée à `roleOriginal === 'director'`. Certaines actions ne testent que le libellé `Admin`. |
| `formateur` | Planning, séances, « Mes étudiants » et présences; fiche formateur liée au compte requise. Filtrage de ses cours/étudiants; ne peut terminer une séance qu'après vérification du rattachement au cours; suppression de ses propres cours et de ses propres supports uniquement. Droits supports/présences ont une exception dans l'application des droits centre. |
| `etudiant` | Planning, salles, supports, mes cours et mes présences; cours limités aux inscriptions, données de présence propres au flux étudiant. Une demande `en_attente` mène à l'écran d'attente. |

## Clés de droits centre

Le chargeur `loadCentreDroits()` demande exactement : `etudiants`, `formateurs`, `cours`, `planning`, `salles`, `presences`, `certificats`, `supports`, `documents`, `statistiques`, `rapports`, `import_excel`, `export_excel`.

La liste d'édition `DROITS` contient également `seances`, `formations` et `groupes` (libellé « Statistiques » pour `groupes`). Or les contrôles d'onglets vérifient aussi `formations`, sans charger cette clé dans `CENTRE_DROITS`; résultat observable côté client : droit inactif par défaut pour ce contrôle. Les droits `groupes`/`seances` ne sont pas chargés non plus. À examiner avant portage; ne pas « corriger » en inventant une politique Supabase.

Correspondances d'onglets dans `appliquerDroitsCentre()` :

| Onglet | Droit(s) vérifié(s) |
|---|---|
| `vcal` planning | `planning` |
| `vl` séance | `cours` |
| `vr` salles | `salles` |
| `vk` supports/documents | `supports` ET `documents` |
| `vf` formateurs | `formateurs` |
| `vfg` formations/groupes | `formations` |
| `vp` présences | `presences` |
| `vs` étudiants | `etudiants` |
| `vc` certificats | `certificats` |
| `vd` tableau de bord | `statistiques` |

Le formulaire profile centre et les fonctions centrales ajoutent leurs propres vérifications JavaScript; elles restent une UX, pas une barrière de sécurité.
