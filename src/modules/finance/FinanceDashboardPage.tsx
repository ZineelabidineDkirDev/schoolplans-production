import { useEffect, useState } from 'react';
import { Alert, LoadingState } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';
import { useAuth } from '../auth/AuthProvider';

type ChargeRow = { id: string; amount_due: number | string };
type AmountRow = { amount: number | string };
type PayrollRow = { amount_due: number | string; status: string };

type FinanceSummary = {
  charges: number;
  collected: number;
  expenses: number;
  payrollDue: number;
  chargeCount: number;
  expenseCount: number;
  payrollCount: number;
};

const EMPTY_SUMMARY: FinanceSummary = {
  charges: 0,
  collected: 0,
  expenses: 0,
  payrollDue: 0,
  chargeCount: 0,
  expenseCount: 0,
  payrollCount: 0,
};

function amount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function FinanceDashboardPage() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFinance() {
      setLoading(true);
      setError(null);
      try {
        if (!profile?.centreId) {
          throw new Error('Votre compte n’est pas rattaché à un établissement.');
        }

        const client = getSupabaseClient();
        const [chargesResult, paymentsResult, expensesResult, payrollResult] = await Promise.all([
          client.from('finance_student_charges').select('id,amount_due').eq('centre_id', profile.centreId),
          client.from('finance_payments').select('amount').eq('centre_id', profile.centreId),
          client.from('finance_expenses').select('amount').eq('centre_id', profile.centreId).eq('status', 'paid'),
          client.from('finance_teacher_payroll').select('amount_due,status').eq('centre_id', profile.centreId),
        ]);

        const failed = [chargesResult, paymentsResult, expensesResult, payrollResult].find((result) => result.error);
        if (failed?.error) {
          if (failed.error.code === '42P01' || failed.error.code === 'PGRST205') {
            throw new Error('Le schéma Finance n’est pas encore installé dans Supabase. Appliquez la migration backend/supabase/migrations/202610180001_school_finance.sql, puis rechargez cette page.');
          }
          throw failed.error;
        }

        const charges = (chargesResult.data ?? []) as ChargeRow[];
        const payments = (paymentsResult.data ?? []) as AmountRow[];
        const expenses = (expensesResult.data ?? []) as AmountRow[];
        const payroll = (payrollResult.data ?? []) as PayrollRow[];
        const nextSummary: FinanceSummary = {
          charges: charges.reduce((total, row) => total + amount(row.amount_due), 0),
          collected: payments.reduce((total, row) => total + amount(row.amount), 0),
          expenses: expenses.reduce((total, row) => total + amount(row.amount), 0),
          payrollDue: payroll.filter((row) => row.status === 'approved').reduce((total, row) => total + amount(row.amount_due), 0),
          chargeCount: charges.length,
          expenseCount: expenses.length,
          payrollCount: payroll.filter((row) => row.status === 'approved').length,
        };
        if (active) setSummary(nextSummary);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger les données financières.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFinance();
    return () => {
      active = false;
    };
  }, [profile?.centreId]);

  const outstanding = Math.max(0, summary.charges - summary.collected);
  const metrics = [
    { label: 'Frais de scolarité', value: money(summary.charges), note: `${summary.chargeCount} frais enregistrés`, tone: 'brand' },
    { label: 'Recettes encaissées', value: money(summary.collected), note: 'Total des paiements enregistrés', tone: 'positive' },
    { label: 'Reste à encaisser', value: money(outstanding), note: 'Frais dus moins paiements', tone: 'warning' },
    { label: 'Dépenses payées', value: money(summary.expenses), note: `${summary.expenseCount} dépenses payées`, tone: 'neutral' },
    { label: 'Rémunérations à payer', value: money(summary.payrollDue), note: `${summary.payrollCount} rémunérations approuvées`, tone: 'neutral' },
    { label: 'Solde net indicatif', value: money(summary.collected - summary.expenses), note: 'Encaissements moins dépenses payées', tone: 'brand' },
  ];

  if (loading) return <LoadingState label="Chargement du module Finance…" />;

  return (
    <section className="sp-page finance-page">
      <div className="finance-page-heading">
        <div>
          <p className="sp-page-eyebrow">Gestion de l’établissement</p>
          <h1 className="sp-page-title">Gestion financière</h1>
          <p className="sp-muted">Suivez les frais de scolarité, les encaissements, les dépenses et les rémunérations.</p>
        </div>
        <span className="finance-currency-pill">Devise : MAD</span>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="finance-metrics-grid">
        {metrics.map((metric) => (
          <article className={`finance-metric-card finance-tone-${metric.tone}`} key={metric.label}>
            <p>{metric.label}</p>
            <strong>{error ? '—' : metric.value}</strong>
            <span>{metric.note}</span>
          </article>
        ))}
      </div>

      <div className="finance-section-heading">
        <div>
          <h2>Modules financiers</h2>
          <p>La base du module est en place ; les écrans opérationnels seront ajoutés progressivement.</p>
        </div>
      </div>
      <div className="finance-feature-grid">
        <article className="finance-feature-card"><span aria-hidden="true">↘</span><div><h3>Frais et paiements</h3><p>Échéanciers, paiements partiels, impayés et reçus numérotés.</p><small>Prochaine étape</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">↗</span><div><h3>Dépenses</h3><p>Fournisseurs, justificatifs, catégories et validation des dépenses.</p><small>À développer</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">▤</span><div><h3>Trésorerie</h3><p>Caisses, comptes bancaires, mouvements et transferts.</p><small>À développer</small></div></article>
        <article className="finance-feature-card"><span aria-hidden="true">◎</span><div><h3>Rémunérations</h3><p>Calcul depuis les séances réalisées, approbation et historique des paiements.</p><small>À développer</small></div></article>
      </div>
      <p className="finance-security-note">Accès réservé au directeur et à l’administrateur de l’établissement. Les données restent isolées par établissement au niveau de Supabase.</p>
    </section>
  );
}
