-- Démo 14 jours : accès à tous les modules hors finance, avec expiration côté base.
-- Les centres existants ne sont pas modifiés : seuls les centres portant
-- explicitement droits.demo_14_jours = true sont soumis à cette règle.

create or replace function public.mc_droit(p_droit text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_centre_id uuid;
  v_droits jsonb;
  v_expiration timestamptz;
begin
  if auth.uid() is null then
    return false;
  end if;

  select p.role, p.centre_id
    into v_role, v_centre_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role = 'super_admin' then
    return true;
  end if;

  if p_droit not in (
    'etudiants', 'formateurs', 'cours', 'planning', 'salles',
    'presences', 'certificats', 'supports', 'documents',
    'statistiques', 'rapports', 'import_excel', 'export_excel',
    'seances', 'formations', 'groupes',
    'cours_en_ligne', 'gestion_financiere', 'notes_bulletins'
  ) then
    return false;
  end if;

  if v_role not in ('admin', 'director', 'formateur', 'etudiant')
     or v_centre_id is null then
    return false;
  end if;

  select c.droits::jsonb, c.date_expiration::timestamptz
    into v_droits, v_expiration
  from public.centres c
  where c.id = v_centre_id
    and c.actif = true
  limit 1;

  if v_droits is null then
    return false;
  end if;

  -- Une démo explicitement marquée expire à la date/heure enregistrée.
  -- Les abonnements existants non marqués comme démo ne sont pas affectés.
  if coalesce((v_droits ->> 'demo_14_jours')::boolean, false)
     and (v_expiration is null or v_expiration <= now()) then
    return false;
  end if;

  -- La finance reste exclue pendant la démo, même si le JSON est modifié par erreur.
  if coalesce((v_droits ->> 'demo_14_jours')::boolean, false)
     and p_droit = 'gestion_financiere' then
    return false;
  end if;

  return coalesce((v_droits ->> p_droit)::boolean, false);
end;
$$;

revoke all on function public.mc_droit(text) from public;
grant execute on function public.mc_droit(text) to authenticated;
