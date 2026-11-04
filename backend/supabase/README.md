# Backend Supabase — architecture cible

Ce dossier ne contient aucune migration appliquée. Il sert de dépôt versionné pour les RPC/RLS futurs.

Principes :
- isolation par `centre_id`;
- sécurité dans PostgreSQL/RLS;
- frontend = affichage et orchestration;
- RPC pour les opérations métier;
- Edge Functions uniquement pour les opérations nécessitant un contexte privilégié ou des intégrations externes.

**Important :** v1 n'exécute aucune modification Supabase.

Les scripts `rpc/` sont à appliquer manuellement dans Supabase SQL Editor. Le script
`rpc/manage_my_formation_group_students.sql` ajoute les RPC utilisées par le formateur pour
composer le roster de ses groupes : il ne propose que les étudiants non affectés ou déjà affectés
à ce groupe, et PostgreSQL vérifie le centre, le formateur et la capacité avant l'enregistrement.
