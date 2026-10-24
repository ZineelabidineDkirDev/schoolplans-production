import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel, StatusBadge, notify } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';

type RequestStatus = 'pending' | 'contacted' | 'paid' | 'rejected';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseClient()
      .from('subscription_requests')
      .select('id,contact_name,centre_name,email,phone,plan,annual_price_mad,status,created_at,admin_notes')
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setRequests([]);
    } else {
      setRequests((data ?? []) as SubscriptionRequest[]);
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

  return (
    <section className="sp-page">
      <PageHeader title="Demandes d’abonnement" description="Consultez les demandes reçues et vérifiez les paiements manuellement avant d’activer un centre." />
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
