import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, LoadingState } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';
import { useAuth } from '../auth/AuthProvider';

type Student = { id: number; prenom: string; nom: string };
type Charge = { id: string; student_id: number; label: string; amount_due: number | string; due_date: string | null; status: string; notes: string | null };
type Payment = { id: string; charge_id: string; amount: number | string; payment_method: string; receipt_number: string; paid_at: string };
type Expense = { amount: number | string };
type Payroll = { amount_due: number | string; status: string };
type Summary = { charges: number; collected: number; expenses: number; payrollDue: number; chargeCount: number; expenseCount: number; payrollCount: number };
const EMPTY: Summary = { charges: 0, collected: 0, expenses: 0, payrollDue: 0, chargeCount: 0, expenseCount: 0, payrollCount: 0 };
const METHODS = [{ value: 'cash', label: 'Espèces' }, { value: 'bank_transfer', label: 'Virement bancaire' }, { value: 'card', label: 'Carte bancaire' }, { value: 'cheque', label: 'Chèque' }, { value: 'other', label: 'Autre' }];
const money = (value: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(value);
const numeric = (value: number | string | null | undefined) => { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; };
const today = () => new Date().toISOString().slice(0, 10);

export function FinanceDashboardPage() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [students, setStudents] = useState<Student[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<'charges' | 'payments'>('charges');
  const [chargeForm, setChargeForm] = useState({ studentId: '', label: 'Frais de scolarité', amount: '', dueDate: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ chargeId: '', amount: '', method: 'cash', reference: '', notes: '' });

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile?.centreId) { setError('Votre compte n’est pas rattaché à un établissement.'); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const client = getSupabaseClient();
        const [studentsResult, chargesResult, paymentsResult, expensesResult, payrollResult] = await Promise.all([
          client.from('etudiants').select('id,prenom,nom').eq('centre_id', profile.centreId).order('nom'),
          client.from('finance_student_charges').select('id,student_id,label,amount_due,due_date,status,notes').eq('centre_id', profile.centreId).neq('status', 'cancelled').order('created_at', { ascending: false }),
          client.from('finance_payments').select('id,charge_id,amount,payment_method,receipt_number,paid_at').eq('centre_id', profile.centreId).order('paid_at', { ascending: false }),
          client.from('finance_expenses').select('amount').eq('centre_id', profile.centreId).eq('status', 'paid'),
          client.from('finance_teacher_payroll').select('amount_due,status').eq('centre_id', profile.centreId),
        ]);
        const failed = [studentsResult, chargesResult, paymentsResult, expensesResult, payrollResult].find((result) => result.error);
        if (failed?.error) throw failed.error;
        const nextCharges = (chargesResult.data ?? []) as Charge[];
        const nextPayments = (paymentsResult.data ?? []) as Payment[];
        const expenses = (expensesResult.data ?? []) as Expense[];
        const payroll = (payrollResult.data ?? []) as Payroll[];
        const nextSummary: Summary = {
          charges: nextCharges.reduce((sum, row) => sum + numeric(row.amount_due), 0),
          collected: nextPayments.reduce((sum, row) => sum + numeric(row.amount), 0),
          expenses: expenses.reduce((sum, row) => sum + numeric(row.amount), 0),
          payrollDue: payroll.filter((row) => row.status === 'approved').reduce((sum, row) => sum + numeric(row.amount_due), 0),
          chargeCount: nextCharges.length,
          expenseCount: expenses.length,
          payrollCount: payroll.filter((row) => row.status === 'approved').length,
        };
        if (active) {
          setStudents((studentsResult.data ?? []) as Student[]);
          setCharges(nextCharges); setPayments(nextPayments); setSummary(nextSummary);
          setPaymentForm((current) => ({ ...current, chargeId: current.chargeId || nextCharges.find((charge) => ['open', 'partial'].includes(charge.status))?.id || '' }));
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger les données financières.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [profile?.centreId, reloadKey]);

  async function createCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId) return;
    const amountDue = Number(chargeForm.amount);
    if (!chargeForm.studentId || !chargeForm.label.trim() || !Number.isFinite(amountDue) || amountDue <= 0) {
      setError('Choisissez un étudiant et saisissez un montant supérieur à 0 DH.'); return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const { error: insertError } = await getSupabaseClient().from('finance_student_charges').insert({
        centre_id: profile.centreId,
        student_id: Number(chargeForm.studentId),
        label: chargeForm.label.trim(),
        amount_due: amountDue,
        due_date: chargeForm.dueDate || null,
        notes: chargeForm.notes.trim() || null,
        created_by: profile.id,
      });
      if (insertError) throw insertError;
      setNotice('Frais enregistré avec succès.');
      setChargeForm({ studentId: '', label: 'Frais de scolarité', amount: '', dueDate: '', notes: '' });
      reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer les frais.'); }
    finally { setSaving(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId) return;
    const charge = charges.find((item) => item.id === paymentForm.chargeId);
    const paidAmount = Number(paymentForm.amount);
    if (!charge || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      setError('Sélectionnez des frais et saisissez un paiement supérieur à 0 DH.'); return;
    }
    const alreadyPaid = payments.filter((payment) => payment.charge_id === charge.id).reduce((sum, payment) => sum + numeric(payment.amount), 0);
    const remaining = Math.max(0, numeric(charge.amount_due) - alreadyPaid);
    if (paidAmount > remaining + 0.001) {
      setError(`Le paiement dépasse le reste dû (${money(remaining)}).`); return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const receipt = `REC-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const client = getSupabaseClient();
      const { error: paymentError } = await client.from('finance_payments').insert({
        centre_id: profile.centreId,
        charge_id: charge.id,
        amount: paidAmount,
        payment_method: paymentForm.method,
        receipt_number: receipt,
        reference: paymentForm.reference.trim() || null,
        notes: paymentForm.notes.trim() || null,
        created_by: profile.id,
      });
      if (paymentError) throw paymentError;
      const newTotal = alreadyPaid + paidAmount;
      const nextStatus = newTotal >= numeric(charge.amount_due) ? 'paid' : 'partial';
      const { error: statusError } = await client.from('finance_student_charges').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', charge.id).eq('centre_id', profile.centreId);
      if (statusError) throw new Error(`Paiement enregistré (reçu ${receipt}), mais impossible de mettre à jour le statut du frais : ${statusError.message}`);
      setNotice(`Paiement enregistré. Reçu n° ${receipt}.`);
      setPaymentForm({ chargeId: '', amount: '', method: 'cash', reference: '', notes: '' });
      setView('payments'); reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le paiement.'); }
    finally { setSaving(false); }
  }

  const studentName = (id: number) => {
    const student = students.find((item) => Number(item.id) === Number(id));
    return student ? `${student.prenom} ${student.nom}`.trim() : `Étudiant #${id}`;
  };
  const paidForCharge = (chargeId: string) => payments.filter((payment) => payment.charge_id === chargeId).reduce((sum, payment) => sum + numeric(payment.amount), 0);
  const outstanding = Math.max(0, summary.charges - summary.collected);
  const metrics = [
    { label: 'Frais enregistrés', value: money(summary.charges), note: `${summary.chargeCount} frais`, tone: 'brand' },
    { label: 'Recettes encaissées', value: money(summary.collected), note: `${payments.length} paiements`, tone: 'positive' },
    { label: 'Reste à encaisser', value: money(outstanding), note: 'Total des frais moins paiements', tone: 'warning' },
    { label: 'Dépenses payées', value: money(summary.expenses), note: `${summary.expenseCount} dépenses`, tone: 'neutral' },
    { label: 'Rémunérations à payer', value: money(summary.payrollDue), note: `${summary.payrollCount} rémunérations approuvées`, tone: 'neutral' },
    { label: 'Solde net indicatif', value: money(summary.collected - summary.expenses), note: 'Encaissements moins dépenses', tone: 'brand' },
  ];

  if (loading) return <LoadingState label="Chargement du module Finance…" />;

  return (
    <section className="sp-page finance-page">
      <div className="finance-page-heading"><div><p className="sp-page-eyebrow">Gestion de l’établissement</p><h1 className="sp-page-title">Gestion financière</h1><p className="sp-muted">Frais de scolarité, paiements et suivi des encaissements.</p></div><span className="finance-currency-pill">Devise : MAD</span></div>
      {error && <Alert tone="error"><p>{error}</p></Alert>}
      {notice && <Alert tone="success"><p>{notice}</p></Alert>}
      <div className="finance-metrics-grid">{metrics.map((metric) => <article className={`finance-metric-card finance-tone-${metric.tone}`} key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.note}</span></article>)}</div>

      <div className="finance-section-heading"><div><h2>Frais et paiements</h2><p>Créez les frais des étudiants et enregistrez les paiements complets ou partiels.</p></div></div>
      <div className="finance-feature-grid">
        <article className="finance-feature-card"><span aria-hidden="true">↘</span><div><h3>Frais et paiements</h3><p>Création des frais, paiements partiels et reçus numérotés.</p><small>Disponible</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">↗</span><div><h3>Dépenses</h3><p>Fournisseurs, justificatifs et validation des dépenses.</p><small>À développer</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">▤</span><div><h3>Trésorerie</h3><p>Caisses, comptes bancaires, mouvements et transferts.</p><small>À développer</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">◎</span><div><h3>Rémunérations</h3><p>Calcul depuis les séances réalisées et historique des paiements.</p><small>À développer</small></div></article>
      </div>

      <div className="finance-section-heading"><div><h2>Opérations</h2><p>Les opérations sont enregistrées dans Supabase et isolées par centre.</p></div></div>
      <div className="finance-operation-tabs"><Button onClick={() => setView('charges')} type="button" variant={view === 'charges' ? 'primary' : 'secondary'}>Frais étudiants</Button><Button onClick={() => setView('payments')} type="button" variant={view === 'payments' ? 'primary' : 'secondary'}>Paiements et reçus</Button></div>

      {view === 'charges' && <div className="finance-operation-layout">
        <form className="finance-operation-card" onSubmit={(event) => void createCharge(event)}>
          <h3>Ajouter des frais</h3>
          <label className="sp-form-field">Étudiant<select className="sp-field" required value={chargeForm.studentId} onChange={(event) => setChargeForm((v) => ({ ...v, studentId: event.target.value }))}><option value="">Sélectionner un étudiant</option>{students.map((student) => <option key={student.id} value={student.id}>{student.prenom} {student.nom}</option>)}</select></label>
          <label className="sp-form-field">Libellé<input className="sp-field" required maxLength={120} value={chargeForm.label} onChange={(event) => setChargeForm((v) => ({ ...v, label: event.target.value }))} /></label>
          <label className="sp-form-field">Montant (DH)<input className="sp-field" required min="0.01" step="0.01" type="number" value={chargeForm.amount} onChange={(event) => setChargeForm((v) => ({ ...v, amount: event.target.value }))} /></label>
          <label className="sp-form-field">Date limite (facultative)<input className="sp-field" type="date" value={chargeForm.dueDate} onChange={(event) => setChargeForm((v) => ({ ...v, dueDate: event.target.value }))} /></label>
          <label className="sp-form-field">Notes (facultatif)<textarea className="sp-field" rows={2} value={chargeForm.notes} onChange={(event) => setChargeForm((v) => ({ ...v, notes: event.target.value }))} /></label>
          <Button disabled={saving || students.length === 0} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer les frais'}</Button>
          {students.length === 0 && <p className="management-muted">Aucun étudiant disponible dans ce centre.</p>}
        </form>
        <div className="finance-operation-card"><h3>Frais enregistrés</h3>{charges.length === 0 ? <p className="management-muted">Aucun frais enregistré pour le moment.</p> : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Étudiant</th><th>Frais</th><th>Montant</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>{charges.map((charge) => { const paid = paidForCharge(charge.id); const remaining = Math.max(0, numeric(charge.amount_due) - paid); return <tr key={charge.id}><td>{studentName(charge.student_id)}</td><td>{charge.label}{charge.due_date && <small>Échéance : {charge.due_date}</small>}</td><td>{money(numeric(charge.amount_due))}</td><td>{money(paid)}</td><td>{money(remaining)}</td><td><span className={`finance-status finance-status-${charge.status}`}>{charge.status === 'paid' ? 'Payé' : charge.status === 'partial' ? 'Partiel' : 'À payer'}</span></td></tr>; })}</tbody></table></div>}</div>
      </div>}

      {view === 'payments' && <div className="finance-operation-layout">
        <form className="finance-operation-card" onSubmit={(event) => void recordPayment(event)}>
          <h3>Enregistrer un paiement</h3>
          <label className="sp-form-field">Frais de l’étudiant<select className="sp-field" required value={paymentForm.chargeId} onChange={(event) => setPaymentForm((v) => ({ ...v, chargeId: event.target.value }))}><option value="">Sélectionner des frais</option>{charges.filter((charge) => ['open', 'partial'].includes(charge.status)).map((charge) => <option key={charge.id} value={charge.id}>{studentName(charge.student_id)} — {charge.label} (reste {money(Math.max(0, numeric(charge.amount_due) - paidForCharge(charge.id)))})</option>)}</select></label>
          <label className="sp-form-field">Montant reçu (DH)<input className="sp-field" required min="0.01" step="0.01" type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((v) => ({ ...v, amount: event.target.value }))} /></label>
          <label className="sp-form-field">Mode de paiement<select className="sp-field" value={paymentForm.method} onChange={(event) => setPaymentForm((v) => ({ ...v, method: event.target.value }))}>{METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
          <label className="sp-form-field">Référence (facultative)<input className="sp-field" value={paymentForm.reference} onChange={(event) => setPaymentForm((v) => ({ ...v, reference: event.target.value }))} /></label>
          <label className="sp-form-field">Notes (facultatif)<textarea className="sp-field" rows={2} value={paymentForm.notes} onChange={(event) => setPaymentForm((v) => ({ ...v, notes: event.target.value }))} /></label>
          <Button disabled={saving || !charges.some((charge) => ['open', 'partial'].includes(charge.status))} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer le paiement'}</Button>
          {!charges.some((charge) => ['open', 'partial'].includes(charge.status)) && <p className="management-muted">Aucun frais en attente de paiement.</p>}
        </form>
        <div className="finance-operation-card"><h3>Historique des paiements</h3>{payments.length === 0 ? <p className="management-muted">Aucun paiement enregistré pour le moment.</p> : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Reçu</th><th>Étudiant</th><th>Montant</th><th>Mode</th><th>Date</th></tr></thead><tbody>{payments.map((payment) => { const charge = charges.find((item) => item.id === payment.charge_id); return <tr key={payment.id}><td>{payment.receipt_number}</td><td>{charge ? studentName(charge.student_id) : '—'}</td><td>{money(numeric(payment.amount))}</td><td>{METHODS.find((method) => method.value === payment.payment_method)?.label ?? payment.payment_method}</td><td>{new Date(payment.paid_at).toLocaleString('fr-MA')}</td></tr>; })}</tbody></table></div>}</div>
      </div>}
      <p className="finance-security-note">Accès réservé au directeur et à l’administrateur du centre. Les opérations financières sont conservées dans Supabase.</p>
    </section>
  );
}
