import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/ui';
import { invokeCentreDirectorAccess } from '../../data/repositories/edgeFunctionRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { CentreDirector } from '../../data/repositories/edgeFunctionRepository';

type Centre = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

type CentreState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded';
      centres: Centre[];
      userCounts: Map<string, number>;
      warning: string | null;
    };

type CentreForm = {
  name: string;
  slug: string;
  directorName: string;
  directorEmail: string;
  password: string;
  confirmPassword: string;
};

type DirectorForm = {
  fullName: string;
  email: string;
  password: string;
};

const emptyForm: CentreForm = {
  name: '',
  slug: '',
  directorName: '',
  directorEmail: '',
  password: '',
  confirmPassword: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCentres(value: unknown): Centre[] {
  if (!Array.isArray(value)) throw new Error('La liste des centres reçue est invalide.');
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.nom !== 'string' ||
      typeof item.slug !== 'string' ||
      typeof item.actif !== 'boolean'
    ) {
      throw new Error('Une fiche centre ne contient pas les champs attendus.');
    }
    return { id: item.id, name: item.nom, slug: item.slug, active: item.actif };
  });
}

async function loadCentres(client: SupabaseClient): Promise<CentreState> {
  const { data, error } = await client
    .from('centres')
    .select('id, nom, slug, actif')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const centres = parseCentres(data);
  const userCounts = new Map<string, number>();
  let profileWarning: string | null = null;
  for (let offset = 0; ; offset += 1000) {
    const { data: profiles, error: profileError } = await client
      .from('profiles')
      .select('centre_id, role')
      .range(offset, offset + 999);
    if (profileError) {
      profileWarning = `Le nombre d’utilisateurs n’a pas pu être chargé : ${profileError.message}`;
      break;
    }
    for (const profile of profiles ?? []) {
      if (isRecord(profile) && typeof profile.centre_id === 'string') {
        userCounts.set(profile.centre_id, (userCounts.get(profile.centre_id) ?? 0) + 1);
      }
    }
    if (!profiles || profiles.length < 1000) break;
  }

  return {
    status: 'loaded',
    centres,
    userCounts,
    warning: profileWarning,
  };
}

export function CentreManagementPage() {
  const [state, setState] = useState<CentreState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CentreForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [selectedCentre, setSelectedCentre] = useState<Centre | null>(null);
  const [directors, setDirectors] = useState<CentreDirector[]>([]);
  const [directorLoading, setDirectorLoading] = useState(false);
  const [directorForm, setDirectorForm] = useState<DirectorForm>({
    fullName: '',
    email: '',
    password: '',
  });
  const [directorFormOpen, setDirectorFormOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<CentreDirector | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState(await loadCentres(getSupabaseClient()));
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Impossible de charger les centres.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredCentres = useMemo(() => {
    if (state.status !== 'loaded') return [];
    const query = search.trim().toLocaleLowerCase('fr');
    return state.centres.filter(
      (centre) =>
        !query ||
        centre.name.toLocaleLowerCase('fr').includes(query) ||
        centre.slug.toLocaleLowerCase('fr').includes(query),
    );
  }, [search, state]);

  async function createCentre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const email = form.directorEmail.trim().toLowerCase();
    const slug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      setMessage({
        tone: 'error',
        text: 'Slug invalide : lettres minuscules, chiffres et tirets uniquement.',
      });
      return;
    }
    if (form.password.length < 10 || form.password.length > 72) {
      setMessage({
        tone: 'error',
        text: 'Le mot de passe du directeur doit contenir entre 10 et 72 caractères.',
      });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ tone: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    setSaving(true);
    try {
      await invokeCentreDirectorAccess(getSupabaseClient(), {
        action: 'create_centre',
        centre: { nom: form.name.trim(), slug, actif: true },
        director: {
          full_name: form.directorName.trim(),
          email,
          password: form.password,
        },
      });
      setMessage({ tone: 'success', text: 'Centre et directeur créés avec succès.' });
      setForm(emptyForm);
      setFormOpen(false);
      await refresh();
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'La création du centre a échoué.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleCentre(centre: Centre) {
    const action = centre.active ? 'suspendre' : 'réactiver';
    if (
      !window.confirm(`${action === 'suspendre' ? 'Suspendre' : 'Réactiver'} « ${centre.name} » ?`)
    ) {
      return;
    }
    setMessage(null);
    try {
      const { data, error } = await getSupabaseClient()
        .from('centres')
        .update({ actif: !centre.active })
        .eq('id', centre.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Modification refusée : aucun centre n’a été mis à jour.');
      await refresh();
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'La modification du statut a échoué.',
      });
    }
  }

  async function showDirectors(centre: Centre) {
    setSelectedCentre(centre);
    setDirectors([]);
    setDirectorLoading(true);
    setMessage(null);
    try {
      const result = await invokeCentreDirectorAccess(getSupabaseClient(), {
        action: 'list',
        centre_id: centre.id,
      });
      if (!('directors' in result)) throw new Error('La liste des directeurs est indisponible.');
      setDirectors(result.directors);
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Impossible de charger les directeurs.',
      });
    } finally {
      setDirectorLoading(false);
    }
  }

  async function resetDirector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCentre || !resetTarget) return;
    if (resetPassword.length < 10 || resetPassword.length > 72) {
      setMessage({
        tone: 'error',
        text: 'Le mot de passe doit contenir entre 10 et 72 caractères.',
      });
      return;
    }
    if (resetPassword !== resetConfirmation) {
      setMessage({ tone: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await invokeCentreDirectorAccess(getSupabaseClient(), {
        action: 'reset',
        centre_id: selectedCentre.id,
        user_id: resetTarget.user_id,
        password: resetPassword,
      });
      setMessage({ tone: 'success', text: 'Mot de passe directeur réinitialisé.' });
      setResetTarget(null);
      setResetPassword('');
      setResetConfirmation('');
    } catch (cause) {
      setMessage({
        tone: 'error',
        text:
          cause instanceof Error ? cause.message : 'La réinitialisation du mot de passe a échoué.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function createDirector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCentre) return;
    if (directorForm.password.length < 10 || directorForm.password.length > 72) {
      setMessage({
        tone: 'error',
        text: 'Le mot de passe doit contenir entre 10 et 72 caractères.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await invokeCentreDirectorAccess(getSupabaseClient(), {
        action: 'create_director',
        centre_id: selectedCentre.id,
        director: {
          full_name: directorForm.fullName.trim(),
          email: directorForm.email.trim().toLowerCase(),
          password: directorForm.password,
        },
      });
      const list = await invokeCentreDirectorAccess(getSupabaseClient(), {
        action: 'list',
        centre_id: selectedCentre.id,
      });
      if (!('directors' in list)) throw new Error('La liste des directeurs est indisponible.');
      setDirectors(list.directors);
      setMessage({ tone: 'success', text: 'Directeur créé avec succès.' });
      setDirectorForm({ fullName: '', email: '', password: '' });
      setDirectorFormOpen(false);
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'La création du directeur a échoué.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        actions={
          <Button onClick={() => setFormOpen((open) => !open)} type="button">
            {formOpen ? 'Fermer le formulaire' : '+ Ajouter un centre'}
          </Button>
        }
        description="Centres de formation, accès directeurs et statut d’activité."
        eyebrow="Administration"
        title="Gérer les centres"
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {state.status === 'loaded' && state.warning && <Alert tone="warning">{state.warning}</Alert>}

      {formOpen && (
        <Panel>
          <h2 className="m-0 mb-4 text-lg font-bold text-brand-900">Nouveau centre et directeur</h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createCentre}>
            <Field
              label="Nom du centre"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              value={form.name}
            />
            <Field
              autoCapitalize="none"
              label="Slug"
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="centre-de-formation"
              required
              value={form.slug}
            />
            <Field
              className="md:col-span-2"
              label="Nom complet du directeur"
              onChange={(event) =>
                setForm((current) => ({ ...current, directorName: event.target.value }))
              }
              required
              value={form.directorName}
            />
            <Field
              autoComplete="email"
              label="E-mail du directeur"
              onChange={(event) =>
                setForm((current) => ({ ...current, directorEmail: event.target.value }))
              }
              required
              type="email"
              value={form.directorEmail}
            />
            <Field
              autoComplete="new-password"
              label="Mot de passe provisoire (10–72 caractères)"
              maxLength={72}
              minLength={10}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              type="password"
              value={form.password}
            />
            <Field
              autoComplete="new-password"
              label="Confirmer le mot de passe"
              maxLength={72}
              minLength={10}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              required
              type="password"
              value={form.confirmPassword}
            />
            <div className="flex items-end justify-end gap-2">
              <Button onClick={() => setFormOpen(false)} type="button" variant="secondary">
                Annuler
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? 'Création…' : 'Créer le centre'}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {state.status === 'loading' && (
        <Panel>
          <LoadingState label="Chargement des centres…" />
        </Panel>
      )}
      {state.status === 'error' && (
        <Alert className="space-y-3" tone="error">
          <p>{state.message}</p>
          <Button onClick={() => void refresh()} type="button" variant="secondary">
            Réessayer
          </Button>
        </Alert>
      )}

      {state.status === 'loaded' && (
        <>
          <Panel className="!p-4">
            <Field
              autoComplete="off"
              label="Rechercher un centre"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom ou slug…"
              value={search}
            />
          </Panel>
          {filteredCentres.length === 0 ? (
            <EmptyState
              description={
                search ? 'Essayez un autre nom ou slug.' : 'Ajoutez un centre pour commencer.'
              }
              title={search ? 'Aucun résultat.' : 'Aucun centre enregistré.'}
            />
          ) : (
            <Panel className="!p-0">
              <div className="sp-table-wrap">
                <table className="sp-table">
                  <thead>
                    <tr className="border-b border-line bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                      <th className="px-4 py-3 font-semibold">Centre</th>
                      <th className="px-4 py-3 font-semibold">Statut</th>
                      <th className="px-4 py-3 font-semibold">Utilisateurs</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCentres.map((centre) => (
                      <tr
                        className="border-b border-line last:border-0 hover:bg-slate-50/70"
                        key={centre.id}
                      >
                        <td data-label="Centre">
                          <strong className="block text-slate-900">{centre.name}</strong>
                          <span className="text-xs text-slate-500">{centre.slug}</span>
                        </td>
                        <td data-label="Statut">
                          <StatusBadge tone={centre.active ? 'success' : 'danger'}>
                            {centre.active ? 'Actif' : 'Suspendu'}
                          </StatusBadge>
                        </td>
                        <td data-label="Utilisateurs">{state.userCounts.get(centre.id) ?? '—'}</td>
                        <td data-label="Actions">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="min-h-9 px-3"
                              onClick={() => void showDirectors(centre)}
                              type="button"
                              variant="secondary"
                            >
                              Directeurs
                            </Button>
                            <Button
                              className="min-h-9 px-3"
                              onClick={() => void toggleCentre(centre)}
                              type="button"
                              variant="secondary"
                            >
                              {centre.active ? 'Suspendre' : 'Réactiver'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {selectedCentre && (
        <Panel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold tracking-[.12em] text-accent-600 uppercase">
                Accès du directeur
              </p>
              <h2 className="m-0 mt-1 text-lg font-bold text-brand-900">{selectedCentre.name}</h2>
            </div>
            <div className="flex gap-2">
              {directors.length === 0 && !directorLoading && (
                <Button
                  onClick={() => setDirectorFormOpen((open) => !open)}
                  type="button"
                  variant="secondary"
                >
                  {directorFormOpen ? 'Annuler' : 'Créer un directeur'}
                </Button>
              )}
              <Button
                onClick={() => {
                  setSelectedCentre(null);
                  setResetTarget(null);
                  setDirectorFormOpen(false);
                }}
                type="button"
                variant="quiet"
              >
                Fermer
              </Button>
            </div>
          </div>

          {directorLoading ? (
            <LoadingState label="Chargement des directeurs…" />
          ) : directors.length === 0 ? (
            <EmptyState title="Aucun directeur rattaché à ce centre." />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {directors.map((director) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"
                  key={director.user_id}
                >
                  <div>
                    <strong className="block">{director.full_name || 'Nom non renseigné'}</strong>
                    <span className="text-sm text-slate-600">
                      {director.email || 'E-mail non renseigné'}
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setResetTarget(director);
                      setResetPassword('');
                      setResetConfirmation('');
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Réinitialiser le mot de passe
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {directorFormOpen && (
            <form
              className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
              onSubmit={createDirector}
            >
              <p className="m-0 font-semibold text-slate-800 sm:col-span-2">
                Créer le compte directeur pour ce centre
              </p>
              <Field
                className="sm:col-span-2"
                label="Nom complet"
                onChange={(event) =>
                  setDirectorForm((current) => ({ ...current, fullName: event.target.value }))
                }
                required
                value={directorForm.fullName}
              />
              <Field
                autoComplete="email"
                label="E-mail"
                onChange={(event) =>
                  setDirectorForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={directorForm.email}
              />
              <Field
                autoComplete="new-password"
                label="Mot de passe provisoire (10–72 caractères)"
                maxLength={72}
                minLength={10}
                onChange={(event) =>
                  setDirectorForm((current) => ({ ...current, password: event.target.value }))
                }
                required
                type="password"
                value={directorForm.password}
              />
              <div className="flex justify-end sm:col-span-2">
                <Button disabled={saving} type="submit">
                  {saving ? 'Création…' : 'Créer le directeur'}
                </Button>
              </div>
            </form>
          )}

          {resetTarget && (
            <form
              className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
              onSubmit={resetDirector}
            >
              <p className="m-0 font-semibold text-slate-800 sm:col-span-2">
                Nouveau mot de passe pour {resetTarget.full_name || resetTarget.email}
              </p>
              <Field
                autoComplete="new-password"
                label="Nouveau mot de passe (10–72 caractères)"
                maxLength={72}
                minLength={10}
                onChange={(event) => setResetPassword(event.target.value)}
                required
                type="password"
                value={resetPassword}
              />
              <Field
                autoComplete="new-password"
                label="Confirmer le mot de passe"
                maxLength={72}
                minLength={10}
                onChange={(event) => setResetConfirmation(event.target.value)}
                required
                type="password"
                value={resetConfirmation}
              />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button onClick={() => setResetTarget(null)} type="button" variant="secondary">
                  Annuler
                </Button>
                <Button disabled={saving} type="submit">
                  {saving ? 'Réinitialisation…' : 'Confirmer'}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      )}
    </section>
  );
}
