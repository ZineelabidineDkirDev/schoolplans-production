import { useEffect, useState } from 'react';
import { Alert, Button, EmptyState, LoadingState, PageHeader, Panel } from '../../components/ui';
import {
  getStudentWorkspace,
  type StudentWorkspace,
} from '../../data/repositories/studentWorkspaceRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import { useAuth } from '../auth/AuthProvider';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; workspace: StudentWorkspace };

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const ATTENDANCE_LABELS = {
  present: 'Présent',
  retard: 'En retard',
  absent: 'Absent',
} as const;

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
}

type ReportIconName = 'courses' | 'hours' | 'completed' | 'attendance';

function ReportIcon({ name }: { name: ReportIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    className: 'h-6 w-6',
  };
  return (
    <svg {...common}>
      {name === 'courses' && <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h7" /></>}
      {name === 'hours' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>}
      {name === 'completed' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 8" /></>}
      {name === 'attendance' && <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-7" /><path d="M16 6h3v3" /></>}
    </svg>
  );
}

export function StudentWorkspacePage({ view }: { view: 'courses' | 'attendance' | 'planning' | 'rooms' | 'report' }) {
  const { profile, session } = useAuth();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile?.centreId) {
        setState({ status: 'error', message: 'Votre profil n’est pas rattaché à un centre.' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const workspace = await getStudentWorkspace(
          getSupabaseClient(),
          profile.centreId,
          session?.user.email ?? '',
        );
        if (active) setState({ status: 'loaded', workspace });
      } catch (cause) {
        if (active) {
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Impossible de charger votre espace.',
          });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [profile?.centreId, session?.user.email, reload]);

  const isCourses = view === 'courses' || view === 'planning';
  const isPlanning = view === 'planning';
  const isRooms = view === 'rooms';
  const isReport = view === 'report';
  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        description={
          isPlanning
            ? 'Votre emploi du temps personnel, limité aux cours auxquels vous êtes inscrit.'
            : isRooms
              ? 'Consultez les salles prévues pour vos cours et leurs horaires.'
              : isReport
                ? 'Vos statistiques personnelles de formation, vos heures et votre assiduité.'
              : isCourses
                ? 'Retrouvez les séances planifiées pour les cours auxquels vous êtes inscrit.'
                : 'Consultez vos présences, retards et absences enregistrés par le centre.'
        }
        eyebrow="Espace étudiant"
        title={isPlanning ? 'Mon planning' : isRooms ? 'Mes salles de cours' : isReport ? 'Mon rapport de formation' : isCourses ? 'Mes cours' : 'Mes présences'}
      />
      {state.status === 'loading' && (
        <Panel>
          <LoadingState label="Chargement de votre espace étudiant…" />
        </Panel>
      )}
      {state.status === 'error' && (
        <Panel className="space-y-3">
          <EmptyState
            description={state.message}
            title="Votre espace étudiant n’a pas pu être chargé."
          />
          <Button onClick={() => setReload((value) => value + 1)} type="button" variant="secondary">
            Réessayer
          </Button>
        </Panel>
      )}
      {state.status === 'loaded' && !state.workspace.studentFound && (
        <Alert tone="warning">
          Votre compte n’est relié à aucun dossier étudiant dans ce centre. Demandez à
          l’administration de vérifier que votre dossier utilise l’adresse e-mail de connexion.
        </Alert>
      )}
      {state.status === 'loaded' && state.workspace.studentFound && isRooms && (
        <div className="space-y-4">
          {state.workspace.courses.length === 0 ? (
            <EmptyState title="Aucun cours inscrit" description="Aucune salle ne peut être affichée car aucun cours n’est associé à votre inscription." />
          ) : (
            <>
              {[...new Map(state.workspace.courses.filter(course => course.room).map(course => [course.room, course])).entries()]
                .sort(([a], [b]) => a.localeCompare(b, 'fr'))
                .map(([room, firstCourse]) => {
                  const roomCourses = state.workspace.courses.filter(course => course.room === room)
                    .sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
                  return (
                    <Panel key={room} className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--sp-accent-soft,rgba(79,94,232,.12))] text-xl" aria-hidden="true">▦</div>
                          <div>
                            <h2 className="text-lg font-semibold">{room}</h2>
                            <p className="sp-muted mt-1">{firstCourse.roomType || 'Salle de formation'}</p>
                          </div>
                        </div>
                        <span className="rounded-full border px-3 py-1 text-sm">{firstCourse.roomCapacity !== null ? `${firstCourse.roomCapacity} places` : 'Capacité non renseignée'}</span>
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Cours programmés dans cette salle</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {roomCourses.map(course => (
                            <div key={String(course.id)} className="rounded-xl border p-3">
                              <strong>{course.subject}</strong>
                              <p className="sp-muted mt-1">{course.teacher || 'Formateur non renseigné'}</p>
                              <p className="mt-2 text-sm">{course.startsOn && course.startsOn === course.endsOn ? displayDate(course.startsOn) : WEEKDAYS[course.weekday] ?? 'Jour à confirmer'}</p>
                              <p className="text-sm">{course.startsAt.slice(0, 5)} – {course.endsAt.slice(0, 5)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Panel>
                  );
                })}
              {state.workspace.courses.every(course => !course.room) ? (
                <Panel className="space-y-2">
                  <h2 className="font-semibold">Aucune salle affectée</h2>
                  <p className="sp-muted">Vous êtes inscrit à des cours, mais aucune salle n’est renseignée pour ces cours. Contactez l’administration de votre centre.</p>
                </Panel>
              ) : state.workspace.courses.some(course => !course.room) ? (
                <Panel className="space-y-2">
                  <h2 className="font-semibold">Certains cours n’ont pas de salle</h2>
                  <p className="sp-muted">Une salle n’a pas encore été affectée à tous vos cours.</p>
                  <ul className="list-disc pl-5">{state.workspace.courses.filter(course => !course.room).map(course => <li key={String(course.id)}>{course.subject}</li>)}</ul>
                </Panel>
              ) : null}
            </>
          )}
        </div>
      )}

      {state.status === 'loaded' && state.workspace.studentFound && isReport && (() => {
        const courses = state.workspace.courses;
        const attendance = state.workspace.attendance;
        const hoursFor = (course: StudentWorkspace['courses'][number]) => {
          const [sh, sm] = course.startsAt.split(':').map(Number);
          const [eh, em] = course.endsAt.split(':').map(Number);
          const value = (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
          return Number.isFinite(value) && value > 0 ? value : 0;
        };
        const courseHours = new Map(courses.map(course => [String(course.id), hoursFor(course)]));
        const realizedHours = state.workspace.realizedSessions.reduce((sum, item) => sum + (courseHours.get(String(item.courseId)) ?? 0), 0);
        const presentCount = attendance.filter(item => item.status === 'present').length;
        const lateCount = attendance.filter(item => item.status === 'retard').length;
        const absentCount = attendance.filter(item => item.status === 'absent').length;
        const attendedCount = presentCount + lateCount;
        const attendanceRate = attendance.length ? Math.round(attendedCount / attendance.length * 100) : null;
        const weeklyHours = state.workspace.formation?.hoursPerWeek ?? courses.reduce((sum, course) => sum + hoursFor(course), 0);
        const formation = state.workspace.formation;
        const plannedTotalHours = formation && formation.durationMonths !== null && formation.durationMonths !== undefined && weeklyHours > 0
          ? formation.durationMonths * 4.345 * weeklyHours
          : null;
        const progress = plannedTotalHours && plannedTotalHours > 0
          ? Math.min(100, Math.round(realizedHours / plannedTotalHours * 100))
          : null;
        const statusCounts = [
          { label: 'Présences', count: presentCount, color: '#16a34a' },
          { label: 'Retards', count: lateCount, color: '#d97706' },
          { label: 'Absences', count: absentCount, color: '#dc2626' },
        ];
        const maxStatus = Math.max(1, ...statusCounts.map(item => item.count));
        return (
          <div className="space-y-5">
            {state.workspace.formation && <Panel className="space-y-3"><div><p className="sp-muted text-sm">Formation</p><h2 className="text-xl font-semibold">{state.workspace.formation.name}</h2></div><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Progression calculée</span><strong>{progress === null ? 'Durée totale non renseignée' : `${progress}%`}</strong></div><div className="h-3 overflow-hidden rounded-full bg-gray-200/70"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress ?? 0}%` }} /></div>{plannedTotalHours !== null && <p className="sp-muted text-xs">{realizedHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h réalisées sur {plannedTotalHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h estimées.</p>}</Panel>}
            {courses.length === 0 ? (
              <EmptyState title="Aucune formation à analyser" description="Les statistiques apparaîtront lorsque vos cours seront associés à votre inscription." />
            ) : (
              <>
                <style>{`
                  @keyframes sp-report-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                  @media (prefers-reduced-motion: no-preference) { .sp-report-kpi { animation: sp-report-rise .45s ease-out both; } }
                `}</style>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {([
                    { label: 'Cours inscrits', value: String(courses.length), note: 'Cours associés à votre dossier', icon: 'courses' as const, tone: 'bg-indigo-500/10 text-indigo-600' },
                    { label: 'Heures prévues', value: plannedTotalHours === null ? '—' : `${plannedTotalHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`, note: `${weeklyHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h par semaine`, icon: 'hours' as const, tone: 'bg-sky-500/10 text-sky-600' },
                    { label: 'Heures réalisées', value: `${realizedHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`, note: 'Séances marquées comme réalisées', icon: 'completed' as const, tone: 'bg-emerald-500/10 text-emerald-600' },
                    { label: 'Taux d’assiduité', value: attendanceRate === null ? '—' : `${attendanceRate}%`, note: `${attendedCount} présence(s) ou retard(s) sur ${attendance.length} pointage(s)`, icon: 'attendance' as const, tone: 'bg-amber-500/10 text-amber-600' },
                  ]).map((item, index) => (
                    <Panel key={item.label} className="sp-report-kpi group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none" >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="sp-muted text-sm">{item.label}</p><strong className="mt-2 block text-2xl font-bold tracking-tight sm:text-3xl">{item.value}</strong></div>
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none ${item.tone}`} style={{ animationDelay: `${index * 70}ms` }}><ReportIcon name={item.icon} /></div>
                      </div>
                      <p className="sp-muted mt-3 text-xs leading-relaxed">{item.note}</p>
                    </Panel>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel className="space-y-4">
                    <div><h2 className="font-semibold">Présence et absences</h2><p className="sp-muted text-sm">Répartition des pointages enregistrés</p></div>
                    {attendance.length === 0 ? <p className="sp-muted">Aucun pointage enregistré pour le moment.</p> : (
                      <div className="grid items-center gap-5 sm:grid-cols-[minmax(120px, .8fr)_1.2fr]">
                        <div className="mx-auto grid h-36 w-36 place-items-center rounded-full transition-transform duration-500 hover:rotate-3 motion-reduce:transition-none" style={{ background: `conic-gradient(#16a34a 0 ${presentCount / attendance.length * 100}%, #d97706 ${presentCount / attendance.length * 100}% ${attendedCount / attendance.length * 100}%, #dc2626 ${attendedCount / attendance.length * 100}% 100%)` }} role="img" aria-label={`Répartition des pointages : ${presentCount} présences, ${lateCount} retards, ${absentCount} absences`}>
                          <div className="grid h-24 w-24 place-content-center rounded-full bg-white text-center dark:bg-slate-900"><strong className="text-2xl">{attendanceRate ?? 0}%</strong><span className="sp-muted text-xs">assiduité</span></div>
                        </div>
                        <div className="space-y-4">
                          {statusCounts.map(item => (
                            <div key={item.label}>
                              <div className="mb-1 flex justify-between gap-2 text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><strong>{item.count} <span className="sp-muted font-normal">({Math.round(item.count / attendance.length * 100)}%)</span></strong></div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-gray-200/70"><div className="h-full rounded-full transition-all duration-700 motion-reduce:transition-none" style={{ width: `${item.count / maxStatus * 100}%`, backgroundColor: item.color }} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Panel>
                  <Panel className="space-y-4">
                    <div><h2 className="font-semibold">Heures par cours</h2><p className="sp-muted text-sm">Heures hebdomadaires prévues et heures pointées</p></div>
                    <div className="space-y-4">
                      {courses.slice(0, 8).map(course => {
                        const planned = hoursFor(course);
                        const realized = state.workspace.realizedSessions.filter(item => String(item.courseId) === String(course.id)).reduce((sum) => sum + hoursFor(course), 0);
                        const scale = Math.max(1, planned, realized);
                        return <div key={String(course.id)}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="font-medium">{course.subject}</span><span>{planned.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h/sem.</span></div><div className="flex h-3 overflow-hidden rounded-full bg-gray-200/70"><div title="Prévu par semaine" className="h-full bg-indigo-500" style={{ width: `${planned / scale * 100}%` }} /><div title="Pointé" className="h-full bg-emerald-500" style={{ width: `${Math.min(realized, scale) / scale * 100}%` }} /></div><p className="sp-muted mt-1 text-xs">{realized.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h réalisées · {course.teacher || 'Formateur non renseigné'}</p></div>;
                      })}
                    </div>
                    <p className="sp-muted text-xs">La progression totale est calculée uniquement si la durée de la formation et ses heures hebdomadaires sont renseignées dans le dossier de formation.</p>
                  </Panel>
                </div>
                <Panel className="space-y-3">
                  <h2 className="font-semibold">Historique récent des présences</h2>
                  {attendance.length === 0 ? <p className="sp-muted">Aucun historique disponible.</p> : (
                    <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Date</th><th>Cours</th><th>Statut</th><th>Durée</th></tr></thead><tbody>{attendance.slice(0, 12).map((item, index) => <tr key={`${item.courseId}-${item.date}-${index}`}><td>{displayDate(item.date)}</td><td>{item.subject}</td><td>{ATTENDANCE_LABELS[item.status]}</td><td>{(courseHours.get(String(item.courseId)) ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h</td></tr>)}</tbody></table></div>
                  )}
                </Panel>
              </>
            )}
          </div>
        );
      })()}
      {state.status === 'loaded' &&
        state.workspace.studentFound &&
        isCourses &&
        (state.workspace.courses.length === 0 ? (
          <EmptyState
            description="L’administration pourra vous inscrire à vos cours depuis la gestion des étudiants."
            title="Vous n’êtes inscrit à aucun cours pour le moment."
          />
        ) : (
          <Panel className="!p-0">
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Séance</th>
                    <th>Horaire</th>
                    <th>Formateur</th>
                    <th>Salle</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.workspace.courses]
                    .sort(
                      (left, right) =>
                        left.weekday - right.weekday || left.startsAt.localeCompare(right.startsAt),
                    )
                    .map((course) => {
                      const oneOff = course.startsOn && course.startsOn === course.endsOn;
                      const weekday = WEEKDAYS[course.weekday] ?? 'Jour à confirmer';
                      return (
                        <tr key={String(course.id)}>
                          <td>
                            <strong>{course.subject}</strong>
                          </td>
                          <td>
                            {oneOff && course.startsOn ? displayDate(course.startsOn) : weekday}
                            <br />
                            <small>
                              {course.startsAt.slice(0, 5)} – {course.endsAt.slice(0, 5)}
                            </small>
                          </td>
                          <td>{course.teacher || '—'}</td>
                          <td>{course.room || '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      {state.status === 'loaded' && state.workspace.studentFound && !isCourses && !isRooms && !isReport && (
        <>
          {state.workspace.attendance.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Panel>
                <strong className="text-2xl">
                  {state.workspace.attendance.length
                    ? `${Math.round((state.workspace.attendance.filter((item) => item.status !== 'absent').length / state.workspace.attendance.length) * 100)}%`
                    : '—'}
                </strong>
                <p className="sp-muted">Taux de présence</p>
              </Panel>
              <Panel>
                <strong className="text-2xl">
                  {state.workspace.attendance.filter((item) => item.status === 'present').length}
                </strong>
                <p className="sp-muted">Présences</p>
              </Panel>
              <Panel>
                <strong className="text-2xl">
                  {state.workspace.attendance.filter((item) => item.status === 'retard').length}
                </strong>
                <p className="sp-muted">Retards</p>
              </Panel>
              <Panel>
                <strong className="text-2xl">
                  {state.workspace.attendance.filter((item) => item.status === 'absent').length}
                </strong>
                <p className="sp-muted">Absences</p>
              </Panel>
            </div>
          )}
          {state.workspace.attendance.length === 0 ? (
            <EmptyState
              description="Vos présences apparaîtront après le pointage des séances."
              title="Aucune présence enregistrée."
            />
          ) : (
            <Panel className="!p-0">
              <div className="sp-table-wrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Séance</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.workspace.attendance.map((item, index) => (
                      <tr key={`${item.courseId}-${item.date}-${index}`}>
                        <td>{displayDate(item.date)}</td>
                        <td>{item.subject}</td>
                        <td>{ATTENDANCE_LABELS[item.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
