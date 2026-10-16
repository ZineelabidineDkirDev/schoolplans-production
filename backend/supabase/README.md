# Backend Supabase — architecture cible

Ce dossier ne contient aucune migration appliquée. Il sert de dépôt versionné pour les RPC/RLS futurs.

Principes :
- isolation par `centre_id`;
- sécurité dans PostgreSQL/RLS;
- frontend = affichage et orchestration;
- RPC pour les opérations métier;
- Edge Functions uniquement pour les opérations nécessitant un contexte privilégié ou des intégrations externes.

**Important :** v1 n'exécute aucune modification Supabase.
