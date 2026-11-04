# Backend Supabase — architecture cible

Ce dossier contient les migrations et RPC versionnées, mais aucune modification Supabase n'est exécutée automatiquement depuis l'application.

Principes :
- isolation par `centre_id`;
- sécurité dans PostgreSQL/RLS;
- frontend = affichage et orchestration;
- RPC pour les opérations métier;
- Edge Functions uniquement pour les opérations nécessitant un contexte privilégié ou des intégrations externes.

**Important :** appliquer les migrations/RPC manuellement dans Supabase SQL Editor après validation du schéma.

Les scripts `rpc/` sont à appliquer manuellement dans Supabase SQL Editor. Le script
`rpc/manage_my_formation_group_students.sql` ajoute les RPC utilisées par le formateur pour
composer le roster de ses groupes : il propose les étudiants non affectés ou déjà inscrits à un
groupe de la même formation, et PostgreSQL vérifie le centre, le formateur et la capacité avant
l'enregistrement. Appliquer également la migration `202611020002_director_planning_read_only.sql`
pour refuser les écritures de planning du rôle directeur au niveau de la base de données.
