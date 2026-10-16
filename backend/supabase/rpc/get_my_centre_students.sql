-- Préparation uniquement : NE PAS exécuter automatiquement.
-- Objectif : retourner les étudiants du centre du formateur connecté.
-- À valider sur le schéma/RLS actuel avant déploiement.

CREATE OR REPLACE FUNCTION public.get_my_centre_students()
RETURNS TABLE (
  id bigint,
  prenom text,
  nom text,
  email text,
  telephone text,
  ville text,
  centre_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.prenom, e.nom, e.email, e.telephone, e.ville, e.centre_id
  FROM public.etudiants e
  WHERE e.centre_id = public.mc_centre()
  ORDER BY e.nom, e.prenom;
$$;
