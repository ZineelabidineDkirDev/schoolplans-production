import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';

type PlatformStats = {
  centres: number;
  activeCentres: number;
  inactiveCentres: number;
  users: number;
  pendingDemos: number;
  pendingSubscriptions: number;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; stats: PlatformStats };

async function countRows(
  table: string,
  filters: (query: any) => any = (query) => query,
): Promise<number> {
  const query = getSupabaseClient().from(table).select('id', { count: 'exact', head: true });
  const { count, error } = await filters(query);
  if (error) throw error;
  return count ?? 0;
}

async function loadPlatformStats(): Promise<PlatformStats> {
  const [centres, activeCentres, inactiveCentres, users, pendingDemos, pendingSubscriptions] =
    await Promise.all([
      countRows('centres'),
      countRows('centres', (query) => query.eq('actif', true)),
      countRows('centres', (query) => query.eq('actif', false)),
      countRows('profiles'),
      countRows('demo_requests', (query) => query.eq('status', 'pending').is('archived_at', null)),
      countRows('subscription_requests', (query) => query.eq('status', 'pending')),
    ]);

  return { centres, activeCentres, inactiveCentres, users, pendingDemos, pendingSubscriptions };
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
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
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
        <Panel><LoadingState label="Chargement des statistiques de la plateforme…" /></Panel>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Centres enregistrés" value={state.stats.centres} detail="Tous les centres de la plateforme" />
            <MetricCard label="Centres actifs" value={state.stats.activeCentres} detail="Centres activés" />
            <MetricCard label="Centres inactifs" value={state.stats.inactiveCentres} detail="Centres désactivés" />
            <MetricCard label="Comptes utilisateurs" value={state.stats.users} detail="Profils enregistrés sur la plateforme" />
            <MetricCard label="Demandes de démonstration" value={state.stats.pendingDemos} detail="En attente de traitement" />
            <MetricCard label="Demandes d’abonnement" value={state.stats.pendingSubscriptions} detail="En attente de traitement" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel>
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

            <Panel>
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
          <p className="m-0 text-xs text-slate-500">Les compteurs dépendent des données visibles par les politiques RLS du compte connecté. Toute erreur d’autorisation est affichée plutôt que remplacée par des chiffres estimés.</p>
        </>
      )}
    </section>
  );
}
