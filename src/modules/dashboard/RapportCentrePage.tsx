import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, LoadingState, PageHeader, Panel } from '../../components/ui';
import { getDashboardData } from '../../data/repositories/dashboardRepository';
import { getPlanningData } from '../../data/repositories/planningRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { DashboardData } from '../../types/dashboard';
import type { PlanningData } from '../../types/planning';
import { useAuth } from '../auth/AuthProvider';

function ReportLineChart({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length === 0) return <p className="sp-muted">Aucune inscription sur cette période.</p>;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: 24 + index * (552 / Math.max(1, values.length - 1)),
    y: 142 - (value / max) * 112,
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${points.at(-1)?.x ?? 576} 150 L 24 150 Z`;
  const labelIndexes = labels.length <= 8
    ? labels.map((_, index) => index)
    : Array.from({ length: 8 }, (_, index) => Math.round(index * (labels.length - 1) / 7));
  return <svg className="rc-chart-svg" viewBox="0 0 600 180" role="img" aria-label="Évolution des inscriptions sur la période sélectionnée">
    {[30, 65, 100, 135].map(y => <line key={y} x1="24" x2="576" y1={y} y2={y} className="rc-grid" />)}
    <path d={area} className="rc-area" />
    <path d={path} className="rc-line" />
    {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" className="rc-point" />)}
    {labelIndexes.map(index => <text key={`${labels[index]}-${index}`} x={points[index]?.x ?? 24} y="170" textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'} className="rc-axis-label">{labels[index]}</text>)}
  </svg>;
}

function DomainDonut({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const colors = ['#4f5ee8', '#21b8a6', '#71c8ec', '#8b9cfb', '#f0b45b'];
  let offset = 0;
  const circumference = 2 * Math.PI * 52;
  const segments = data.map((item, index) => {
    const length = total ? item.count / total * circumference : 0;
    const segment = { ...item, color: colors[index % colors.length], length, offset };
    offset += length;
    return segment;
  });
  return <div className="rc-donut-layout">
    <svg viewBox="0 0 150 150" role="img" aria-label={`Répartition de ${total} séances par domaine`}>
      <circle cx="75" cy="75" r="52" fill="none" stroke="var(--rc-track)" strokeWidth="19" />
      <g transform="rotate(-90 75 75)" fill="none" strokeWidth="19">
        {segments.map(s => <circle key={s.name} cx="75" cy="75" r="52" stroke={s.color} strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} />)}
      </g>
      <text x="75" y="72" textAnchor="middle" className="rc-donut-number">{total}</text>
      <text x="75" y="91" textAnchor="middle" className="rc-donut-caption">Séances</text>
    </svg>
    <ul className="rc-legend">{segments.map(s => <li key={s.name}><span><i style={{ background: s.color }} />{s.name}</span><b>{s.count}</b></li>)}</ul>
  </div>;
}

function MoroccoMap({ students, isTeacher }: { students: number; isTeacher: boolean }) {
  return <div className="rc-map-layout">
    <svg viewBox="0 0 330 260" role="img" aria-label="Carte stylisée du Maroc" className="rc-morocco-map">
      <defs><linearGradient id="rc-map-fill" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#dce5ed"/><stop offset="1" stopColor="#b8c9d8"/></linearGradient></defs>
      <path d="M88 18 L132 24 L155 40 L190 45 L211 66 L203 88 L220 106 L207 128 L214 148 L192 164 L185 187 L164 204 L151 238 L132 229 L119 207 L102 193 L95 170 L80 156 L75 134 L59 119 L67 98 L56 79 L69 58 L66 38 Z" fill="url(#rc-map-fill)" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M69 58 L111 67 L155 40 M59 119 L105 111 L203 88 M75 134 L129 143 L207 128 M95 170 L146 174 L192 164 M102 193 L164 204 M88 18 L93 50 L67 58" fill="none" stroke="#fff" strokeWidth="1.6"/>
      <path d="M67 58 L111 67 L105 111 L59 119 L67 98 L56 79 Z" fill="#4f5ee8" opacity=".92"/>
      <circle cx="85" cy="86" r="4" fill="#fff" stroke="#4f5ee8" strokeWidth="3"/>
      <text x="95" y="81" className="rc-map-city">Casablanca</text>
      <circle cx="102" cy="57" r="3" fill="#21b8a6" stroke="#fff" strokeWidth="2"/>
      <text x="111" y="54" className="rc-map-city">Rabat</text>
      <text x="153" y="118" textAnchor="middle" className="rc-map-label">MAROC</text>
    </svg>
    <div className="rc-map-stat"><span className="rc-map-dot" /> <div><strong>{students}</strong><small>{isTeacher ? 'Étudiants inscrits à vos cours' : 'Étudiants dans le centre'}</small></div></div>
  </div>;
}

export function RapportCentrePage() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [planningData, setPlanningData] = useState<PlanningData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [formationFilter, setFormationFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { from: format(from), to: format(today) };
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (!profile) throw new Error('Profil utilisateur indisponible.');
        if (profile.role === 'etudiant') throw new Error('Ce rapport n’est pas disponible pour votre rôle.');
        const client = getSupabaseClient();
        const centreId = profile.centreId ?? '';
        const [result, schedule] = await Promise.all([
          getDashboardData(client, centreId, profile.id, profile.role),
          getPlanningData(client, centreId, profile.id, profile.role),
        ]);
        if (active) setData(result);
        if (active) setPlanningData(schedule);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger le rapport.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [profile, refresh]);

  const availableCourses = useMemo(() => data?.courses.filter(course => {
    const group = planningData?.filters.groups.find(item => String(item.id) === String(course.groupId));
    return (!formationFilter || String(group?.formationId ?? '') === formationFilter)
      && (!groupFilter || String(course.groupId ?? '') === groupFilter);
  }) ?? [], [data, formationFilter, groupFilter, planningData]);
  const reportCourses = useMemo(() => availableCourses.filter(course =>
    !courseFilter || String(course.id) === courseFilter,
  ), [availableCourses, courseFilter]);
  const reportCourseIds = useMemo(() => new Set(reportCourses.map(course => String(course.id))), [reportCourses]);
  const reportEnrollments = useMemo(() => data?.enrollments.filter(enrollment => {
    const date = enrollment.createdAt?.slice(0, 10) ?? '';
    return reportCourseIds.has(String(enrollment.courseId)) && date >= dateRange.from && date <= dateRange.to;
  }) ?? [], [data, dateRange, reportCourseIds]);
  const reportPresences = useMemo(() => data?.presences.filter(presence =>
    reportCourseIds.has(String(presence.courseId))
    && presence.date.slice(0, 10) >= dateRange.from
    && presence.date.slice(0, 10) <= dateRange.to,
  ) ?? [], [data, dateRange, reportCourseIds]);
  const domains = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.subjects.filter(subject => reportCourses.some(course => String(course.subjectId) === String(subject.id))).forEach(subject => {
      const name = subject.domain || 'Autres';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [data, reportCourses]);
  const enrollmentSeries = useMemo(() => {
    const from = new Date(`${dateRange.from}T12:00:00`);
    const to = new Date(`${dateRange.to}T12:00:00`);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) return [];
    const monthly = to.getTime() - from.getTime() > 62 * 86400000;
    const buckets = new Map<string, { label: string; value: number }>();
    for (const date = new Date(from); date <= to;) {
      const key = monthly
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      buckets.set(key, {
        label: monthly
          ? date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
          : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        value: 0,
      });
      if (monthly) date.setMonth(date.getMonth() + 1, 1);
      else date.setDate(date.getDate() + 1);
    }
    for (const enrollment of reportEnrollments) {
      const date = enrollment.createdAt?.slice(0, 10);
      if (!date) continue;
      const bucket = buckets.get(monthly ? date.slice(0, 7) : date);
      if (bucket) bucket.value += 1;
    }
    return [...buckets.values()];
  }, [dateRange, reportEnrollments]);

  if (loading) return <section className="rc-page"><Panel><LoadingState label="Préparation du rapport du centre…" /></Panel></section>;
  if (error || !data) return <section className="rc-page"><PageHeader eyebrow="Analyse" title="Rapport" /><Alert tone="error">{error || 'Aucune donnée disponible.'}<div className="mt-3"><Button onClick={() => setRefresh(n => n + 1)} type="button" variant="secondary">Réessayer</Button></div></Alert></section>;

  const isTeacher = profile?.role === 'formateur';
  const validDateRange = Boolean(dateRange.from && dateRange.to && dateRange.from <= dateRange.to);
  const totalStudents = isTeacher ? new Set(reportEnrollments.map(enrollment => String(enrollment.studentId))).size : data.studentIds.length;
  const present = reportPresences.filter(p => p.status === 'present' || p.status === 'retard').length;
  const attendanceRate = reportPresences.length ? Math.round(present / reportPresences.length * 100) : 0;
  const weekly = ['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'].map((label, index) => {
    const count = reportCourses.filter(course => ((course.weekday + 6) % 7) === index).length;
    return { label, count };
  });
  const weeklyMax = Math.max(1, ...weekly.map(day => day.count));
  const exportReport = () => {
    const subjectById = new Map(data.subjects.map(subject => [String(subject.id), subject.name]));
    const courseName = new Map(reportCourses.map(course => [
      String(course.id),
      subjectById.get(String(course.subjectId)) ?? 'Cours sans nom',
    ]));
    const csvRows = [
      ['Type', 'Date', 'Cours', 'Statut'],
      ...reportEnrollments.map(enrollment => [
        'Inscription',
        enrollment.createdAt?.slice(0, 10) ?? '',
        courseName.get(String(enrollment.courseId)) ?? '',
        'Inscrit',
      ]),
      ...reportPresences.map(presence => [
        'Présence',
        presence.date.slice(0, 10),
        courseName.get(String(presence.courseId)) ?? '',
        presence.status,
      ]),
    ];
    const csv = `\uFEFF${csvRows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rapport-${dateRange.from}-${dateRange.to}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <section className="rc-page" aria-labelledby="rc-title">
    <div className="rc-heading-row">
      <PageHeader eyebrow={isTeacher ? 'Espace formateur' : 'Pilotage du centre'} title={isTeacher ? 'Mon rapport pédagogique' : 'Rapport du centre'} description={isTeacher ? 'Analysez vos inscriptions, vos cours et le suivi de présence de vos groupes.' : 'Analysez les inscriptions, les formations et les présences de votre centre.'} />
      <Button onClick={() => setRefresh(n => n + 1)} type="button" variant="secondary">↻ Actualiser</Button>
    </div>
    <Panel className="rc-filters">
      <label className="sp-form-field">Du<input className="sp-field" onChange={event => setDateRange(current => ({ ...current, from: event.target.value }))} type="date" value={dateRange.from} /></label>
      <label className="sp-form-field">Au<input className="sp-field" onChange={event => setDateRange(current => ({ ...current, to: event.target.value }))} type="date" value={dateRange.to} /></label>
      <label className="sp-form-field">Formation<select className="sp-field" onChange={event => { setFormationFilter(event.target.value); setGroupFilter(''); setCourseFilter(''); }} value={formationFilter}><option value="">Toutes les formations</option>{(planningData?.filters.formations ?? []).map(formation => <option key={String(formation.id)} value={String(formation.id)}>{formation.name}</option>)}</select></label>
      <label className="sp-form-field">Groupe<select className="sp-field" disabled={!planningData} onChange={event => { setGroupFilter(event.target.value); setCourseFilter(''); }} value={groupFilter}><option value="">Tous les groupes</option>{(planningData?.filters.groups ?? []).filter(group => !formationFilter || String(group.formationId ?? '') === formationFilter).map(group => <option key={String(group.id)} value={String(group.id)}>{group.name}</option>)}</select></label>
      <label className="sp-form-field">Cours<select className="sp-field" disabled={!planningData} onChange={event => setCourseFilter(event.target.value)} value={courseFilter}><option value="">Tous les cours</option>{availableCourses.map(course => <option key={String(course.id)} value={String(course.id)}>{data.subjects.find(subject => String(subject.id) === String(course.subjectId))?.name ?? 'Cours sans nom'}</option>)}</select></label>
      <Button disabled={!validDateRange || (!reportEnrollments.length && !reportPresences.length)} onClick={exportReport} type="button" variant="secondary">Exporter CSV</Button>
      {!validDateRange && <small className="rc-filter-error">Sélectionnez une période valide, avec une date de début antérieure à la date de fin.</small>}
    </Panel>
    <div className="rc-kpis">
      <article className="rc-kpi"><span className="rc-kpi-icon violet">♙</span><small>Étudiants inscrits</small><strong>{totalStudents}</strong><span className="rc-kpi-foot">{isTeacher ? 'Étudiants inscrits à vos cours' : 'Effectif du centre'}</span></article>
      <article className="rc-kpi"><span className="rc-kpi-icon mint">▦</span><small>{isTeacher ? 'Mes cours' : 'Formations'}</small><strong>{isTeacher ? reportCourses.length : (data.formationCount ?? '—')}</strong><span className="rc-kpi-foot">{isTeacher ? 'Cours dans le filtre sélectionné' : 'Catalogue du centre'}</span></article>
      <article className="rc-kpi"><span className="rc-kpi-icon blue">♧</span><small>{isTeacher ? 'Matières enseignées' : 'Formateurs'}</small><strong>{isTeacher ? new Set(data.courses.map(course => String(course.subjectId)).filter(id => id !== 'null')).size : data.teachers.length}</strong><span className="rc-kpi-foot">{isTeacher ? 'Dans vos cours' : 'Équipe pédagogique'}</span></article>
      <article className="rc-kpi"><span className="rc-kpi-icon amber">✓</span><small>Taux de présence</small><strong>{reportPresences.length ? `${attendanceRate}%` : '—'}</strong><span className="rc-kpi-foot">{reportPresences.length} pointages sur la période</span></article>
    </div>
    <div className="rc-grid rc-grid-top">
      <Panel className="rc-panel rc-wide"><div className="rc-panel-heading"><div><h2>{isTeacher ? 'Évolution de vos inscriptions' : 'Évolution des inscriptions'}</h2><p>{isTeacher ? 'Inscriptions à vos cours sur la période sélectionnée' : 'Inscriptions du centre sur la période sélectionnée'}</p></div><span className="rc-chart-key"><i /> Inscriptions</span></div><ReportLineChart values={enrollmentSeries.map(point => point.value)} labels={enrollmentSeries.map(point => point.label)} /></Panel>
      <Panel className="rc-panel"><div className="rc-panel-heading"><div><h2>{isTeacher ? 'Mon activité hebdomadaire' : 'Activité hebdomadaire'}</h2><p>{isTeacher ? 'Vos cours programmés par jour' : 'Cours programmés par jour'}</p></div></div><div className="rc-bars">{weekly.map(day => <div className="rc-bar-col" key={day.label}><span>{day.count || ''}</span><div className="rc-bar-track"><i style={{ height: `${Math.max(day.count ? 8 : 2, day.count / weeklyMax * 100)}%` }} /></div><small>{day.label}</small></div>)}</div></Panel>
    </div>
    <div className="rc-grid rc-grid-bottom">
      <Panel className="rc-panel"><div className="rc-panel-heading"><div><h2>{isTeacher ? 'Répartition de mes matières' : 'Répartition par domaine'}</h2><p>{isTeacher ? 'Matières de vos cours' : 'Basée sur les matières du centre'}</p></div></div>{domains.length ? <DomainDonut data={domains} /> : <p className="sp-muted">Aucune matière renseignée pour le moment.</p>}</Panel>
      <Panel className="rc-panel"><div className="rc-panel-heading"><div><h2>{isTeacher ? 'Mes étudiants' : 'Présence du centre'}</h2><p>{isTeacher ? 'Effectif inscrit à vos cours' : 'Vue géographique illustrative'}</p></div><span className="rc-map-chip">Maroc</span></div><MoroccoMap students={totalStudents} isTeacher={isTeacher} /><p className="rc-map-note">Carte de présentation du Maroc — la répartition par ville sera affichée si les données géographiques sont disponibles.</p></Panel>
      <Panel className="rc-panel rc-channel-panel"><div className="rc-panel-heading"><div><h2>{isTeacher ? 'Mes cours' : 'Formations populaires'}</h2><p>{isTeacher ? 'Cours qui vous sont attribués' : 'Classement selon les effectifs disponibles'}</p></div></div>{isTeacher ? (reportCourses.length ? <div className="rc-table-wrap"><table className="rc-table"><thead><tr><th>Jour</th><th>Horaire</th><th>Salle</th></tr></thead><tbody>{reportCourses.slice(0, 8).map(course => <tr key={String(course.id)}><td>{['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][course.weekday] ?? '—'}</td><td>{course.startsAt} – {course.endsAt}</td><td>{course.roomName ?? '—'}</td></tr>)}</tbody></table></div> : <p className="sp-muted">Aucun cours ne vous est attribué.</p>) : (data.popularFormations.length ? <div className="rc-table-wrap"><table className="rc-table"><thead><tr><th>Formation</th><th>Étudiants</th><th>Répartition</th></tr></thead><tbody>{data.popularFormations.slice(0, 5).map(item => <tr key={item.name}><td>{item.name}</td><td>{item.studentCount}</td><td><span className="rc-progress"><i style={{ width: `${Math.min(100, item.studentCount / Math.max(1, ...data.popularFormations.map(x => x.studentCount)) * 100)}%` }} /></span></td></tr>)}</tbody></table></div> : <p className="sp-muted">Pas encore de données de formation.</p>)}</Panel>
    </div>
    <p className="rc-footnote">Les indicateurs sont calculés à partir des données accessibles pour le centre connecté. La carte ne représente pas encore des effectifs réels par région.</p>
  </section>;
}
