import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel, StatusBadge, notify } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';

type RequestStatus = 'pending' | 'contacted' | 'paid' | 'rejected';
type DemoStatus = 'pending' | 'approved' | 'rejected';
type DemoRequest = { id: string; contact_name: string; centre_name: string; email: string; phone: string; status: DemoStatus; created_at: string; demo_started_at: string | null; demo_expires_at: string | null; };
type SubscriptionRequest = {
  id: string;
  contact_name: string;
  centre_name: string;
  email: string;
  phone: string;
  plan: string;
  annual_price_mad: number;
  status: RequestStatus;
  created_at: string;
  admin_notes: string | null;
};
const statusLabels: Record<RequestStatus, string> = {
  pending: 'En attente',
  contacted: 'Contacté',
  paid: 'Paiement confirmé',
  rejected: 'Refusée',
};

export function SubscriptionRequestsPage() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const client = getSupabaseClient();
    const [{ data, error: queryError }, { data: demoData, error: demoError }] = await Promise.all([
      client.from('subscription_requests').select('id,contact_name,centre_name,email,phone,plan,annual_price_mad,status,created_at,admin_notes').order('created_at', { ascending: false }),
      client.from('demo_requests').select('id,contact_name,centre_name,email,phone,status,created_at,demo_started_at,demo_expires_at').order('created_at', { ascending: false }),
    ]);
    if (queryError) {
      setError(queryError.message);
      setRequests([]);
    } else {
      setRequests((data ?? []) as SubscriptionRequest[]);
    }
    if (demoError) {
      setError((current) => current ? `${current} · Démo : ${demoError.message}` : `Demandes de démo : ${demoError.message}`);
      setDemoRequests([]);
    } else {
      setDemoRequests((demoData ?? []) as DemoRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  async function updateStatus(request: SubscriptionRequest, status: RequestStatus) {
    setSavingId(request.id);
    const client = getSupabaseClient();
    const { data: authData } = await client.auth.getUser();
    const { error: updateError } = await client
      .from('subscription_requests')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: authData.user?.id ?? null,
      })
      .eq('id', request.id);
    if (updateError) {
      notify(updateError.message, 'error');
    } else {
      notify('Statut de la demande mis à jour.', 'success');
      await loadRequests();
    }
    setSavingId(null);
  }

  async function reviewDemo(request: DemoRequest, status: Exclude<DemoStatus, 'pending'>) {
    setSavingId(request.id);
    const client = getSupabaseClient();
    const { data: authData } = await client.auth.getUser();
    const startedAt = new Date();
    const { error: updateError } = await client.from('demo_requests').update({
      status,
      reviewed_at: startedAt.toISOString(),
      reviewed_by: authData.user?.id ?? null,
      demo_started_at: status === 'approved' ? startedAt.toISOString() : null,
      demo_expires_at: status === 'approved' ? new Date(startedAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
    }).eq('id', request.id);
    if (updateError) notify(updateError.message, 'error');
    else {
      notify(status === 'approved' ? 'Demande approuvée : période de 14 jours enregistrée.' : 'Demande de démo refusée.', 'success');
      await loadRequests();
    }
    setSavingId(null);
  }

  return (
    <section className="sp-page">
      <PageHeader title="Demandes d’abonnement" description="Consultez les demandes reçues et vérifiez les paiements manuellement avant d’activer un centre." />
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Demandes de démo gratuite</h2>
            <p className="sp-muted">{demoRequests.filter((item) => item.status === 'pending').length} en attente · 14 jours après approbation</p>
          </div>
          <Button onClick={() => void loadRequests()} type="button" variant="secondary">Actualiser</Button>
        </div>
        {loading ? <LoadingState label="Chargement des demandes de démo…" /> : demoRequests.length === 0 ? (
          <p className="sp-muted mt-4">Aucune demande de démo pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr><th className="p-3">Contact / Centre</th><th className="p-3">Demande</th><th className="p-3">Période</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{demoRequests.map((request) => (
                <tr className="border-t" key={request.id}>
                  <td className="p-3"><strong>{request.contact_name}</strong><br />{request.centre_name}<br /><a href={`mailto:${request.email}`}>{request.email}</a><br /><a href={`tel:${request.phone}`}>{request.phone}</a></td>
                  <td className="p-3">{new Date(request.created_at).toLocaleDateString('fr-FR')}<br />0 DH · 14 jours</td>
                  <td className="p-3">{request.demo_started_at && request.demo_expires_at ? <>{new Date(request.demo_started_at).toLocaleDateString('fr-FR')} – {new Date(request.demo_expires_at).toLocaleDateString('fr-FR')}</> : 'Démarre après approbation'}</td>
                  <td className="p-3"><StatusBadge>{request.status === 'pending' ? 'En attente' : request.status === 'approved' ? 'Approuvée' : 'Refusée'}</StatusBadge></td>
                  <td className="p-3"><div className="flex flex-wrap gap-2">
                    <Button disabled={savingId === request.id || request.status !== 'pending'} onClick={() => void reviewDemo(request, 'approved')} type="button">Approuver la démo</Button>
                    <Button disabled={savingId === request.id || request.status !== 'pending'} onClick={() => void reviewDemo(request, 'rejected')} type="button" variant="danger">Refuser</Button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Demandes reçues</h2>
            <p className="sp-muted">{requests.filter((item) => item.status === 'pending').length} en attente</p>
          </div>
          <Button onClick={() => void loadRequests()} type="button" variant="secondary">Actualiser</Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {loading ? <LoadingState label="Chargement des demandes…" /> : requests.length === 0 ? (
          <p className="sp-muted mt-4">Aucune demande pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr>
                <th className="p-3">Contact / Centre</th><th className="p-3">Pack</th><th className="p-3">Date</th><th className="p-3">Statut</th><th className="p-3">Actions</th>
              </tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr className="border-t" key={request.id}>
                    <td className="p-3">
                      <strong>{request.contact_name}</strong><br />{request.centre_name}<br />
                      <a href={`mailto:${request.email}`}>{request.email}</a><br />
                      <a href={`tel:${request.phone}`}>{request.phone}</a>
                    </td>
                    <td className="p-3"><strong>{request.plan}</strong><br />{request.annual_price_mad.toLocaleString('fr-FR')} DH/an</td>
                    <td className="p-3">{new Date(request.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3"><StatusBadge>{statusLabels[request.status] ?? request.status}</StatusBadge></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={savingId === request.id || request.status === 'contacted'} onClick={() => void updateStatus(request, 'contacted')} type="button" variant="secondary">Contacté</Button>
                        <Button disabled={savingId === request.id || request.status === 'paid'} onClick={() => void updateStatus(request, 'paid')} type="button">Paiement confirmé</Button>
                        <Button disabled={savingId === request.id || request.status === 'rejected'} onClick={() => void updateStatus(request, 'rejected')} type="button" variant="danger">Refuser</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="sp-muted mt-3">Confirmer le paiement ici ne crée pas encore automatiquement le centre : l’activation reste une étape manuelle séparée.</p>
    </section>
  );
}
