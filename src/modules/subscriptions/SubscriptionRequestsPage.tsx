import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel, StatusBadge, notify } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';
import { invokeCentreDirectorAccess } from '../../data/repositories/edgeFunctionRepository';

type RequestStatus = 'pending' | 'contacted' | 'paid' | 'rejected';
type DemoStatus = 'pending' | 'approved' | 'rejected';
type DemoRequest = { id: string; contact_name: string; centre_name: string; email: string; phone: string; status: DemoStatus; created_at: string; demo_started_at: string | null; demo_expires_at: string | null; archived_at: string | null; };
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
  const [temporaryAccess, setTemporaryAccess] = useState<{ requestId: string; contactName: string; centreName: string; email: string; phone: string; password: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const client = getSupabaseClient();
    const [{ data, error: queryError }, { data: demoData, error: demoError }] = await Promise.all([
      client.from('subscription_requests').select('id,contact_name,centre_name,email,phone,plan,annual_price_mad,status,created_at,admin_notes').order('created_at', { ascending: false }),
      client.from('demo_requests').select('id,contact_name,centre_name,email,phone,status,created_at,demo_started_at,demo_expires_at,archived_at').is('archived_at', null).order('created_at', { ascending: false }),
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

  async function deactivateDemoRequest(request: DemoRequest) {
    const confirmed = window.confirm(`Désactiver la demande de démo de « ${request.centre_name} » ? Elle disparaîtra de la liste active, sans supprimer le centre, le compte directeur ni les données associées.`);
    if (!confirmed) return;

    setSavingId(request.id);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');
      const { data, error: updateError } = await client
        .from('demo_requests')
        .update({ archived_at: new Date().toISOString(), archived_by: authData.user.id })
        .eq('id', request.id)
        .is('archived_at', null)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('Cette demande est déjà désactivée ou inaccessible.');
      notify('Demande de démo désactivée. Le centre et le compte directeur sont conservés.', 'success');
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Impossible de désactiver cette demande.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function createTemporaryDirectorAccess(request: DemoRequest) {
    const confirmed = window.confirm(
      `Avant de créer un accès provisoire pour « ${request.centre_name} », confirmez l’identité du directeur en vérifiant son numéro de téléphone avec les informations de la demande. Le mot de passe temporaire devra lui être transmis par un canal privé.`,
    );
    if (!confirmed) return;

    setSavingId(request.id);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');

      const existing = await invokeCentreDirectorAccess(client, {
        action: 'reuse_existing_director',
        email: request.email.trim().toLowerCase(),
        centre_name: request.centre_name,
      });
      if (!('found' in existing) || !existing.found) {
        throw new Error(
          'Aucun compte directeur existant lié à ce centre. Si l’approbation précédente a échoué pendant l’envoi de l’e-mail, actualisez la liste puis réessayez. Aucun nouveau compte ne sera créé par cette action.',
        );
      }

      // Mot de passe temporaire aléatoire ; l’Edge Function impose must_change=true.
      const temporaryPassword = `${crypto.randomUUID()}Aa1!`;
      const reset = await invokeCentreDirectorAccess(client, {
        action: 'reset',
        centre_id: existing.centre_id,
        user_id: existing.director_user_id,
        password: temporaryPassword,
      });
      if (!('ok' in reset) || reset.ok !== true) {
        throw new Error('Supabase n’a pas confirmé la création de l’accès provisoire.');
      }

      // Le mot de passe est affiché uniquement dans cette session Super Admin,
      // jamais enregistré dans demo_requests ni dans admin_notes.
      setTemporaryAccess({
        requestId: request.id,
        contactName: request.contact_name,
        centreName: request.centre_name,
        email: request.email.trim().toLowerCase(),
        phone: request.phone,
        password: temporaryPassword,
      });

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await client
        .from('demo_requests')
        .update({
          status: 'approved',
          reviewed_at: now,
          reviewed_by: authData.user.id,
          demo_started_at: existing.date_debut,
          demo_expires_at: existing.date_expiration,
          admin_notes: `Compte directeur existant réutilisé : ${existing.director_user_id}. Accès provisoire créé avec changement de mot de passe obligatoire ; période d’essai conservée.`,
        })
        .eq('id', request.id)
        .in('status', ['pending', 'approved'])
        .is('archived_at', null)
        .select('id');

      if (updateError) {
        throw new Error(`Le mot de passe provisoire est prêt et reste affiché ci-dessous, mais la demande n’a pas pu être mise à jour : ${updateError.message}`);
      }
      if (!updated?.length) {
        throw new Error('Le mot de passe provisoire est prêt et reste affiché ci-dessous, mais la demande est désactivée ou son statut a changé. Actualisez la liste.');
      }

      notify('Accès provisoire créé. Le directeur devra choisir un nouveau mot de passe à la première connexion.', 'success');
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Impossible de créer l’accès provisoire.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function resendDemoLink(request: DemoRequest) {
    setSavingId(request.id);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');

      // Cette action NE CRÉE rien : elle exige un compte directeur déjà lié au centre demandé.
      const existing = await invokeCentreDirectorAccess(client, {
        action: 'reuse_existing_director',
        email: request.email.trim().toLowerCase(),
        centre_name: request.centre_name,
      });

      if (!('found' in existing)) {
        throw new Error('Réponse de vérification du compte invalide. Aucune modification effectuée.');
      }
      if (!existing.found) {
        throw new Error('Aucun compte directeur existant pour cette demande. Aucun centre ni compte n’a été créé. Utilisez « Approuver la démo » pour la première création.');
      }

      const { error: emailError } = await client.auth.resetPasswordForEmail(
        request.email.trim().toLowerCase(),
        { redirectTo: 'https://madrassa-ti.vercel.app/login' },
      );
      if (emailError) {
        throw new Error(`Le lien n’a pas été envoyé : ${emailError.message}. Aucun centre, compte ou période d’essai n’a été modifié. Attendez avant de réessayer.`);
      }

      // Ne modifier la demande qu'après confirmation de l'envoi; les dates viennent du centre existant.
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await client
        .from('demo_requests')
        .update({
          status: 'approved',
          reviewed_at: now,
          reviewed_by: authData.user.id,
          demo_started_at: existing.date_debut,
          demo_expires_at: existing.date_expiration,
          admin_notes: `Centre existant réutilisé : ${existing.centre_id}. Lien de réinitialisation renvoyé ; période d'essai conservée.`,
        })
        .eq('id', request.id)
        .in('status', ['pending', 'approved'])
        .is('archived_at', null)
        .select('id');

      if (updateError) {
        throw new Error(`Le lien a été envoyé, mais la demande n’a pas pu être mise à jour : ${updateError.message}. Le centre et ses dates sont conservés.`);
      }
      if (!updated?.length) {
        throw new Error('Le lien a été envoyé, mais la demande est désactivée ou son statut a changé. Actualisez la liste avant toute autre action.');
      }

      notify('Lien renvoyé au directeur. Aucun compte ni centre recréé ; période d’essai conservée.', 'success');
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Impossible de renvoyer le lien.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function reviewDemo(request: DemoRequest, status: Exclude<DemoStatus, 'pending'>) {
    setSavingId(request.id);
    const client = getSupabaseClient();
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');

      if (status === 'approved') {
        // Le slug déterministe rend les nouvelles tentatives détectables au lieu de créer
        // silencieusement plusieurs centres pour la même demande.
        const baseSlug = request.centre_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'centre';
        const slug = `${baseSlug}-${request.id.replace(/-/g, '').slice(0, 8)}`;
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        let centreId: string;
        let demoStartedAt: string | null;
        let demoExpiresAt: string | null;
        let reusedExisting = false;

        // Vérifier d'abord si cette adresse est déjà le directeur du même centre.
        // La fonction serveur refuse les comptes liés à un autre centre/role.
        const existing = await invokeCentreDirectorAccess(client, {
          action: 'reuse_existing_director',
          email: request.email.trim().toLowerCase(),
          centre_name: request.centre_name,
        });

        if (!('found' in existing)) {
          throw new Error('La vérification du compte existant a renvoyé une réponse inattendue. Aucune création n’a été lancée.');
        }

        if (existing.found) {
          centreId = existing.centre_id;
          demoStartedAt = existing.date_debut;
          demoExpiresAt = existing.date_expiration;
          reusedExisting = true;
        } else {
          const temporaryPassword = `${crypto.randomUUID()}Aa1!`;
          const created = await invokeCentreDirectorAccess(client, {
            action: 'create_centre',
            centre: {
              nom: request.centre_name,
              slug,
              actif: true,
              type_abonnement: 'STARTER',
              statut_abonnement: 'ACTIF',
              date_debut: startedAt.toISOString(),
              date_expiration: expiresAt.toISOString(),
            },
            director: {
              full_name: request.contact_name,
              email: request.email.trim().toLowerCase(),
              password: temporaryPassword,
            },
          });
          if (!('centre_id' in created) || !created.centre_id) {
            throw new Error('Le serveur n’a pas confirmé la création du centre.');
          }
          centreId = created.centre_id;
          demoStartedAt = startedAt.toISOString();
          demoExpiresAt = expiresAt.toISOString();
        }

        // Envoyer le lien officiel Supabase de réinitialisation : le mot de passe
        // temporaire n’est jamais affiché à l’écran ni enregistré dans la demande.
        const redirectTo = 'https://madrassa-ti.vercel.app/login';
        const { error: emailError } = await client.auth.resetPasswordForEmail(
          request.email.trim().toLowerCase(),
          { redirectTo },
        );
        if (emailError) {
          notify(`Centre créé, mais l’envoi du lien a échoué : ${emailError.message}. Ne relancez pas la création ; vérifiez le compte puis renvoyez le lien.`, 'error');
          await loadRequests();
          return;
        }

        const { error: updateError } = await client.from('demo_requests').update({
          status: 'approved',
          reviewed_at: startedAt.toISOString(),
          reviewed_by: authData.user.id,
          demo_started_at: demoStartedAt,
          demo_expires_at: demoExpiresAt,
          admin_notes: reusedExisting
            ? `Centre existant réutilisé : ${centreId}. Lien de réinitialisation envoyé ; période d'essai conservée.`
            : `Centre créé : ${centreId}. Lien de définition du mot de passe envoyé.`,
        }).eq('id', request.id).eq('status', 'pending');
        if (updateError) throw new Error(`Centre ${reusedExisting ? 'existant réutilisé' : 'créé'}, mais la demande n’a pas pu être finalisée : ${updateError.message}. Centre ID : ${centreId}`);
        notify(reusedExisting
          ? 'Compte directeur et centre existants réutilisés. Aucun doublon créé ; lien de réinitialisation envoyé et période conservée.'
          : 'Démo activée : centre et directeur créés, lien de définition du mot de passe envoyé.', 'success');
      } else {
        const now = new Date();
        const { error: updateError } = await client.from('demo_requests').update({
          status: 'rejected',
          reviewed_at: now.toISOString(),
          reviewed_by: authData.user.id,
          demo_started_at: null,
          demo_expires_at: null,
        }).eq('id', request.id).eq('status', 'pending');
        if (updateError) throw updateError;
        notify('Demande de démo refusée.', 'success');
      }
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Échec du traitement de la demande de démo.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="sp-page">
      <PageHeader title="Demandes d’abonnement" description="Consultez les demandes reçues et vérifiez les paiements manuellement avant d’activer un centre." />
      <Panel>
        {temporaryAccess && (
          <Alert tone="warning">
            <div className="grid gap-3">
              <div>
                <strong>Accès provisoire — à transmettre en privé</strong>
                <p className="mt-1">Directeur : {temporaryAccess.contactName} · Centre : {temporaryAccess.centreName}</p>
                <p>E-mail : {temporaryAccess.email}</p>
                <p>Téléphone déclaré : {temporaryAccess.phone}</p>
                <p className="mt-2">Mot de passe temporaire (visible uniquement dans cette session) :</p>
                <code className="mt-1 block select-all break-all rounded bg-white/70 p-3 text-sm">{temporaryAccess.password}</code>
                <p className="mt-2">Transmets-le uniquement après vérification de l’identité du directeur. À sa première connexion, Madrassa-Ti lui imposera de choisir un nouveau mot de passe.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(temporaryAccess.password)
                      .then(() => notify('Mot de passe copié.', 'success'))
                      .catch(() => notify('Copie impossible. Sélectionnez le mot de passe affiché.', 'error'));
                  }}
                  type="button"
                  variant="secondary"
                >
                  Copier le mot de passe
                </Button>
                <Button onClick={() => setTemporaryAccess(null)} type="button" variant="secondary">
                  Masquer le mot de passe
                </Button>
              </div>
            </div>
          </Alert>
        )}
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
                    <Button disabled={savingId === request.id || request.status === 'rejected'} onClick={() => void createTemporaryDirectorAccess(request)} type="button" variant="secondary">Créer un accès provisoire</Button>
                    <Button disabled={savingId === request.id || request.status === 'rejected'} onClick={() => void resendDemoLink(request)} type="button" variant="secondary">Renvoyer le lien</Button>
                    <Button disabled={savingId === request.id || request.status !== 'pending'} onClick={() => void reviewDemo(request, 'approved')} type="button">Approuver la démo</Button>
                    <Button disabled={savingId === request.id || request.status !== 'pending'} onClick={() => void reviewDemo(request, 'rejected')} type="button" variant="danger">Refuser</Button>
                    <Button disabled={savingId === request.id || request.status === 'pending'} onClick={() => void deactivateDemoRequest(request)} type="button" variant="secondary">Désactiver</Button>
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
