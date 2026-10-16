import { Navigate } from 'react-router-dom';
import { LoginPage } from '../modules/auth/LoginPage';
import { useAuth } from '../modules/auth/AuthProvider';
import { LoadingState } from '../components/ui';

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6">
        <LoadingState label="Vérification de votre session…" />
      </main>
    );
  }
  if (status === 'authenticated' || status === 'pending') {
    return <Navigate replace to="/app" />;
  }
  return <LoginPage />;
}
