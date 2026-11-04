CREATE OR REPLACE FUNCTION public.prevent_director_planning_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'director'
     ) THEN
    RAISE EXCEPTION 'Le planning est en lecture seule pour le rôle directeur.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_director_planning_changes() FROM PUBLIC;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cours',
    'annulations',
    'fermetures',
    'seances_realisees'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS prevent_director_planning_changes ON public.%I',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER prevent_director_planning_changes BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_director_planning_changes()',
      table_name
    );
  END LOOP;
END;
$$;
