import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Button, EmptyState, Field, LoadingState, PageHeader, Panel, notify } from '../../components/ui';
import { getSupabaseClient } from '../../data/supabase/client';
import { useAuth } from '../auth/AuthProvider';

type Evaluation = { id: string; titre: string; periode: string; cours_id: string; note_max: number; coefficient: number; statut: string };
type Student = { id: string; nom: string; prenom: string | null; groupe_id: string | null };
type Course = { id: string; label: string };
type Grade = { id: string; evaluation_id: string; student_id: string; note: number; tentative: number; note_initiale_id: string | null };
type Bulletin = { id: string; student_id: string; periode: string; formation_id: string | null; moyenne: number | null; statut: string; contenu: Record<string, unknown> };

const errText = (error: unknown) => error instanceof Error ? error.message : 'Une erreur est survenue.';
const numeric = (value: string, fallback: number) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };

export function NotesBulletinsPage() {
  const { profile, session } = useAuth();
  const centreId = profile?.centreId ?? '';
  const role = profile?.role ?? 'etudiant';
  const canEdit = role === 'admin' || role === 'director' || role === 'formateur';
  const canValidate = role === 'admin' || role === 'director';
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState('');
  const [titre, setTitre] = useState('');
  const [periode, setPeriode] = useState('Semestre 1');
  const [coursId, setCoursId] = useState('');
  const [noteMax, setNoteMax] = useState('20');
  const [coefficient, setCoefficient] = useState('1');
  const [barremeMax, setBaremeMax] = useState('20');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [rattrapageStudent, setRattrapageStudent] = useState('');
  const [rattrapageScore, setRattrapageScore] = useState('');

  const load = useCallback(async () => {
    if (!centreId) { setError('Votre profil doit être rattaché à un centre.'); setLoading(false); return; }
    setLoading(true); setError(null);
    const db = getSupabaseClient();
    try {
      const studentQuery = role === 'etudiant' && session?.user.email
        ? db.from('etudiants').select('id,nom,prenom,groupe_id').eq('centre_id', centreId).ilike('email', session.user.email).limit(1)
        : db.from('etudiants').select('id,nom,prenom,groupe_id').eq('centre_id', centreId).order('nom');
      const [ev, st, gr, bu] = await Promise.all([
        role === 'etudiant' ? Promise.resolve({ data: [], error: null }) : db.from('grade_evaluations').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }),
        studentQuery,
        role === 'etudiant' ? Promise.resolve({ data: [], error: null }) : db.from('grade_entries').select('*').eq('centre_id', centreId),
        db.from('grade_bulletins').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }),
      ]);
      for (const result of [ev, st, gr, bu]) if (result.error) throw result.error;
      setEvaluations((ev.data ?? []) as Evaluation[]);
      setStudents((st.data ?? []) as Student[]);
      setCurrentStudentId(st.data?.[0]?.id == null ? null : String(st.data[0].id));
      if (role !== 'etudiant') {
        const { data: courseRows, error: courseError } = await db.from('cours').select('id').eq('centre_id', centreId).order('id');
        if (courseError) throw courseError;
        setCourses((courseRows ?? []).map((row) => ({ id: String(row.id), label: 'Cours #' + String(row.id) })));
      }
      setGrades((gr.data ?? []) as Grade[]);
      setBulletins((bu.data ?? []) as Bulletin[]);
      if (!selectedEvaluation && ev.data?.[0]?.id) setSelectedEvaluation(ev.data[0].id);
    } catch (cause) { setError(errText(cause)); }
    finally { setLoading(false); }
  }, [centreId, selectedEvaluation, role, session?.user.email]);

  useEffect(() => { void load(); }, [load]);

  const activeEvaluation = evaluations.find((e) => e.id === selectedEvaluation) ?? null;
  const currentGrades = useMemo(() => grades.filter((g) => g.evaluation_id === selectedEvaluation), [grades, selectedEvaluation]);
  const gradeByStudent = useMemo(() => new Map(currentGrades.map((g) => [g.student_id, g])), [currentGrades]);

  async function createEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!centreId || !titre.trim() || !coursId.trim()) { setError('Renseignez le titre et l’identifiant du cours.'); return; }
    const max = numeric(noteMax, 0), coef = numeric(coefficient, 0);
    if (max <= 0 || coef <= 0) { setError('La note maximale et le coefficient doivent être supérieurs à zéro.'); return; }
    setBusy(true); setError(null);
    try {
      const { data, error: saveError } = await getSupabaseClient().from('grade_evaluations').insert({
        centre_id: centreId, titre: titre.trim(), periode: periode.trim() || 'Période non définie',
        cours_id: coursId.trim(), note_max: max, coefficient: coef, cree_par: profile?.id,
      }).select('*').single();
      if (saveError) throw saveError;
      setTitre(''); setSelectedEvaluation(data.id); await load(); notify('Évaluation créée.', 'success');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }

  async function saveGrades() {
    if (!activeEvaluation) return;
    setBusy(true); setError(null);
    try {
      const rows = Object.entries(scores).filter(([, value]) => value.trim() !== '').map(([studentId, value]) => {
        const score = Number(value);
        if (!Number.isFinite(score) || score < 0 || score > activeEvaluation.note_max) throw new Error('Chaque note doit être comprise entre 0 et ' + activeEvaluation.note_max + '.');
        return { centre_id: centreId, evaluation_id: activeEvaluation.id, student_id: studentId, note: score, tentative: 1, cree_par: profile?.id };
      });
      if (!rows.length) throw new Error('Saisissez au moins une note.');
      const { error: saveError } = await getSupabaseClient().from('grade_entries').upsert(rows, { onConflict: 'evaluation_id,student_id,tentative' });
      if (saveError) throw saveError;
      setScores({}); await load(); notify('Notes enregistrées.', 'success');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }

  async function saveRetake() {
    if (!activeEvaluation || !rattrapageStudent || rattrapageScore.trim() === '') { setError('Choisissez un étudiant et saisissez la note de rattrapage.'); return; }
    const score = Number(rattrapageScore);
    if (!Number.isFinite(score) || score < 0 || score > activeEvaluation.note_max) { setError('La note de rattrapage doit être comprise entre 0 et ' + activeEvaluation.note_max + '.'); return; }
    const initial = gradeByStudent.get(rattrapageStudent);
    if (!initial) { setError('Une note initiale doit exister avant le rattrapage.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: saveError } = await getSupabaseClient().from('grade_entries').upsert({
        centre_id: centreId, evaluation_id: activeEvaluation.id, student_id: rattrapageStudent,
        note: score, tentative: 2, note_initiale_id: initial.id, cree_par: profile?.id,
      }, { onConflict: 'evaluation_id,student_id,tentative' });
      if (saveError) throw saveError;
      setRattrapageStudent(''); setRattrapageScore(''); await load(); notify('Rattrapage enregistré ; la note initiale est conservée.', 'success');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }

  async function submitBulletins() {
    if (!evaluations.length || !students.length) { setError('Il faut au moins une évaluation et un étudiant.'); return; }
    setBusy(true); setError(null);
    try {
      const db = getSupabaseClient();
      const rows = students.map((student) => {
        const studentEntries = grades.filter((g) => g.student_id === String(student.id));
        const relevant = studentEntries.map((g) => ({ grade: g, evaluation: evaluations.find((e) => e.id === g.evaluation_id) })).filter((x) => x.evaluation);
        const latestByEvaluation = new Map<string, { grade: Grade; evaluation: Evaluation }>();
        for (const item of relevant as { grade: Grade; evaluation: Evaluation }[]) {
          const prev = latestByEvaluation.get(item.evaluation.id);
          if (!prev || item.grade.tentative > prev.grade.tentative) latestByEvaluation.set(item.evaluation.id, item);
        }
        const finalRows = [...latestByEvaluation.values()];
        const denominator = finalRows.reduce((sum, x) => sum + Number(x.evaluation.coefficient), 0);
        const moyenne = denominator ? finalRows.reduce((sum, x) => sum + (Number(x.grade.note) / Number(x.evaluation.note_max)) * barremeMaxNumber * Number(x.evaluation.coefficient), 0) / denominator : null;
        return {
          centre_id: centreId, student_id: String(student.id), periode, formation_id: null, moyenne,
          statut: 'soumis', soumis_par: profile?.id,
          contenu: { etudiant: [student.prenom, student.nom].filter(Boolean).join(' '), periode, bareme_max: barremeMaxNumber,
            lignes: finalRows.map((x) => ({ evaluation: x.evaluation.titre, note: x.grade.note, note_max: x.evaluation.note_max, coefficient: x.evaluation.coefficient, tentative: x.grade.tentative })) },
        };
      });
      const { error: saveError } = await db.from('grade_bulletins').upsert(rows, { onConflict: 'centre_id,student_id,periode' });
      if (saveError) throw saveError;
      await load(); notify('Bulletins soumis au Directeur pour validation.', 'success');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }
  const barremeMaxNumber = Math.max(1, numeric(barremeMax, 20));

  async function changeBulletinStatus(bulletin: Bulletin, status: 'valide' | 'publie') {
    setBusy(true); setError(null);
    try {
      const { error: updateError } = await getSupabaseClient().from('grade_bulletins').update({
        statut: status, ...(status === 'valide' ? { valide_par: profile?.id, valide_le: new Date().toISOString() } : { publie_par: profile?.id, publie_le: new Date().toISOString() }),
      }).eq('id', bulletin.id).eq('centre_id', centreId);
      if (updateError) throw updateError;
      await load(); notify(status === 'valide' ? 'Bulletin validé.' : 'Bulletin publié.', 'success');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState label="Chargement des notes et bulletins…" />;
  return <section className="sp-page">
    <PageHeader eyebrow="Suivi pédagogique" title="Notes & Bulletins" description="Saisissez les évaluations, conservez les rattrapages et soumettez les bulletins au Directeur." />
    {error && <Alert tone="error">{error}</Alert>}
    {role === 'etudiant' ? <Panel title="Mes bulletins"><div className="space-y-3">{bulletins.filter((b) => b.statut === 'publie' && String(b.student_id) === currentStudentId).map((b) => <article key={b.id} className="rounded-xl border p-4"><h3 className="font-semibold">{b.periode}</h3><p>Moyenne : {b.moyenne == null ? 'Non calculée' : Number(b.moyenne).toFixed(2)}</p><Button onClick={() => window.print()} type="button">Imprimer / PDF</Button></article>)}{!bulletins.some((b) => b.statut === 'publie' && String(b.student_id) === currentStudentId) && <EmptyState title="Aucun bulletin publié" description="Vos bulletins validés apparaîtront ici." />}</div></Panel> : <>
      {canEdit && <Panel title="Créer une évaluation" description="Le barème maximal est configurable. Sélectionnez un cours déjà créé dans SchoolPlans.">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void createEvaluation(event)}>
          <Field label="Titre de l’évaluation"><input className="sp-input" value={titre} onChange={(e) => setTitre(e.target.value)} required placeholder="Ex. Examen final" /></Field>
          <Field label="Période du bulletin"><input className="sp-input" value={periode} onChange={(e) => setPeriode(e.target.value)} required placeholder="Semestre 1" /></Field>
          <Field label="Cours"><select className="sp-input" value={coursId} onChange={(e) => setCoursId(e.target.value)} required><option value="">Choisir un cours</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}</select></Field>
          <Field label="Note maximale"><input className="sp-input" type="number" min="1" step="0.25" value={noteMax} onChange={(e) => setNoteMax(e.target.value)} required /></Field>
          <Field label="Coefficient"><input className="sp-input" type="number" min="0.01" step="0.01" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} required /></Field>
          <Button disabled={busy} type="submit">Créer l’évaluation</Button>
        </form>
      </Panel>}
      <Panel title="Saisie des notes" description="Les notes manquantes restent vides et ne sont pas considérées comme zéro.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Évaluation"><select className="sp-input" value={selectedEvaluation} onChange={(e) => setSelectedEvaluation(e.target.value)}><option value="">Choisir une évaluation</option>{evaluations.map((e) => <option key={e.id} value={e.id}>{e.titre} — {e.periode}</option>)}</select></Field>
          <Field label="Barème du bulletin"><input className="sp-input" type="number" min="1" step="0.25" value={barremeMax} onChange={(e) => setBaremeMax(e.target.value)} /></Field>
        </div>
        {activeEvaluation && canEdit ? <div className="mt-4 space-y-2">{students.map((student) => {
          const id = String(student.id); const existing = gradeByStudent.get(id);
          return <div key={id} className="grid items-center gap-2 rounded-lg border p-3 md:grid-cols-[1fr_150px_120px]"><span>{[student.prenom, student.nom].filter(Boolean).join(' ') || id}</span><input className="sp-input" aria-label={'Note de '+student.nom} type="number" min="0" max={activeEvaluation.note_max} step="0.25" value={scores[id] ?? (existing ? String(existing.note) : '')} onChange={(e) => setScores((old) => ({ ...old, [id]: e.target.value }))} placeholder={'/ '+activeEvaluation.note_max} /><span className="text-sm text-muted-foreground">{existing ? 'Enregistrée' : 'Non saisie'}</span></div>;
        })}<div className="mt-3"><Button disabled={busy} onClick={() => void saveGrades()} type="button">Enregistrer les notes</Button></div></div> : !activeEvaluation ? <EmptyState title="Choisissez une évaluation" description="Créez une évaluation puis sélectionnez-la pour saisir les notes." /> : <p>Consultation des notes.</p>}
      </Panel>
      {canEdit && activeEvaluation && <Panel title="Rattrapage" description="Une deuxième tentative est enregistrée séparément ; la note initiale reste dans l’historique.">
        <div className="grid gap-3 md:grid-cols-3"><Field label="Étudiant"><select className="sp-input" value={rattrapageStudent} onChange={(e) => setRattrapageStudent(e.target.value)}><option value="">Choisir</option>{students.filter((s) => gradeByStudent.has(String(s.id))).map((s) => <option key={String(s.id)} value={String(s.id)}>{[s.prenom,s.nom].filter(Boolean).join(' ')}</option>)}</select></Field><Field label="Note de rattrapage"><input className="sp-input" type="number" min="0" max={activeEvaluation.note_max} step="0.25" value={rattrapageScore} onChange={(e) => setRattrapageScore(e.target.value)} /></Field><div className="self-end"><Button disabled={busy} onClick={() => void saveRetake()} type="button">Enregistrer le rattrapage</Button></div></div>
      </Panel>}
      <Panel title="Bulletins par période" description="La dernière tentative est utilisée pour le calcul. Le Directeur valide avant publication.">
        {canEdit && <div className="mb-3 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void submitBulletins()} type="button">Calculer et soumettre les bulletins</Button><Button variant="secondary" onClick={() => window.print()} type="button">Imprimer / PDF</Button></div>}
        {bulletins.filter((b) => role === 'etudiant' ? b.statut === 'publie' && String(b.student_id) === currentStudentId : true).map((b) => <article key={b.id} className="mb-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{String(b.contenu?.etudiant ?? b.student_id)} — {b.periode}</h3><p>Moyenne : {b.moyenne == null ? 'Incomplète' : Number(b.moyenne).toFixed(2)} / {barremeMaxNumber}</p><p className="text-sm">Statut : {b.statut}</p></div>{canValidate && b.statut === 'soumis' && <Button disabled={busy} onClick={() => void changeBulletinStatus(b,'valide')} type="button">Valider</Button>}{canValidate && b.statut === 'valide' && <Button disabled={busy} onClick={() => void changeBulletinStatus(b,'publie')} type="button">Publier</Button>}</div></article>)}
        {!bulletins.length && <EmptyState title="Aucun bulletin" description="Les bulletins soumis apparaîtront dans cette liste." />}
      </Panel>
    </>}
  </section>;
}
