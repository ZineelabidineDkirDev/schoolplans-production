-- À exécuter manuellement dans Supabase après validation du schéma.
-- DROP est nécessaire si le type de retour de la fonction existante diffère.
-- Sans CASCADE, PostgreSQL refusera la suppression si un objet en dépend.

BEGIN;

DROP FUNCTION IF EXISTS public.get_my_centre_students();

CREATE FUNCTION public.get_my_centre_students()
RETURNS TABLE (
  id bigint,
  prenom text,
  nom text,
  email text,
  telephone text,
  ville text,
  centre_id uuid,
  groupe_id text,
  groupe_nom text,
  formation_nom text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.prenom,
    e.nom,
    e.email,
    e.telephone,
    e.ville,
    e.centre_id,
    g.id::text,
    g.nom,
    formation.nom
  FROM public.etudiants e
  LEFT JOIN public.formateurs f
    ON f.profile_id = auth.uid()
   AND f.centre_id = e.centre_id
  LEFT JOIN public.groupes g
    ON g.id = e.groupe_id
   AND g.centre_id = e.centre_id
   AND g.formateur_id = f.id
  LEFT JOIN public.formations formation
    ON formation.id = g.formation_id
   AND formation.centre_id = g.centre_id
  WHERE e.centre_id = (
    SELECT p.centre_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'formateur'
  )
    AND f.id IS NOT NULL
  ORDER BY e.nom, e.prenom;
$$;

REVOKE ALL ON FUNCTION public.get_my_centre_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_centre_students() TO authenticated;

COMMIT;
