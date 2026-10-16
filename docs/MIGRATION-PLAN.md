# SchoolPlans — plan de migration structurelle

## V1 — structure sans régression

- `index.html` conserve la structure visuelle actuelle.
- CSS déplacé vers `css/app.css`.
- JavaScript actuel conservé intégralement dans `js/app.js`.
- Services et backend préparés mais non branchés.

## V2 — premier domaine

Étudiants :

1. valider `get_my_centre_students()`;
2. brancher `studentService`;
3. extraire le rendu de « Mes étudiants »;
4. tester Nezha et Reda;
5. seulement ensuite passer au domaine suivant.

Avancement React : le repository et la vue en lecture seule « Mes étudiants » sont implémentés
sur le contrat RPC observé dans la référence. Les requêtes Supabase réelles n'ont pas été
exécutées : le SQL local reste une proposition et la validation de la RPC, des politiques RLS et
des données de test Nezha/Reda demeure obligatoire avant de déclarer le domaine validé ou de
commencer le domaine suivant.

## Domaines suivants

Cours → Inscriptions → Présences → Supports → Certificats → Licences → Centres.

## Gel

Google OAuth, design, responsive, multi-centre validé, feature flags et fonctionnalités déjà validées ne doivent pas être réécrits pendant cette migration.

## Portage de `legacy/vntest.html`

Le portage React vise l'ensemble des vues et actions inventoriées dans
[`INVENTAIRE_FONCTIONNEL.md`](./INVENTAIRE_FONCTIONNEL.md). Il est réalisé par lots vérifiables :
la référence HTML reste intacte et aucun SQL local ne doit être appliqué sans validation du
contrat Supabase distant.

| Domaine                                              | État React                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification, rôles et permissions               | Socle en place; contrats live à vérifier avec un compte de test.                                                                                                                                                                                                                                            |
| Mes étudiants (formateur)                            | Vue lecture seule et repository en place; RPC/RLS et jeu Nezha/Reda restent à vérifier.                                                                                                                                                                                                                     |
| Tableau de bord                                      | Vues admin/formateur, périodes, filtres, indicateurs et graphiques sont portés; la présentation React reprend maintenant les cartes, commandes, graphiques SVG et dispositions responsive de `vntest.html`. Validation Supabase/RLS complète à effectuer.                                                   |
| Gestion des centres (super-admin)                    | Liste, recherche, statut actif/suspendu, création centre/directeur et accès directeurs via Edge Functions; contrats live/RLS à valider.                                                                                                                                                                     |
| Planning et séances                                  | Consultation hebdomadaire, gestion des cours et jours fermés; feuilles de présence avec enregistrement présent/retard/absent; sélection d’une formation pour afficher sa progression. Contrat live/RLS non vérifié.                                                                                         |
| Vitrine publique et demandes/inscriptions            | La vitrine React reprend le hero produit, les fonctionnalités, les étapes, les bénéfices, les offres, la FAQ et le contact de la référence; les ancres, le menu responsive, la navigation vers la connexion et le formulaire mailto sont opérationnels. Les demandes et leur RLS restent à valider en live. |
| Formations, groupes et modules                       | Catalogue par centre avec création, modification et suppression de formations, association de modules, création/suppression de groupes et calcul de date de fin selon la durée; lectures et écritures live/RLS restent à valider.                                                                           |
| Profil du centre                                     | Formulaire des coordonnées et téléversement du logo dans le bucket observé `centre-logos`, réservé aux responsables rattachés au centre; contrat Storage/RLS à valider en environnement de test.                                                                                                            |
| Salles, formateurs, étudiants et présences           | Consultations responsives selon le style historique; formateurs/présences et étudiants en quatre colonnes sur grand écran; feuille de présence avec écriture des statuts. CRUD des salles, formateurs et étudiants et contrats live/RLS à valider.                                                          |
| Progression des formations                           | Calcul et affichage responsive d’une seule formation sélectionnée par clic dans le Planning : heures prévues (volume `heures_totales` ou repli sur le planning), réalisées, restantes et pourcentage; annulations et jours fermés exclus. Vérification du contrat live/RLS encore requise.                  |
| Gestion des étudiants, cours personnels et présences | Liste admin des étudiants avec recherche, groupe et cours; « Mes étudiants » formateur conservé; feuilles de présence par date avec enregistrement de présent/retard/absent. Création/modification/suppression des dossiers et inscription/retrait aux cours restent à porter.                              |
| Supports, Storage et certificats PDF                 | Supports consultables par rôle; téléversement formateur limité aux cours affectés; Storage `supports` avec liens signés 120 s et nettoyage en cas d'échec de métadonnées. Certificats centre-scopés, émis par admin/directeur et générés localement avec jsPDF 4.2.1. À vérifier avec Supabase/RLS.         |
| Mes cours et Mes présences                           | Pages étudiant reliées au dossier par l'e-mail exact et le centre actif; cours, historique des présences et supports restreints au dossier/inscriptions. Lien réel et RLS restent à confirmer.                                                                                                              |
| Historique                                           | Masqué avec explication tant que le schéma observé `connexions` ne fournit pas de filtre centre confirmé; aucune donnée multi-centre n'est exposée.                                                                                                                                                         |

Cet état d'avancement ne constitue pas une déclaration de parité. Les vues ou actions non portées
doivent rester signalées comme indisponibles dans la SPA; l'historique reste temporairement masqué
pour éviter une lecture non isolée par centre.

Les lots récents ajoutent les supports, certificats PDF, espaces étudiant et l'amélioration du
menu/vitrine. Les validations locales sont portées depuis les contrats observés, mais ne remplacent
pas les contraintes/RLS Supabase. Aucune mutation live ni modification de schéma n'a été effectuée.
Les opérations CRUD encore absentes pour les référentiels et les licences restent à migrer.
