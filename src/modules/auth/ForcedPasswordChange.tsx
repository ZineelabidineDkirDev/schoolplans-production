import { useState, type FormEvent } from 'react';
import { Alert, Button, Field } from '../../components/ui';
import { useAuth } from './AuthProvider';

export function ForcedPasswordChange() {
  const { changePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères.');
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(password);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Impossible de mettre à jour le mot de passe.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="sp-auth-screen">
      <section className="sp-auth-card">
        <p className="sp-page-eyebrow">Sécurité du compte</p>
        <h1 className="sp-page-title">Choisissez un nouveau mot de passe</h1>
        <p className="sp-auth-description">
          Cette étape est obligatoire avant d’accéder à votre espace.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <form className="sp-auth-fields" onSubmit={handleSubmit}>
          <Field
            autoComplete="new-password"
            id="new-password"
            label="Nouveau mot de passe"
            minLength={10}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <Field
            autoComplete="new-password"
            id="confirm-password"
            label="Confirmer le mot de passe"
            minLength={10}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type="password"
            value={confirmation}
          />
          <Button className="sp-btn-full" disabled={submitting} type="submit">
            {submitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </Button>
        </form>
        <Button
          className="sp-btn-full sp-login-toggle"
          onClick={() => void signOut()}
          type="button"
          variant="secondary"
        >
          Se déconnecter
        </Button>
      </section>
    </main>
  );
}
