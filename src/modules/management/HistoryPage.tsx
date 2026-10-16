import { Alert, PageHeader, Panel } from '../../components/ui';

export function HistoryPage() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        description="Journal des connexions à la plateforme."
        eyebrow="Administration"
        title="Historique"
      />
      <Panel className="space-y-3">
        <Alert tone="warning">
          L’historique est temporairement masqué : le schéma observé de la table « connexions » ne
          fournit pas de centre_id permettant de limiter les résultats au centre actif.
        </Alert>
        <p className="sp-muted">
          Pour protéger les informations des autres centres, aucun journal global n’est affiché.
          Cette rubrique sera activée lorsque la portée centre des données et des règles RLS aura
          été confirmée.
        </p>
      </Panel>
    </section>
  );
}
