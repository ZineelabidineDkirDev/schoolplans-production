import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthenticatedRoutes, SectionPlaceholder } from '../modules/auth/AuthRoutes';
import { DashboardPage } from '../modules/dashboard/DashboardPage';
import { RapportCentrePage } from '../modules/dashboard/RapportCentrePage';
import { StudentPortalDashboardPage } from '../modules/students/StudentPortalDashboardPage';
import { useAuth } from '../modules/auth/AuthProvider';

function HomeByRole() {
  const { profile } = useAuth();
  if (profile?.role === 'etudiant') return <StudentPortalDashboardPage />;
  if (profile?.role === 'formateur') return <RapportCentrePage />;
  return <DashboardPage />;
}
import { LandingPage } from '../modules/public/LandingPage';
import { LegalPage } from '../modules/public/LegalPage';

const routerBasename =
  window.location.pathname === '/react-app.html' ||
  window.location.pathname.startsWith('/react-app.html/')
    ? '/react-app.html'
    : '/';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <LandingPage />,
    },
    {
      path: '/politique-confidentialite',
      element: <LegalPage />,
    },
    {
      path: '/conditions-generales-utilisation',
      element: <LegalPage />,
    },
    {
      path: '/mentions-legales',
      element: <LegalPage />,
    },
    {
      path: '/login',
      element: <App />,
    },
    {
      path: '/app',
      element: <AuthenticatedRoutes />,
      children: [
        {
          index: true,
          element: <HomeByRole />,
        },
        {
          path: ':section',
          element: <SectionPlaceholder />,
        },
      ],
    },
    {
      path: '*',
      element: (
        <main className="grid min-h-screen content-center gap-3 bg-canvas px-6 py-10">
          <p className="m-0 text-xs font-bold tracking-[.12em] text-accent-600 uppercase">
            Madrassa-Ti
          </p>
          <h1 className="m-0 text-3xl font-bold text-brand-900">Page introuvable</h1>
          <a
            className="w-fit font-semibold text-brand-900 underline-offset-4 hover:underline"
            href="/"
          >
            Retourner à l'accueil
          </a>
        </main>
      ),
    },
  ],
  { basename: routerBasename },
);
