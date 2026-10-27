import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';

type PlatformStats = {
  centres: number; activeCentres: number; inactiveCentres: number; users: number;
  pendingDemos: number; pendingSubscriptions: number;
  starterCentres: number; standardCentres: number; professionalCentres: number;
  directors: number; trainers: number; students: number; superAdmins: number;
  approvedDemos: number; rejectedDemos: number;
  contactedSubscriptions: number; paidSubscriptions: number; rejectedSubscriptions: number;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; stats: PlatformStats };

async function countRows(
  table: 'centres' | 'profiles' | 'demo_requests' | 'subscription_requests',
  filters?: { column: string; value: string | boolean | null; operator?: 'eq' | 'is' }[],
): Promise<number> {
  let query = getSupabaseClient().from(table).select('id', { count: 'exact', head: true });
  for (const filter of filters ?? []) {
    if (filter.operator === 'is') {
      query = query.is(filter.column, filter.value as null);
    } else {
      query = query.eq(filter.column, filter.value as string | boolean);
    }
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function loadPlatformStats(): Promise<PlatformStats> {
  const activeOnly = [{ column: 'archived_at', value: null, operator: 'is' as const }];
  const [
    centres, activeCentres, inactiveCentres, users, pendingDemos, pendingSubscriptions,
    starterCentres, standardCentres, professionalCentres, directors, trainers, students, superAdmins,
    approvedDemos, rejectedDemos, contactedSubscriptions, paidSubscriptions, rejectedSubscriptions,
  ] = await Promise.all([
    countRows('centres'),
    countRows('centres', [{ column: 'actif', value: true }]),
    countRows('centres', [{ column: 'actif', value: false }]),
    countRows('profiles'),
    countRows('demo_requests', [...activeOnly, { column: 'status', value: 'pending' }]),
    countRows('subscription_requests', [...activeOnly, { column: 'status', value: 'pending' }]),
    countRows('centres', [{ column: 'type_abonnement', value: 'STARTER' }]),
    countRows('centres', [{ column: 'type_abonnement', value: 'STANDARD' }]),
    countRows('centres', [{ column: 'type_abonnement', value: 'PROFESSIONAL' }]),
    countRows('profiles', [{ column: 'role', value: 'director' }]),
    countRows('profiles', [{ column: 'role', value: 'formateur' }]),
    countRows('profiles', [{ column: 'role', value: 'etudiant' }]),
    countRows('profiles', [{ column: 'role', value: 'super_admin' }]),
    countRows('demo_requests', [...activeOnly, { column: 'status', value: 'approved' }]),
    countRows('demo_requests', [...activeOnly, { column: 'status', value: 'rejected' }]),
    countRows('subscription_requests', [...activeOnly, { column: 'status', value: 'contacted' }]),
    countRows('subscription_requests', [...activeOnly, { column: 'status', value: 'paid' }]),
    countRows('subscription_requests', [...activeOnly, { column: 'status', value: 'rejected' }]),
  ]);

  return { centres, activeCentres, inactiveCentres, users, pendingDemos, pendingSubscriptions,
    starterCentres, standardCentres, professionalCentres, directors, trainers, students, superAdmins,
    approvedDemos, rejectedDemos, contactedSubscriptions, paidSubscriptions, rejectedSubscriptions };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="dashboard-card dashboard-metric">
      <p className="m-0 text-sm font-medium text-slate-500">{label}</p>
      <p className="mb-1 mt-3 text-3xl font-bold tracking-tight text-brand-900">{value.toLocaleString('fr-MA')}</p>
      <p className="m-0 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export function SuperAdminDashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'loaded', stats: await loadPlatformStats() });
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : 'Impossible de charger les statistiques globales.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadKey]);

  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5" aria-labelledby="platform-dashboard-title">
      <PageHeader
        eyebrow="Administration de la plateforme"
        title="Vue globale Madrassa-Ti"
        description="Suivez l’activité de tous les centres et traitez les demandes en attente depuis un espace central."
      />

      {state.status === 'loading' && (
        <Panel className="dashboard-panel"><LoadingState label="Chargement des statistiques de la plateforme…" /></Panel>
      )}

      {state.status === 'error' && (
        <Alert className="space-y-2" tone="error">
          <p>Les statistiques globales n’ont pas pu être chargées. Vérifiez les autorisations Supabase du compte super administrateur.</p>
          <p>{state.message}</p>
          <Button onClick={() => setReloadKey((key) => key + 1)} type="button" variant="secondary">
            Réessayer
          </Button>
        </Alert>
      )}

      {state.status === 'loaded' && (
        <>
          <div className="dashboard-kpis grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Centres enregistrés" value={state.stats.centres} detail="Tous les centres de la plateforme" />
            <MetricCard label="Centres actifs" value={state.stats.activeCentres} detail="Centres activés" />
            <MetricCard label="Centres inactifs" value={state.stats.inactiveCentres} detail="Centres désactivés" />
            <MetricCard label="Comptes utilisateurs" value={state.stats.users} detail="Profils enregistrés sur la plateforme" />
            <MetricCard label="Demandes de démonstration" value={state.stats.pendingDemos} detail="En attente de traitement" />
            <MetricCard label="Demandes d’abonnement" value={state.stats.pendingSubscriptions} detail="En attente de traitement" />
          </div>

          <div className="dashboard-columns grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">État des centres</h2>
              <p className="mt-1 text-sm text-slate-500">Comparaison des centres actifs et inactifs.</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: 'Actifs', value: state.stats.activeCentres },
                  { label: 'Inactifs', value: state.stats.inactiveCentres },
                ].map((item) => {
                  const percent = state.stats.centres
                    ? Math.round((item.value / state.stats.centres) * 100)
                    : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <strong className="text-brand-900">{item.value} ({percent}%)</strong>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">Demandes à traiter</h2>
              <p className="mt-1 text-sm text-slate-500">Les demandes en attente qui nécessitent une action du super administrateur.</p>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-4">
                  <p className="m-0 text-sm text-slate-500">Démonstrations</p>
                  <p className="mb-0 mt-2 text-2xl font-bold text-brand-900">{state.stats.pendingDemos}</p>
                  <a className="mt-3 inline-flex text-sm font-semibold text-brand-700 underline-offset-4 hover:underline" href="/app/vdemo">Ouvrir les demandes</a>
                </div>
                <div className="rounded-xl border border-line p-4">
                  <p className="m-0 text-sm text-slate-500">Abonnements</p>
                  <p className="mb-0 mt-2 text-2xl font-bold text-brand-900">{state.stats.pendingSubscriptions}</p>
                  <a className="mt-3 inline-flex text-sm font-semibold text-brand-700 underline-offset-4 hover:underline" href="/app/vsub">Ouvrir les demandes</a>
                </div>
              </div>
            </Panel>
          </div>
          <div className="dashboard-data-grid grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">Centres par pack</h2>
              <p className="mt-1 text-sm text-slate-500">Répartition des abonnements enregistrés sur les centres.</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: 'STARTER', value: state.stats.starterCentres },
                  { label: 'STANDARD', value: state.stats.standardCentres },
                  { label: 'PROFESSIONAL', value: state.stats.professionalCentres },
                ].map((item) => {
                  const max = Math.max(1, state.stats.starterCentres, state.stats.standardCentres, state.stats.professionalCentres);
                  const percent = Math.round((item.value / max) * 100);
                  return <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{item.label}</span><strong>{item.value}</strong></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} /></div>
                  </div>;
                })}
              </div>
            </Panel>
            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">Utilisateurs par rôle</h2>
              <p className="mt-1 text-sm text-slate-500">Répartition des profils accessibles au super-admin.</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: 'Directeurs', value: state.stats.directors },
                  { label: 'Formateurs', value: state.stats.trainers },
                  { label: 'Étudiants', value: state.stats.students },
                  { label: 'Super-admins', value: state.stats.superAdmins },
                ].map((item) => {
                  const max = Math.max(1, state.stats.directors, state.stats.trainers, state.stats.students, state.stats.superAdmins);
                  const percent = Math.round((item.value / max) * 100);
                  return <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{item.label}</span><strong>{item.value}</strong></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} /></div>
                  </div>;
                })}
              </div>
            </Panel>
            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">Demandes de démonstration</h2>
              <p className="mt-1 text-sm text-slate-500">Statuts des demandes non archivées.</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">En attente</p><p className="text-2xl font-bold">{state.stats.pendingDemos}</p></div>
                <div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">Approuvées</p><p className="text-2xl font-bold">{state.stats.approvedDemos}</p></div>
                <div className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">Refusées</p><p className="text-2xl font-bold">{state.stats.rejectedDemos}</p></div>
              </div>
              <a className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline" href="/app/vdemo">Gérer les démonstrations</a>
            </Panel>
            <Panel className="dashboard-panel">
              <h2 className="m-0 text-lg font-semibold text-brand-900">Demandes d’abonnement</h2>
              <p className="mt-1 text-sm text-slate-500">Statuts des demandes non archivées.</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'En attente', value: state.stats.pendingSubscriptions },
                  { label: 'Contactées', value: state.stats.contactedSubscriptions },
                  { label: 'Payées', value: state.stats.paidSubscriptions },
                  { label: 'Refusées', value: state.stats.rejectedSubscriptions },
                ].map((item) => <div key={item.label} className="rounded-xl border border-line p-3"><p className="text-xs text-slate-500">{item.label}</p><p className="text-2xl font-bold">{item.value}</p></div>)}
              </div>
              <a className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline" href="/app/vsub">Gérer les abonnements</a>
            </Panel>
          </div>
          <p className="m-0 text-xs text-slate-500">Les compteurs ne filtrent pas par centre sélectionné. Leur exhaustivité dépend des politiques RLS Supabase et des colonnes disponibles dans la base déployée.</p>
        </>
      )}
    </section>
  );
}
