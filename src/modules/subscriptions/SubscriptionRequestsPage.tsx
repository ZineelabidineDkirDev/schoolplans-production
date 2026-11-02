import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel, StatusBadge, confirmAction, notify } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';
import { invokeCentreDirectorAccess } from '../../data/repositories/edgeFunctionRepository';

type RequestStatus = 'pending' | 'contacted' | 'payment_pending' | 'paid' | 'activated' | 'rejected' | 'cancelled';
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
  updated_at: string;
  reviewed_by: string | null;
  admin_notes: string | null;
  payment_reference: string | null;
  payment_verified_at: string | null;
  activated_at: string | null;
  centre_id: string | null;
};
type RequestEdits = { paymentReference: string; adminNotes: string; rejectionReason: string };
const statusLabels: Record<RequestStatus, string> = {
  pending: 'En attente',
  contacted: 'Contacté',
  payment_pending: 'Paiement en attente',
  paid: 'Paiement vérifié',
  activated: 'Centre activé',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};
const SALES_WHATSAPP_NUMBER = '212624438140';
const SALES_EMAIL = 'zainmawada2@gmail.com';
const PLAN_RIGHTS: Record<string, readonly string[]> = {
  STARTER: [
    'etudiants', 'formateurs', 'cours', 'planning', 'formations', 'groupes',
    'salles', 'import_excel', 'export_excel',
  ],
  STANDARD: [
    'etudiants', 'formateurs', 'cours', 'planning', 'formations', 'groupes',
    'salles', 'import_excel', 'export_excel', 'presences', 'certificats',
    'supports', 'documents', 'seances',
  ],
  PROFESSIONAL: [
    'etudiants', 'formateurs', 'cours', 'planning', 'formations', 'groupes',
    'salles', 'import_excel', 'export_excel', 'presences', 'certificats',
    'supports', 'documents', 'seances', 'statistiques', 'rapports',
    'cours_en_ligne', 'gestion_financiere',
  ],
};

function rightsForPlan(plan: string): Record<string, boolean> {
  const enabled = new Set(PLAN_RIGHTS[plan] ?? []);
  return Object.fromEntries([
    'etudiants', 'formateurs', 'cours', 'planning', 'formations', 'groupes',
    'salles', 'presences', 'certificats', 'supports', 'documents',
    'statistiques', 'rapports', 'import_excel', 'export_excel', 'seances',
    'cours_en_ligne', 'gestion_financiere', 'notes_bulletins',
  ].map((right) => [right, enabled.has(right)]));
}

export function SubscriptionRequestsPage() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [requestEdits, setRequestEdits] = useState<Record<string, RequestEdits>>({});
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});
  const [temporaryAccess, setTemporaryAccess] = useState<{ requestId: string; contactName: string; centreName: string; email: string; phone: string; password: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const client = getSupabaseClient();
    const [{ data, error: queryError }, { data: demoData, error: demoError }] = await Promise.all([
      client.from('subscription_requests').select('id,contact_name,centre_name,email,phone,plan,annual_price_mad,status,created_at,updated_at,reviewed_by,admin_notes,payment_reference,payment_verified_at,activated_at,centre_id').is('archived_at', null).order('created_at', { ascending: false }),
      client.from('demo_requests').select('id,contact_name,centre_name,email,phone,status,created_at,demo_started_at,demo_expires_at,archived_at').is('archived_at', null).order('created_at', { ascending: false }),
    ]);
    if (queryError) {
      setError(queryError.message);
      setRequests([]);
    } else {
      const loaded = (data ?? []) as SubscriptionRequest[];
      setRequests(loaded);
      const reviewerIds = [...new Set(loaded.map((request) => request.reviewed_by).filter((id): id is string => Boolean(id)))];
      if (reviewerIds.length) {
        const { data: reviewers } = await client.from('profiles').select('id,full_name').in('id', reviewerIds);
        setReviewerNames(Object.fromEntries((reviewers ?? []).map((reviewer) => [
          reviewer.id as string,
          typeof reviewer.full_name === 'string' ? reviewer.full_name : (reviewer.id as string),
        ])));
      } else {
        setReviewerNames({});
      }
      setRequestEdits(Object.fromEntries(loaded.map((request) => [
        request.id,
        {
          paymentReference: request.payment_reference ?? '',
          adminNotes: request.admin_notes ?? '',
          rejectionReason: '',
        },
      ])));
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

  async function updateSubscriptionRequest(
    request: SubscriptionRequest,
    status: RequestStatus,
    extra: Record<string, unknown> = {},
  ) {
    setSavingId(request.id);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');
      const { data, error: updateError } = await client
        .from('subscription_requests')
        .update({
          ...extra,
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: authData.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .eq('status', request.status)
        .is('archived_at', null)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('La demande a changé depuis son chargement. Actualisez la liste avant de réessayer.');
      notify(`Demande mise à jour : ${statusLabels[status]}.`, 'success');
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Impossible de mettre à jour la demande.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function verifyPayment(request: SubscriptionRequest) {
    const reference = requestEdits[request.id]?.paymentReference.trim();
    if (!reference || reference.length < 2) {
      notify('Saisissez une référence de paiement ou une note de vérification avant de confirmer.', 'error');
      return;
    }
    if (!await confirmAction(
      `Confirmez-vous avoir vérifié manuellement le paiement de ${request.annual_price_mad.toLocaleString('fr-FR')} DH pour ${request.centre_name} ?`,
      { title: 'Vérifier le paiement', confirmLabel: 'Confirmer le paiement' },
    )) return;
    await updateSubscriptionRequest(request, 'paid', {
      payment_reference: reference,
      payment_verified_at: new Date().toISOString(),
    });
  }

  async function rejectSubscription(request: SubscriptionRequest) {
    const reason = requestEdits[request.id]?.rejectionReason.trim();
    if (!reason) {
      notify('Saisissez le motif du refus dans les notes avant de refuser la demande.', 'error');
      return;
    }
    if (!await confirmAction(`Refuser la demande de ${request.centre_name} ? Motif : ${reason}`, {
      title: 'Refuser la demande',
      confirmLabel: 'Refuser',
    })) return;
    const existingNotes = requestEdits[request.id]?.adminNotes.trim();
    await updateSubscriptionRequest(request, 'rejected', {
      admin_notes: [existingNotes, `Motif du refus : ${reason}`].filter(Boolean).join('\n'),
    });
  }

  async function cancelSubscriptionRequest(request: SubscriptionRequest) {
    if (!await confirmAction(`Annuler la demande de ${request.centre_name} ? Cette action ne supprime ni compte ni données.`, {
      title: 'Annuler la demande',
      confirmLabel: 'Annuler la demande',
    })) return;
    await updateSubscriptionRequest(request, 'cancelled');
  }

  async function activateSubscription(request: SubscriptionRequest) {
    if (request.status !== 'paid' || !request.payment_verified_at || !request.payment_reference?.trim()) {
      notify('Enregistrez la référence de paiement vérifiée avant d’activer le centre.', 'error');
      return;
    }
    if (!await confirmAction(
      `Activer le pack ${request.plan} pour ${request.centre_name} pendant 12 mois, après vérification du paiement de ${request.annual_price_mad.toLocaleString('fr-FR')} DH ?`,
      { title: 'Activer le centre', confirmLabel: 'Activer le centre' },
    )) return;

    setSavingId(request.id);
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('Session Super Admin introuvable.');

      const start = new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      const startDate = start.toISOString();
      const expirationDate = end.toISOString();
      const rights = rightsForPlan(request.plan);
      let centreId = request.centre_id;

      if (centreId) {
        const { error: updateCentreError } = await client
          .from('centres')
          .update({
            type_abonnement: request.plan,
            statut_abonnement: 'ACTIF',
            date_debut: startDate,
            date_expiration: expirationDate,
            droits: rights,
            actif: true,
          })
          .eq('id', centreId);
        if (updateCentreError) throw new Error(`Le centre existe, mais son pack n’a pas pu être activé : ${updateCentreError.message}`);
      } else {
        const existing = await invokeCentreDirectorAccess(client, {
          action: 'reuse_existing_director',
          email: request.email.trim().toLowerCase(),
          centre_name: request.centre_name,
        });
        if (!('found' in existing)) throw new Error('La vérification du centre existant a renvoyé une réponse invalide.');

        if (existing.found) {
          centreId = existing.centre_id;
          const { error: updateCentreError } = await client
            .from('centres')
            .update({
              type_abonnement: request.plan,
              statut_abonnement: 'ACTIF',
              date_debut: startDate,
              date_expiration: expirationDate,
              droits: rights,
              actif: true,
            })
            .eq('id', centreId);
          if (updateCentreError) throw new Error(`Centre existant trouvé, mais mise à jour du pack impossible : ${updateCentreError.message}`);
        } else {
          const baseSlug = request.centre_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'centre';
          const created = await invokeCentreDirectorAccess(client, {
            action: 'create_centre',
            centre: {
              nom: request.centre_name,
              slug: `${baseSlug}-${request.id.replace(/-/g, '').slice(0, 8)}`,
              actif: true,
              type_abonnement: request.plan,
              statut_abonnement: 'ACTIF',
              date_debut: startDate,
              date_expiration: expirationDate,
              droits: rights,
            },
            director: {
              full_name: request.contact_name,
              email: request.email.trim().toLowerCase(),
              password: `${crypto.randomUUID()}Aa1!`,
            },
          });
          if (!('centre_id' in created) || !created.centre_id) {
            throw new Error('Le serveur n’a pas confirmé la création du centre.');
          }
          centreId = created.centre_id;
        }
      }

      if (!centreId) throw new Error('Identifiant du centre absent après création.');
      const { data: linkedRequest, error: linkError } = await client
        .from('subscription_requests')
        .update({ centre_id: centreId, updated_at: new Date().toISOString() })
        .eq('id', request.id)
        .eq('status', 'paid')
        .is('archived_at', null)
        .select('id');
      if (linkError) throw new Error(`Le centre est prêt, mais le lien vers la demande n’a pas été enregistré : ${linkError.message}`);
      if (!linkedRequest?.length) throw new Error('Le centre est prêt, mais le statut de la demande a changé. Actualisez avant de continuer.');

      const { error: emailError } = await client.auth.resetPasswordForEmail(
        request.email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/login` },
      );
      if (emailError) {
        throw new Error(`Le centre est activé, mais le lien de création du mot de passe n’a pas été envoyé : ${emailError.message}. Réessayez l’activation ; le centre existant sera réutilisé.`);
      }

      const { data: activated, error: activationError } = await client
        .from('subscription_requests')
        .update({
          status: 'activated',
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: authData.user.id,
          admin_notes: [requestEdits[request.id]?.adminNotes.trim(), `Centre activé : ${centreId}. Lien de création du mot de passe envoyé.`].filter(Boolean).join('\n'),
        })
        .eq('id', request.id)
        .eq('status', 'paid')
        .select('id');
      if (activationError) throw new Error(`Centre activé et e-mail envoyé, mais la demande n’a pas pu être finalisée : ${activationError.message}`);
      if (!activated?.length) throw new Error('Centre activé et e-mail envoyé, mais le statut de la demande a changé. Actualisez la liste.');

      notify(`Pack ${request.plan} activé pour ${request.centre_name}. Un lien de création du mot de passe a été envoyé.`, 'success');
      await loadRequests();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Impossible d’activer l’abonnement.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function deactivateDemoRequest(request: DemoRequest) {
    const confirmed = await confirmAction(`Désactiver la demande de démo de « ${request.centre_name} » ? Elle disparaîtra de la liste active, sans supprimer le centre, le compte directeur ni les données associées.`, { title: 'Désactiver la demande de démo', confirmLabel: 'Désactiver' });
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
    const confirmed = await confirmAction(
      `Avant de créer un accès provisoire pour « ${request.centre_name} », confirmez l’identité du directeur en vérifiant son numéro de téléphone avec les informations de la demande. Le mot de passe temporaire devra lui être transmis par un canal privé.`,
      { title: 'Créer un accès provisoire', confirmLabel: 'Continuer' },
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
              // La démo est distincte des packs payants : tous les modules sauf la finance.
              type_abonnement: 'DEMO',
              statut_abonnement: 'ACTIF',
              date_debut: startedAt.toISOString(),
              date_expiration: expiresAt.toISOString(),
              droits: {
                etudiants: true,
                formateurs: true,
                cours: true,
                planning: true,
                formations: true,
                groupes: true,
                salles: true,
                presences: true,
                certificats: true,
                supports: true,
                documents: true,
                statistiques: true,
                rapports: true,
                import_excel: true,
                export_excel: true,
                seances: true,
                cours_en_ligne: true,
                notes_bulletins: true,
                gestion_financiere: false,
                demo_14_jours: true,
              },
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

  const filteredRequests = requests.filter((request) =>
    (statusFilter === 'all' || request.status === statusFilter) &&
    (planFilter === 'all' || request.plan === planFilter),
  );
  const requestCounts = {
    pending: requests.filter((request) => request.status === 'pending').length,
    paymentPending: requests.filter((request) => request.status === 'payment_pending').length,
    paid: requests.filter((request) => request.status === 'paid').length,
    activated: requests.filter((request) => request.status === 'activated').length,
  };

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
            <p className="sp-muted">Suivi manuel : demande → contact → paiement vérifié → activation annuelle.</p>
          </div>
          <Button onClick={() => void loadRequests()} type="button" variant="secondary">Actualiser</Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['À traiter', requestCounts.pending],
            ['Paiements attendus', requestCounts.paymentPending],
            ['Paiements vérifiés', requestCounts.paid],
            ['Centres activés', requestCounts.activated],
          ].map(([label, count]) => (
            <div className="rounded-xl border border-slate-200 bg-white p-4" key={label}>
              <p className="sp-muted m-0 text-sm">{label}</p>
              <strong className="mt-1 block text-2xl">{count}</strong>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sp-form-field">
            Filtrer par statut
            <select className="sp-field" onChange={(event) => setStatusFilter(event.target.value as RequestStatus | 'all')} value={statusFilter}>
              <option value="all">Tous les statuts</option>
              {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
          </label>
          <label className="sp-form-field">
            Filtrer par forfait
            <select className="sp-field" onChange={(event) => setPlanFilter(event.target.value)} value={planFilter}>
              <option value="all">Tous les forfaits</option>
              {['STARTER', 'STANDARD', 'PROFESSIONAL'].map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </label>
        </div>
        {loading ? <LoadingState label="Chargement des demandes…" /> : requests.length === 0 ? (
          <p className="sp-muted mt-4">Aucune demande pour le moment.</p>
        ) : filteredRequests.length === 0 ? (
          <p className="sp-muted mt-4">Aucune demande ne correspond aux filtres choisis.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {filteredRequests.map((request) => {
              const edits = requestEdits[request.id] ?? {
                paymentReference: request.payment_reference ?? '',
                adminNotes: request.admin_notes ?? '',
                rejectionReason: '',
              };
              const message = `Bonjour ${request.contact_name}, nous faisons suite à votre demande d’abonnement ${request.plan} pour ${request.centre_name} (${request.annual_price_mad.toLocaleString('fr-FR')} DH/an). Merci de répondre à ce message pour recevoir les modalités de règlement.`;
              const whatsappHref = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
              const emailHref = `mailto:${request.email}?subject=${encodeURIComponent(`Votre demande ${request.plan} — Madrassa-Ti`)}&body=${encodeURIComponent(`${message}\n\nCordialement,\nMadrassa-Ti\n${SALES_EMAIL}`)}`;
              const canContact = request.status === 'pending';
              const canSendPaymentInstructions = ['pending', 'contacted'].includes(request.status);
              const canVerifyPayment = request.status === 'payment_pending';
              const canReject = ['pending', 'contacted', 'payment_pending'].includes(request.status);
              const canCancel = ['pending', 'contacted', 'payment_pending'].includes(request.status);

              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {new Date(request.created_at).toLocaleString('fr-FR')}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">{request.centre_name}</h3>
                      <p className="m-0 text-sm">{request.contact_name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        <a href={`mailto:${request.email}`}>{request.email}</a>
                        <a href={`tel:${request.phone}`}>{request.phone}</a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge>{statusLabels[request.status] ?? request.status}</StatusBadge>
                      <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-bold text-blue-900">
                        {request.plan} · {request.annual_price_mad.toLocaleString('fr-FR')} DH/an
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                    <label className="sp-form-field">
                      Référence / preuve vérifiée
                      <input
                        className="sp-field"
                        disabled={['activated', 'rejected', 'cancelled'].includes(request.status)}
                        maxLength={300}
                        onChange={(event) => setRequestEdits((current) => ({ ...current, [request.id]: { ...edits, paymentReference: event.target.value } }))}
                        placeholder="Référence de virement, reçu ou note de paiement en espèces"
                        value={edits.paymentReference}
                      />
                    </label>
                    <label className="sp-form-field">
                      Notes internes
                      <textarea
                        className="sp-field min-h-20"
                        disabled={['activated', 'rejected', 'cancelled'].includes(request.status)}
                        maxLength={2000}
                        onChange={(event) => setRequestEdits((current) => ({ ...current, [request.id]: { ...edits, adminNotes: event.target.value } }))}
                        placeholder="Échanges, suivi du dossier…"
                        value={edits.adminNotes}
                      />
                    </label>
                  </div>

                  {canReject && (
                    <label className="sp-form-field mt-3">
                      Motif de refus (obligatoire en cas de refus)
                      <input
                        className="sp-field"
                        maxLength={300}
                        onChange={(event) => setRequestEdits((current) => ({ ...current, [request.id]: { ...edits, rejectionReason: event.target.value } }))}
                        value={edits.rejectionReason}
                      />
                    </label>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={savingId === request.id || ['activated', 'rejected', 'cancelled'].includes(request.status)} onClick={() => void updateSubscriptionRequest(request, request.status, {
                      payment_reference: edits.paymentReference.trim() || null,
                      admin_notes: edits.adminNotes.trim() || null,
                    })} type="button" variant="secondary">Enregistrer les notes</Button>
                    {canContact && <Button disabled={savingId === request.id} onClick={() => void updateSubscriptionRequest(request, 'contacted')} type="button" variant="secondary">Marquer contacté</Button>}
                    <a className="sp-btn sp-btn-ghost" href={whatsappHref} rel="noreferrer" target="_blank">Contacter sur WhatsApp</a>
                    <a className="sp-btn sp-btn-ghost" href={emailHref}>Préparer l’e-mail</a>
                    {canSendPaymentInstructions && <Button disabled={savingId === request.id} onClick={() => void updateSubscriptionRequest(request, 'payment_pending')} type="button" variant="secondary">Instructions transmises</Button>}
                    {canVerifyPayment && <Button disabled={savingId === request.id} onClick={() => void verifyPayment(request)} type="button">Vérifier le paiement</Button>}
                    {request.status === 'paid' && <Button disabled={savingId === request.id || !request.payment_reference?.trim()} onClick={() => void activateSubscription(request)} type="button">Activer le centre · 12 mois</Button>}
                    {canReject && <Button disabled={savingId === request.id} onClick={() => void rejectSubscription(request)} type="button" variant="danger">Refuser</Button>}
                    {canCancel && <Button disabled={savingId === request.id} onClick={() => void cancelSubscriptionRequest(request)} type="button" variant="secondary">Annuler la demande</Button>}
                  </div>
                  {request.payment_verified_at && <p className="sp-muted mt-3 text-sm">Paiement vérifié le {new Date(request.payment_verified_at).toLocaleString('fr-FR')} · {request.payment_reference}</p>}
                  {request.activated_at && <p className="sp-muted mt-1 text-sm">Centre activé le {new Date(request.activated_at).toLocaleString('fr-FR')} · ID {request.centre_id}</p>}
                  <p className="sp-muted mt-2 text-xs">Mis à jour : {new Date(request.updated_at || request.created_at).toLocaleString('fr-FR')}{request.reviewed_by ? ` · Traité par ${reviewerNames[request.reviewed_by] ?? request.reviewed_by}` : ''}</p>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
      <p className="sp-muted mt-3">Aucun paiement n’est encaissé automatiquement. Vérifiez le paiement par un canal externe, notez sa référence, puis activez le centre. La date d’expiration est fixée à 12 mois après activation.</p>
    </section>
  );
}
