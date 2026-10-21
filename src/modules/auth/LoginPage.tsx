import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Alert, Button, Field, LoadingState } from '../../components/ui';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { status, error: sessionError, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <main className="sp-login-loading">
        <LoadingState label="Vérification de votre session…" />
      </main>
    );
  }
  if (status === 'authenticated' || status === 'pending') {
    return <Navigate replace to="/app" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'signUp' && password.length < 6) {
      setError('Saisissez un mot de passe de 6 caractères minimum.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage('Compte créé. Vérifiez votre boîte e-mail pour confirmer votre adresse.');
        setMode('signIn');
        setPassword('');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de traiter la demande.';
      setError(
        mode === 'signIn' && /invalid/i.test(message)
          ? 'Adresse e-mail ou mot de passe incorrect.'
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La connexion Google a échoué.');
      setSubmitting(false);
    }
  }

  const visibleError = error ?? sessionError;

  return (
    <main className="sp-login">
      <aside className="sp-login-aside">
        <div className="sp-login-brand">
          <span aria-hidden="true" className="sp-landing-mark sp-login-site-mark"><i /><i /><i /></span>
          <span>School<span className="sp-login-brand-accent">Plans</span></span>
        </div>
        <div>
          <h1>Votre planning, clair et à jour.</h1>
          <p>Séance, formateurs et salles réunis dans un seul calendrier.</p>
        </div>
        <div aria-label="Pôles de formation" className="sp-login-poles">
          {['Langues', 'Bureautique', 'Data & IT', 'Mathématiques', 'IT'].map((pole) => (
            <span key={pole}>{pole}</span>
          ))}
        </div>
      </aside>

      <section aria-labelledby="auth-title" className="sp-login-main">
        <div className="sp-login-form">
          <Link className="sp-chip sp-login-back" to="/">
            ← Accueil
          </Link>
          <h2 id="auth-title">{mode === 'signIn' ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="sp-subtitle">
            {mode === 'signIn' ? 'Accédez à votre espace.' : 'Créez votre espace membre.'}
          </p>

          {status === 'configuration_error' && (
            <Alert className="sp-login-alert" tone="error">
              {sessionError}
              <p>
                Créez un fichier <code>.env</code> ou <code>.env.local</code> à partir de{' '}
                <code>.env.example</code>, renseignez les valeurs du projet, puis redémarrez Vite.
              </p>
            </Alert>
          )}
          {visibleError && status !== 'configuration_error' && (
            <div className="sp-inline-error" role="alert">
              {visibleError}
            </div>
          )}
          {status === 'error' && (
            <Button
              className="sp-btn-full sp-btn-ghost"
              onClick={() => void signOut()}
              type="button"
              variant="secondary"
            >
              Se déconnecter et réessayer
            </Button>
          )}
          {message && (
            <div className="sp-inline-error sp-inline-success" role="status">
              {message}
            </div>
          )}

          <form autoComplete="on" className="sp-login-fields" onSubmit={handleSubmit}>
            <Field
              autoComplete="email"
              id="email"
              label="Adresse e-mail"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <Field
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              id="password"
              label="Mot de passe"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <Button className="sp-btn-full sp-btn-submit" disabled={submitting} type="submit">
              {submitting
                ? 'Veuillez patienter…'
                : mode === 'signIn'
                  ? 'Se connecter'
                  : 'Créer un compte'}
            </Button>
          </form>

          <Button
            className="sp-btn-full sp-login-toggle"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setMessage(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
            type="button"
            variant="secondary"
          >
            {mode === 'signIn' ? 'Créer un compte' : 'J’ai déjà un compte'}
          </Button>

          <div className="sp-login-divider">
            <span>ou</span>
          </div>
          <Button
            className="sp-btn-full sp-btn-google"
            disabled={submitting}
            onClick={() => void handleGoogleSignIn()}
            type="button"
            variant="secondary"
          >
            <svg aria-hidden="true" className="sp-google-icon" viewBox="0 0 48 48">
              <path
                d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
                fill="#EA4335"
              />
              <path
                d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"
                fill="#4285F4"
              />
              <path
                d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
                fill="#FBBC05"
              />
              <path
                d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
                fill="#34A853"
              />
            </svg>
            S’inscrire ou se connecter avec Google
          </Button>
        </div>
      </section>
    </main>
  );
}
