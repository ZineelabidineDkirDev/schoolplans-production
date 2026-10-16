import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, LoadingState, PageHeader, SelectField } from '../../components/ui';
import {
  ENROLLMENT_EDUCATION_LEVELS,
  type ActiveEnrollmentCentre,
  type EnrollmentRequest,
  type EnrollmentRequestSubmission,
} from '../../types/enrollmentRequests';
import {
  createEnrollmentRequest,
  getActiveEnrollmentCentres,
  getEnrollmentRequestForUser,
} from '../../data/repositories/enrollmentRequestRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { AuthProfile } from '../../types/auth';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';

type PendingState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; request: EnrollmentRequest | null }
  | { status: 'submitted' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function PendingAccess() {
  const { profile, session, signOut } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<PendingState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    async function loadRequest() {
      if (!session?.user.id) {
        setState({
          status: 'error',
          message: 'Votre session ne permet pas de charger la demande.',
        });
        return;
      }
      setState({ status: 'loading' });
      try {
        const request = await getEnrollmentRequestForUser(getSupabaseClient(), session.user.id);
        if (active) setState({ status: 'loaded', request });
      } catch (error) {
        if (active) setState({ status: 'error', message: errorMessage(error) });
      }
    }
    void loadRequest();
    return () => {
      active = false;
    };
  }, [session?.user.id, reloadKey]);

  const request = state.status === 'loaded' ? state.request : null;
  const rejected = request?.status === 'refusee';
  const approved = request?.status === 'approuvee';
  const submitted = state.status === 'submitted';

  return (
    <main className="sp-pending-page">
      <div className={`sp-pending-card${!request && state.status === 'loaded' ? ' is-form' : ''}`}>
        <div className="sp-login-brand">
          <b className="sp-login-brand-mark">I</b>
          Isli Formation
        </div>

        {state.status === 'loading' && <LoadingState label="Chargement de votre demande…" />}

        {state.status === 'error' && (
          <div className="sp-pending-content">
            <PageHeader eyebrow="Demande d’inscription" title="Demande indisponible" />
            <Alert tone="error">{state.message}</Alert>
            <Button
              onClick={() => setReloadKey((key) => key + 1)}
              type="button"
              variant="secondary"
            >
              Réessayer
            </Button>
          </div>
        )}

        {state.status === 'loaded' && !request && session && profile && (
          <EnrollmentRequestForm
            onSubmitted={() => setState({ status: 'submitted' })}
            profile={profile}
            session={session}
            signOut={signOut}
          />
        )}

        {(submitted || request) && (
          <div className="sp-pending-content">
            <PageHeader
              eyebrow="Demande d’inscription"
              title={
                rejected
                  ? 'Demande non acceptée'
                  : approved
                    ? 'Demande approuvée'
                    : 'Demande en cours d’examen'
              }
            />
            <p className="sp-muted">
              {submitted
                ? 'Merci ! Votre demande a bien été envoyée. Vous aurez accès à votre espace dès qu’elle sera approuvée par l’administration.'
                : rejected
                  ? `Votre demande n’a pas été acceptée.${request.refusalReason ? ` Motif : ${request.refusalReason}.` : ''} Contactez l’administration du centre pour plus d’informations.`
                  : approved
                    ? 'Votre demande a été approuvée. Actualisez la page pour accéder à votre espace.'
                    : `${profile?.fullName ? `Bonjour ${profile.fullName}. ` : ''}Votre accès sera disponible après validation par l’administration du centre.`}
            </p>
            <div className="sp-pending-actions">
              <Button onClick={() => window.location.reload()} type="button">
                Actualiser
              </Button>
              <Button onClick={() => void signOut()} type="button" variant="secondary">
                Se déconnecter
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function EnrollmentRequestForm({
  profile,
  session,
  onSubmitted,
  signOut,
}: {
  profile: AuthProfile;
  session: Session;
  onSubmitted: () => void;
  signOut: () => Promise<void>;
}) {
  const fullNameValue = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name;
  const fullName =
    (typeof fullNameValue === 'string' && fullNameValue.trim()) || profile.fullName || '';
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const [centresState, setCentresState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; centres: ActiveEnrollmentCentre[] }
  >({ status: 'loading' });
  const [form, setForm] = useState<EnrollmentRequestSubmission>({
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    telephone: '',
    address: '',
    city: '',
    educationLevel: '',
    centreId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCentres() {
      try {
        const centres = await getActiveEnrollmentCentres(getSupabaseClient());
        if (active) setCentresState({ status: 'loaded', centres });
      } catch (cause) {
        if (active) setCentresState({ status: 'error', message: errorMessage(cause) });
      }
    }
    void loadCentres();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createEnrollmentRequest(
        getSupabaseClient(),
        session.user.id,
        session.user.email ?? '',
        form,
      );
      onSubmitted();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  function update<K extends keyof EnrollmentRequestSubmission>(
    key: K,
    value: EnrollmentRequestSubmission[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="sp-pending-content">
      <PageHeader
        eyebrow="Demande d’inscription"
        title="Finalisez votre inscription"
        description="Complétez ce formulaire. L’administration examinera votre demande avant de vous donner accès à votre espace."
      />

      {centresState.status === 'loading' && <LoadingState label="Chargement des centres…" />}
      {centresState.status === 'error' && <Alert tone="error">{centresState.message}</Alert>}
      {centresState.status === 'loaded' && centresState.centres.length === 0 && (
        <Alert tone="warning">Aucun centre de formation actif n’est disponible actuellement.</Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {centresState.status === 'loaded' && centresState.centres.length > 0 && (
        <form className="enrollment-request-form" onSubmit={submit}>
          <Field
            id="enrollment-first-name"
            label="Prénom"
            maxLength={40}
            onChange={(event) => update('firstName', event.target.value)}
            required
            value={form.firstName}
          />
          <Field
            id="enrollment-last-name"
            label="Nom"
            maxLength={40}
            onChange={(event) => update('lastName', event.target.value)}
            required
            value={form.lastName}
          />
          <Field
            id="enrollment-email"
            label="E-mail du compte Google"
            readOnly
            type="email"
            value={session.user.email ?? ''}
          />
          <Field
            id="enrollment-phone"
            label="Téléphone"
            maxLength={20}
            onChange={(event) => update('telephone', event.target.value)}
            type="tel"
            value={form.telephone}
          />
          <Field
            id="enrollment-address"
            label="Adresse"
            maxLength={80}
            onChange={(event) => update('address', event.target.value)}
            value={form.address}
          />
          <Field
            id="enrollment-city"
            label="Ville"
            maxLength={40}
            onChange={(event) => update('city', event.target.value)}
            required
            value={form.city}
          />
          <SelectField
            className="enrollment-request-form-wide"
            id="enrollment-centre"
            label="Centre de formation"
            onChange={(event) => update('centreId', event.target.value)}
            required
            value={form.centreId}
          >
            <option value="">Choisir votre centre…</option>
            {centresState.centres.map((centre) => (
              <option key={centre.id} value={centre.id}>
                {centre.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            className="enrollment-request-form-wide"
            id="enrollment-education-level"
            label="Niveau d’études"
            onChange={(event) =>
              update(
                'educationLevel',
                ENROLLMENT_EDUCATION_LEVELS.find((level) => level === event.target.value) ?? '',
              )
            }
            required
            value={form.educationLevel}
          >
            <option value="">Choisir…</option>
            {ENROLLMENT_EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </SelectField>
          <Button className="enrollment-request-form-wide" disabled={submitting} type="submit">
            {submitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
          </Button>
        </form>
      )}
      <div className="sp-pending-actions">
        <Button onClick={() => void signOut()} type="button" variant="secondary">
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
