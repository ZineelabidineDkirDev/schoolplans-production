-- À exécuter manuellement dans Supabase après validation du schéma.
-- Permet à un formateur de choisir les étudiants non affectés de son centre
-- pour ses propres groupes de formation.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_formation_group_students(p_group_id text)
RETURNS TABLE (
  id bigint,
  prenom text,
  nom text,
  assigned boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_centre_id public.profiles.centre_id%TYPE;
  v_teacher_id public.formateurs.id%TYPE;
  v_group_id public.groupes.id%TYPE;
BEGIN
  SELECT p.centre_id
    INTO v_centre_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'formateur';

  IF v_centre_id IS NULL THEN
    RAISE EXCEPTION 'Profil formateur ou centre actif introuvable.';
  END IF;

  SELECT f.id
    INTO v_teacher_id
  FROM public.formateurs f
  WHERE f.profile_id = auth.uid()
    AND f.centre_id = v_centre_id;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Fiche formateur introuvable dans le centre actif.';
  END IF;

  SELECT g.id
    INTO v_group_id
  FROM public.groupes g
  WHERE g.id::text = p_group_id
    AND g.centre_id = v_centre_id
    AND g.formateur_id = v_teacher_id
    AND g.actif = true;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Groupe actif introuvable pour ce formateur.';
  END IF;

  RETURN QUERY
  SELECT e.id, e.prenom, e.nom, e.groupe_id = v_group_id
  FROM public.etudiants e
  WHERE e.centre_id = v_centre_id
    AND (e.groupe_id IS NULL OR e.groupe_id = v_group_id)
  ORDER BY e.nom, e.prenom;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_formation_group_students(
  p_group_id text,
  p_student_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_centre_id public.profiles.centre_id%TYPE;
  v_teacher_id public.formateurs.id%TYPE;
  v_group public.groupes%ROWTYPE;
  v_requested_count integer;
  v_available_count integer;
BEGIN
  SELECT p.centre_id
    INTO v_centre_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'formateur';

  IF v_centre_id IS NULL THEN
    RAISE EXCEPTION 'Profil formateur ou centre actif introuvable.';
  END IF;

  SELECT f.id
    INTO v_teacher_id
  FROM public.formateurs f
  WHERE f.profile_id = auth.uid()
    AND f.centre_id = v_centre_id;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Fiche formateur introuvable dans le centre actif.';
  END IF;

  SELECT g.*
    INTO v_group
  FROM public.groupes g
  WHERE g.id::text = p_group_id
    AND g.centre_id = v_centre_id
    AND g.formateur_id = v_teacher_id
    AND g.actif = true
  FOR UPDATE;

  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'Groupe actif introuvable pour ce formateur.';
  END IF;

  SELECT count(DISTINCT requested.id)
    INTO v_requested_count
  FROM unnest(coalesce(p_student_ids, ARRAY[]::text[])) AS requested(id);

  IF v_group.capacite IS NOT NULL AND v_group.capacite > 0
    AND v_requested_count > v_group.capacite THEN
    RAISE EXCEPTION 'La sélection dépasse la capacité du groupe (% étudiants).', v_group.capacite;
  END IF;

  PERFORM e.id
  FROM public.etudiants e
  WHERE e.centre_id = v_centre_id
    AND e.id::text = ANY(coalesce(p_student_ids, ARRAY[]::text[]))
  ORDER BY e.id
  FOR UPDATE;

  SELECT count(DISTINCT e.id)
    INTO v_available_count
  FROM public.etudiants e
  WHERE e.centre_id = v_centre_id
    AND e.id::text = ANY(coalesce(p_student_ids, ARRAY[]::text[]))
    AND (e.groupe_id IS NULL OR e.groupe_id = v_group.id);

  IF v_available_count <> v_requested_count THEN
    RAISE EXCEPTION 'Un étudiant sélectionné est introuvable dans le centre ou affecté à un autre groupe.';
  END IF;

  UPDATE public.etudiants e
  SET groupe_id = NULL
  WHERE e.centre_id = v_centre_id
    AND e.groupe_id = v_group.id
    AND NOT (e.id::text = ANY(coalesce(p_student_ids, ARRAY[]::text[])));

  UPDATE public.etudiants e
  SET groupe_id = v_group.id
  WHERE e.centre_id = v_centre_id
    AND e.id::text = ANY(coalesce(p_student_ids, ARRAY[]::text[]));
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_formation_group_students(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_my_formation_group_students(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_formation_group_students(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_formation_group_students(text, text[]) TO authenticated;

COMMIT;
