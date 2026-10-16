import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import {
  canAccessSection,
  getVisibleSections,
  getRoleLabel,
  SECTION_LABELS,
} from '../../business/permissions/permissions';
import { useAuth } from './AuthProvider';
import { getSupabaseClient } from '../../data/supabase/client';
import { ForcedPasswordChange } from './ForcedPasswordChange';
import { PendingAccess } from './PendingAccess';
import { MyStudentsPage } from '../students/MyStudentsPage';
import { DashboardPage } from '../dashboard/DashboardPage';
import { PlanningPage } from '../planning/PlanningPage';
import { Alert, Button, LoadingState, ThemeToggle } from '../../components/ui';
import { CentreManagementPage } from '../centres/CentreManagementPage';
import { EnrollmentRequestsPage } from '../enrollments/EnrollmentRequestsPage';
import {
  AttendancePage,
  FormationGroupsPage,
  RoomsPage,
  StudentsPage,
  TeachersPage,
} from '../management/DirectoryPages';
import { CentreProfilePage } from '../management/CentreProfilePage';
import { CertificatesPage } from '../management/CertificatesPage';
import { HistoryPage } from '../management/HistoryPage';
import { SupportsPage } from '../management/SupportsPage';
import { StudentWorkspacePage } from '../students/StudentWorkspacePage';
import type { AppSection } from '../../types/auth';

export function AuthenticatedRoutes() {
  const { status, error, signOut } = useAuth();

  if (status === 'loading') {
    return (
      <main className="sp-login-loading">
        <LoadingState label="Chargement de votre espace…" />
      </main>
    );
  }
  if (status === 'anonymous' || status === 'configuration_error') {
    return <Navigate replace to="/login" />;
  }
  if (status === 'pending') return <PendingAccess />;
  if (status === 'error') {
    return (
      <main className="sp-error-page">
        <p className="sp-page-eyebrow">Connexion interrompue</p>
        <h1 className="sp-page-title">Impossible de charger votre profil</h1>
        <Alert tone="error">{error}</Alert>
        <Button className="w-fit" onClick={() => void signOut()} type="button">
          Se déconnecter
        </Button>
      </main>
    );
  }

  return <AuthenticatedContent />;
}

function AuthenticatedContent() {
  const { mustChangePassword } = useAuth();
  if (mustChangePassword) return <ForcedPasswordChange />;
  return <ApplicationShell />;
}

function ApplicationShell() {
  const {
    profile,
    session,
    permissions,
    permissionErrors,
    error: authError,
    signOut,
    setActiveCentreId,
  } = useAuth();
  const [centres, setCentres] = useState<{ id: string; nom: string }[]>([]);
  const [centresLoading, setCentresLoading] = useState(false);
  const [centresError, setCentresError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'super_admin') return;
    let active = true;

    async function loadCentres() {
      setCentresLoading(true);
      setCentresError(null);
      const { data, error } = await getSupabaseClient()
        .from('centres')
        .select('id, nom, actif')
        .eq('actif', true)
        .order('nom');

      if (!active) return;
      if (error) {
        setCentresError(error.message);
        setCentres([]);
        setCentresLoading(false);
        return;
      }

      const available = (data ?? []).filter(
        (centre) => typeof centre.id === 'string' && typeof centre.nom === 'string',
      );
      setCentres(available.map(({ id, nom }) => ({ id, nom })));
      setCentresLoading(false);

      if (!available.some((centre) => centre.id === profile.centreId)) {
        setActiveCentreId(available[0]?.id ?? null);
      }
    }

    void loadCentres();
    return () => {
      active = false;
    };
  }, [profile, setActiveCentreId]);

  if (!profile) return null;

  const visibleSections = getVisibleSections(profile.role, permissions);

  return (
    <div className="sp-app">
      <header className="sp-app-header">
        <Link className="sp-app-brand" to="/app">
          <b className="sp-app-brand-mark">I</b>
          <span>SchoolPlans</span>
        </Link>
        {profile.role === 'super_admin' && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
            <label className="whitespace-nowrap text-xs font-semibold text-white" htmlFor="sp-centre-select">
              Centre actif
            </label>
            <select
              className="min-h-9 max-w-[220px] min-w-[150px] rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900"
              disabled={centresLoading || centres.length === 0}
              id="sp-centre-select"
              onChange={(event) => setActiveCentreId(event.target.value || null)}
              value={profile.centreId ?? ''}
            >
              {centres.length === 0 && <option value="">Aucun centre actif</option>}
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.nom}
                </option>
              ))}
            </select>
            {centresError && (
              <small className="w-full text-xs text-red-200">{centresError}</small>
            )}
          </div>
        )}
        <div aria-label="Utilisateur connecté" className="sp-user">
          <strong>{profile.fullName || session?.user.email}</strong>
          <small>{getRoleLabel(profile.role)}</small>
        </div>
        <Link
          aria-label="Accueil (reste connecté)"
          className="sp-icon-button"
          title="Accueil"
          to="/app"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m4 11 8-7 8 7v9h-5v-6H9v6H4z" />
          </svg>
        </Link>
        <ThemeToggle />
        <Button
          className="sp-header-logout"
          onClick={() => void signOut()}
          type="button"
          variant="secondary"
        >
          Déconnexion
        </Button>
      </header>

      <div className="sp-app-wrap">
        <nav aria-label="Navigation principale" className="sp-app-nav">
          <NavLink className={({ isActive }) => navItemClass(isActive)} end to="/app">
            <NavIcon section="home" />
            <span className="sp-nav-label">Accueil</span>
          </NavLink>
          {visibleSections.map((section) => (
            <NavLink
              className={({ isActive }) => navItemClass(isActive)}
              key={section}
              to={`/app/${section}`}
            >
              <NavIcon section={section} />
              <span className="sp-nav-label">{SECTION_LABELS[section]}</span>
            </NavLink>
          ))}
        </nav>

        <main className="sp-app-content">
          {authError && <Alert tone="error">{authError}</Alert>}
          {permissionErrors.length > 0 && (
            <Alert tone="warning">
              Impossible de confirmer certains droits centre ({permissionErrors.join(', ')}). Les
              rubriques associées restent indisponibles. Contactez l’administration si cela
              persiste.
            </Alert>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function navItemClass(isActive: boolean) {
  return `sp-nav-link${isActive ? ' active' : ''}`;
}

function NavIcon({ section }: { section: AppSection | 'home' }) {
  const paths: Record<string, string> = {
    home: 'm4 11 8-7 8 7v9h-5v-6H9v6H4z',
    vcal: 'M4 5h16v15H4zM8 3v4m8-4v4M4 10h16',
    vd: 'M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3',
    vl: 'M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5',
    vr: 'M4 20h16M6 20V5h12v15M9 9h2m2 0h2m-6 4h2m2 0h2m-4 7v-4h3v4',
    vk: 'M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5',
    vm: 'M4 5h16v14H4zM8 9h8m-8 4h5',
    vq: 'M5 12l4 4L19 6',
    vf: 'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m6-7a4 4 0 0 1 0 8m2 3h2a3 3 0 0 1 3 3v1',
    vp: 'M12 3v18m-8-9h16M5 6h14v12H5z',
    vn: 'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-2h4m-2-2v4',
    vi: 'M4 5h16v14H4zM8 9h8m-8 4h5',
    vs: 'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    vfg: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    vc: 'M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6zM9 12l2 2 4-4',
    vh: 'M12 7v5l3 2m5-2a8 8 0 1 1-2.3-5.7M20 4v5h-5',
    vpcentre: 'M3 20h18M5 20V7l7-4 7 4v13M9 10h1m4 0h1m-6 4h1m4 0h1m-4 6v-4h3v4',
    vz: 'M3 20h18M5 20V5h14v15M8 9h8m-8 4h8m-8 4h5',
  };

  return (
    <svg aria-hidden="true" className="sp-nav-icon" viewBox="0 0 24 24">
      <path d={paths[section]} />
    </svg>
  );
}

export function SectionPlaceholder() {
  const { section } = useParams();
  const { profile, permissions } = useAuth();

  if (!profile || !section || !canAccessSection(profile.role, section, permissions)) {
    return (
      <section className="sp-page">
        <h1 className="sp-page-title">Accès indisponible</h1>
        <p className="sp-muted">
          Cette rubrique n’est pas autorisée pour votre rôle ou votre centre.
        </p>
      </section>
    );
  }

  if (section === 'vn') return <MyStudentsPage />;
  if (section === 'vd') return <DashboardPage />;
  if (section === 'vcal') return <PlanningPage />;
  if (section === 'vl') return <PlanningPage view="sessions" />;
  if (section === 'vi') return <EnrollmentRequestsPage />;
  if (section === 'vz') return <CentreManagementPage />;
  if (section === 'vr') return <RoomsPage />;
  if (section === 'vf') return <TeachersPage />;
  if (section === 'vp') return <AttendancePage />;
  if (section === 'vs') return <StudentsPage />;
  if (section === 'vfg') return <FormationGroupsPage />;
  if (section === 'vpcentre') return <CentreProfilePage />;
  if (section === 'vk') return <SupportsPage />;
  if (section === 'vm') return <StudentWorkspacePage view="courses" />;
  if (section === 'vq') return <StudentWorkspacePage view="attendance" />;
  if (section === 'vc') return <CertificatesPage />;
  if (section === 'vh') return <HistoryPage />;

  return (
    <section className="sp-page">
      <p className="sp-page-eyebrow">Rubrique sélectionnée</p>
      <h1 className="sp-page-title">{SECTION_LABELS[section]}</h1>
      <p className="sp-muted">
        Cette rubrique n’a pas encore été migrée. Consultez l’application historique pour continuer
        à utiliser la fonctionnalité.
      </p>
    </section>
  );
}
