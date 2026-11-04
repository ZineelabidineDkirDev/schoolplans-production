import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, EmptyState, LoadingState, Modal, PageHeader, Panel, confirmAction, notify } from '../../components/ui';
import { getWeekOccurrences } from '../../business/planning/planningSchedule';
import { getPlanningData } from '../../data/repositories/planningRepository';
import {
  calculateGroupEndDate,
  createGroup,
  createModuleForCentre,
  deleteFormation,
  deleteGroup,
  getFormationGroupData,
  saveFormation,
  updateGroup,
  type FormationInput,
  type ModuleDomain,
  type ModuleOption,
} from '../../data/repositories/formationGroupRepository';
import {
  getAbsenceAlerts,
  getCentreAttendanceSummary,
  getAttendanceSheet,
  getCentreStudents,
  saveAttendance,
  type AbsenceAlert,
} from '../../data/repositories/managementRepository';
import {
  createCentreStudent,
  deleteCentreStudent,
  updateCentreStudent,
  type StudentRecordInput,
} from '../../data/repositories/studentManagementRepository';
import { assignStudentToGroup, getStudentCourseEnrollmentIds, setStudentCourseEnrollment } from '../../data/repositories/studentAssignmentRepository';
import {
  getMyFormationGroupStudents,
  saveMyFormationGroupStudents,
  type FormationGroupStudentOption,
} from '../../data/repositories/formationGroupAssignmentRepository';
import { createCentreRoom, updateCentreRoom, deleteCentreRoom, createCentreTeacher, updateCentreTeacher, deleteCentreTeacher, type RoomInput, type TeacherInput } from '../../data/repositories/directoryCrudRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import { exportTableToExcel, exportTableToPdf } from '../../utils/tableExport';
import type { PlanningData, PlanningOccurrence } from '../../types/planning';
import type { AttendanceSheet, AttendanceStatus, ManagedStudent } from '../../types/management';
import { useAuth } from '../auth/AuthProvider';

type PlanningState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: PlanningData };

type StudentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; students: ManagedStudent[] };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

function usePlanningData() {
  const { profile } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<PlanningState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile) return;
      if (profile.role === 'etudiant') {
        setState({
          status: 'error',
          message: 'Cette rubrique n’est pas disponible pour votre rôle.',
        });
        return;
      }
      setState({ status: 'loading' });
      try {
        const data = await getPlanningData(
          getSupabaseClient(),
          profile.centreId ?? '',
          profile.id,
          profile.role,
        );
        if (active) setState({ status: 'loaded', data });
      } catch (error) {
        if (active) setState({ status: 'error', message: errorMessage(error) });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [profile, reloadKey]);

  return { profile, state, reload: () => setReloadKey((key) => key + 1) };
}

function PageFrame({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        actions={actions}
        description={description}
        eyebrow="Gestion du centre"
        title={title}
      />
      {children}
    </section>
  );
}

function PlanningLoadState({ state, retry }: { state: PlanningState; retry: () => void }) {
  if (state.status === 'loading') {
    return (
      <Panel>
        <LoadingState label="Chargement des données du centre…" />
      </Panel>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert tone="error">
        <p>Les données de cette rubrique n’ont pas pu être chargées.</p>
        <p>{state.message}</p>
        <Button onClick={retry} type="button" variant="secondary">
          Réessayer
        </Button>
      </Alert>
    );
  }
  return null;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr') ?? '')
    .join('');
}

function teacherNameParts(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...lastName] = name.trim().split(/\s+/);
  return { firstName, lastName: lastName.join(' ') };
}

function courseDuration(course: PlanningData['courses'][number]): number {
  const [startHour, startMinute] = course.startsAt.split(':').map(Number);
  const [endHour, endMinute] = course.endsAt.split(':').map(Number);
  const minutes = endHour * 60 + endMinute - startHour * 60 - startMinute;
  return Number.isFinite(minutes) && minutes > 0 ? minutes / 60 : 0;
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

const ROOM_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function RoomsPage() {
  const { profile } = useAuth();
  const { state, reload } = usePlanningData();
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) notify(value, 'error');
  };
  const setMessage = (value: string | null) => {
    if (value) notify(value, 'success');
  };
  const [form, setForm] = useState<RoomInput>({ name: '', type: '', capacity: 30 });
  const canManage = profile?.role === 'admin' || profile?.role === 'director';
  function openForm(room?: PlanningData['filters']['rooms'][number]) {
    setEditingId(room?.id ?? null);
    setForm(room ? { name: room.name, type: room.type ?? '', capacity: room.capacity } : { name: '', type: '', capacity: 30 });
    setError(null); setMessage(null); setFormOpen(true);
  }
  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId || !canManage) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      if (editingId === null) await createCentreRoom(getSupabaseClient(), profile.centreId, form);
      else await updateCentreRoom(getSupabaseClient(), profile.centreId, editingId, form);
      setMessage(editingId === null ? 'Salle créée.' : 'Salle modifiée.');
      setFormOpen(false); reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  async function removeRoom(room: PlanningData['filters']['rooms'][number]) {
    if (!profile?.centreId || !canManage || !await confirmAction(`Supprimer la salle « ${room.name} » ?`)) return;
    setError(null); setMessage(null);
    try { await deleteCentreRoom(getSupabaseClient(), profile.centreId, room.id); setMessage('Salle supprimée.'); reload(); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  return (
    <PageFrame actions={canManage ? <Button onClick={() => openForm()} type="button">+ Ajouter une salle</Button> : undefined}
      description="Salles du centre et volume d’occupation hebdomadaire selon les séances planifiées." title="Salles">
      {error && <Alert tone="error"><p>{error}</p></Alert>}
      {formOpen && canManage && <Modal label={editingId === null ? 'Nouvelle salle' : 'Modifier la salle'} onClose={() => setFormOpen(false)}><Panel className="management-editor">
        <h2>{editingId === null ? 'Nouvelle salle' : 'Modifier la salle'}</h2>
        <form className="sp-form-grid" onSubmit={(event) => void saveRoom(event)}>
          <label className="sp-form-field">Nom<input className="sp-field" required value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} /></label>
          <label className="sp-form-field">Type<input className="sp-field" value={form.type} onChange={(event) => setForm((v) => ({ ...v, type: event.target.value }))} /></label>
          <label className="sp-form-field">Capacité<input className="sp-field" min="1" type="number" value={form.capacity ?? ''} onChange={(event) => setForm((v) => ({ ...v, capacity: event.target.value ? Number(event.target.value) : null }))} /></label>
          <div className="management-toolbar"><Button disabled={saving} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button><Button onClick={() => setFormOpen(false)} type="button" variant="secondary">Annuler</Button></div>
        </form>
      </Panel></Modal>}
      <PlanningLoadState retry={reload} state={state} />
      {state.status === 'loaded' && (state.data.filters.rooms.length === 0 ? <EmptyState title="Aucune salle n’est enregistrée dans ce centre." /> :
        <div className="management-card-grid">{state.data.filters.rooms.map((room) => {
          const courses = state.data.courses.filter((course) => String(course.roomId) === String(room.id));
          const occupiedHours = courses.reduce((total, course) => total + courseDuration(course), 0);
          const weeklyHours = 66; const freeHours = Math.max(weeklyHours - occupiedHours, 0);
          const now = new Date(); const today = (now.getDay() + 6) % 7; const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const todayCourses = courses.filter((course) => course.weekday === today).sort((a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt));
          const currentCourse = todayCourses.find((course) => toMinutes(course.startsAt) <= currentMinutes && currentMinutes < toMinutes(course.endsAt));
          const nextCourse = todayCourses.find((course) => toMinutes(course.startsAt) > currentMinutes);
          const isOpen = today < ROOM_DAYS.length && currentMinutes >= 8 * 60 && currentMinutes < 19 * 60;
          const roomState = currentCourse ? { tone: 'busy', label: `Occupée jusqu’à ${currentCourse.endsAt.slice(0, 5)}` } : !isOpen ? { tone: 'closed', label: 'Fermée actuellement' } : nextCourse ? { tone: 'free', label: `Libre jusqu’à ${nextCourse.startsAt.slice(0, 5)}` } : { tone: 'free', label: 'Libre jusqu’à la fermeture' };
          return <Panel className="management-room-card" key={room.id}>
            <header className="management-room-heading"><h2>{room.name}</h2><span className={`management-room-status is-${roomState.tone}`}>{roomState.label}</span></header>
            <p className="management-room-description">{room.type || 'Salle de formation'} · {room.capacity ?? '—'} places</p>
            <div aria-label={`Disponibilité hebdomadaire de ${room.name}`}>{ROOM_DAYS.map((day, weekday) => <div className="management-room-day" key={day}><span>{day.slice(0, 3)}</span>{Array.from({ length: 11 }, (_, hour) => {
              const startsAt = 8 * 60 + hour * 60; const endsAt = startsAt + 60;
              const course = courses.find((item) => item.weekday === weekday && toMinutes(item.startsAt) < endsAt && toMinutes(item.endsAt) > startsAt);
              return <span aria-label={`${day}, ${hour + 8} h : ${course ? `${course.subjectName}, ${course.teacherName}` : 'libre'}`} className={`management-room-hour${course ? ' is-occupied' : ''}`} key={hour} role="img" title={course ? `${course.subjectName} · ${course.teacherName}` : 'Libre'} />;
            })}</div>)}</div>
            <div className="management-room-totals"><span>Occupée {occupiedHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h / {weeklyHours} h</span><span>Libre {freeHours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h</span></div>
            {canManage && <div className="management-toolbar"><Button onClick={() => openForm(room)} type="button" variant="secondary">Modifier</Button><Button onClick={() => void removeRoom(room)} type="button" variant="danger">Supprimer</Button></div>}
          </Panel>;
        })}</div>)}
    </PageFrame>
  );
}

export function TeachersPage() {
  const { profile } = useAuth();
  const { state, reload } = usePlanningData();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [teacherProfileTab, setTeacherProfileTab] = useState<
    'overview' | 'groups' | 'students' | 'pay' | 'settings'
  >('overview');
  const [teacherStudentsState, setTeacherStudentsState] = useState<StudentState>({
    status: 'loading',
  });
  const [teacherPayrollState, setTeacherPayrollState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | {
        status: 'loaded';
        payroll: Array<{
          id: string;
          periodStart: string;
          periodEnd: string;
          amountDue: number;
          status: string;
          paidAt: string | null;
        }>;
      }
  >({ status: 'loading' });
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) notify(value, 'error');
  };
  const setMessage = (value: string | null) => {
    if (value) notify(value, 'success');
  };
  const [form, setForm] = useState<TeacherInput>({
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
  });
  const canManage = profile?.role === 'admin' || profile?.role === 'director';
  const selectedTeacher =
    state.status === 'loaded'
      ? state.data.filters.teachers.find((teacher) => String(teacher.id) === selectedTeacherId)
      : undefined;
  const teacherGroups =
    selectedTeacher && state.status === 'loaded'
      ? state.data.filters.groups.filter(
          (group) => String(group.teacherId) === String(selectedTeacher.id),
        )
      : [];
  const teacherCourses =
    selectedTeacher && state.status === 'loaded'
      ? state.data.courses.filter(
          (course) => String(course.teacherId) === String(selectedTeacher.id),
        )
      : [];
  const teacherFormations = Array.from(
    new Map(
      teacherGroups
        .filter((group) => group.formationId !== null)
        .map((group) => [String(group.formationId), {
          id: group.formationId,
          name: group.formationName ?? 'Formation non définie',
        }]),
    ).values(),
  );

  useEffect(() => {
    if (!selectedTeacher || !profile?.centreId) return;
    let active = true;
    setTeacherStudentsState({ status: 'loading' });
    void getCentreStudents(getSupabaseClient(), profile.centreId)
      .then((students) => {
        if (active) setTeacherStudentsState({ status: 'loaded', students });
      })
      .catch((cause: unknown) => {
        if (active) setTeacherStudentsState({ status: 'error', message: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [profile?.centreId, selectedTeacher]);

  useEffect(() => {
    if (!selectedTeacher || !profile?.centreId || !canManage || teacherProfileTab !== 'pay') return;
    let active = true;
    setTeacherPayrollState({ status: 'loading' });
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from('finance_teacher_payroll')
          .select('id,period_start,period_end,amount_due,status,paid_at')
          .eq('centre_id', profile.centreId)
          .eq('teacher_id', selectedTeacher.id)
          .neq('status', 'cancelled')
          .order('period_start', { ascending: false });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Réponse financière invalide.');
        const payroll = data.map((entry) => {
          const amountDue = Number(entry.amount_due);
          if (!Number.isFinite(amountDue)) {
            throw new Error('Montant de rémunération invalide.');
          }
          return {
            id: String(entry.id),
            periodStart: String(entry.period_start),
            periodEnd: String(entry.period_end),
            amountDue,
            status: String(entry.status),
            paidAt: typeof entry.paid_at === 'string' ? entry.paid_at : null,
          };
        });
        if (active) setTeacherPayrollState({ status: 'loaded', payroll });
      } catch (cause) {
        if (active) setTeacherPayrollState({ status: 'error', message: errorMessage(cause) });
      }
    })();
    return () => {
      active = false;
    };
  }, [canManage, profile?.centreId, selectedTeacher, teacherProfileTab]);

  function openForm(teacher?: PlanningData['filters']['teachers'][number]) {
    const nameParts = teacher ? teacherNameParts(teacher.name) : { firstName: '', lastName: '' };
    setEditingId(teacher?.id ?? null);
    setForm({
      ...nameParts,
      email: teacher?.email ?? '',
      telephone: teacher?.telephone ?? '',
    });
    setError(null); setMessage(null); setFormOpen(true);
  }
  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile?.centreId || !canManage) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      if (editingId === null) await createCentreTeacher(getSupabaseClient(), profile.centreId, form);
      else await updateCentreTeacher(getSupabaseClient(), profile.centreId, editingId, form);
      setMessage(editingId === null ? 'Formateur créé.' : 'Formateur modifié.'); setFormOpen(false); reload();
    } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(false); }
  }
  async function removeTeacher(teacher: PlanningData['filters']['teachers'][number]) {
    if (!profile?.centreId || !canManage || !await confirmAction(`Supprimer la fiche de ${teacher.name} ?`)) return;
    setError(null); setMessage(null);
    try { await deleteCentreTeacher(getSupabaseClient(), profile.centreId, teacher.id); setMessage('Formateur supprimé.'); reload(); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  if (state.status === 'loaded' && selectedTeacher) {
    const subjects = state.data.subjectIdsByTeacher[String(selectedTeacher.id)] ?? [];
    const groupIds = new Set(teacherGroups.map((group) => String(group.id)));
    const students =
      teacherStudentsState.status === 'loaded'
        ? teacherStudentsState.students.filter(
            (student) => student.groupId !== null && groupIds.has(String(student.groupId)),
          )
        : [];
    const formatDate = (value: string | null) =>
      value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('fr-FR') : 'Non défini';

    return (
      <PageFrame
        actions={
          <Button onClick={() => setSelectedTeacherId(null)} type="button" variant="secondary">
            ← Retour aux formateurs
          </Button>
        }
        description="Profil, activité pédagogique et suivi du formateur."
        title={`Profil de ${selectedTeacher.name}`}
      >
        {error && <Alert tone="error"><p>{error}</p></Alert>}
        <section className="teacher-profile">
          <header className="teacher-profile-hero">
            <span aria-hidden="true" className="teacher-profile-avatar">
              {initials(selectedTeacher.name)}
            </span>
            <h2>{selectedTeacher.name}</h2>
            <div className="teacher-profile-contact">
              <span>{selectedTeacher.email ?? 'Adresse e-mail non renseignée'}</span>
              <span>{selectedTeacher.telephone ?? 'Téléphone non renseigné'}</span>
              <span>Inscrit le {formatDate(selectedTeacher.createdAt)}</span>
              <span>{teacherCourses.length} cours attribué(s)</span>
              <span>{teacherGroups.length} groupe(s)</span>
            </div>
            <div className="teacher-profile-actions">
              {canManage && (
                <Link className="sp-btn sp-btn-ghost" to="/app/vfg">
                  Assigner à un groupe
                </Link>
              )}
              {selectedTeacher.email && (
                <a className="sp-btn sp-btn-ghost" href={`mailto:${selectedTeacher.email}`}>
                  Envoyer un e-mail
                </a>
              )}
            </div>
          </header>
          <nav aria-label="Sections du profil formateur" className="teacher-profile-tabs">
            {([
              ['overview', 'Aperçu'],
              ['groups', 'Groupes'],
              ['students', 'Étudiants'],
              ['pay', 'Rémunération'],
              ['settings', 'Paramètres'],
            ] as const).map(([tab, label]) => (
              <button
                aria-current={teacherProfileTab === tab ? 'page' : undefined}
                className={teacherProfileTab === tab ? 'is-active' : ''}
                key={tab}
                onClick={() => setTeacherProfileTab(tab)}
                type="button"
              >
                {label}
                {tab === 'groups' && <span>{teacherGroups.length}</span>}
                {tab === 'students' && teacherStudentsState.status === 'loaded' && (
                  <span>{students.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="teacher-profile-content">
            {teacherProfileTab === 'overview' && (
              <div className="teacher-profile-overview">
                <Panel className="teacher-profile-panel">
                  <h2>Aperçu de l’activité</h2>
                  <div className="teacher-profile-stat-grid">
                    <article><span>Groupes</span><strong>{teacherGroups.length}</strong></article>
                    <article><span>Étudiants</span><strong>{teacherStudentsState.status === 'loaded' ? students.length : '—'}</strong></article>
                    <article><span>Séances attribuées</span><strong>{teacherCourses.length}</strong></article>
                    <article><span>Heures planifiées</span><strong>{teacherCourses.reduce((total, course) => total + courseDuration(course), 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h</strong></article>
                  </div>
                </Panel>
                <Panel className="teacher-profile-panel">
                  <h2>Matières enseignées</h2>
                  <div className="management-chip-list">
                    {subjects.map((subjectId) => {
                      const subject = state.data.filters.subjects.find(
                        (item) => String(item.id) === String(subjectId),
                      );
                      return subject ? <span className="management-chip" key={subjectId}>{subject.name}</span> : null;
                    })}
                    {subjects.length === 0 && <span className="management-muted">Aucune matière associée</span>}
                  </div>
                </Panel>
                <Panel className="teacher-profile-panel">
                  <h2>Prochains cours</h2>
                  {teacherCourses.length ? (
                    <ul className="teacher-profile-course-list">
                      {teacherCourses.slice(0, 5).map((course) => (
                        <li key={course.id}>
                          <strong>{course.subjectName}</strong>
                          <span>{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][course.weekday] ?? 'Jour non défini'} · {course.startsAt}–{course.endsAt}</span>
                          <small>{course.groupName ?? 'Groupe non défini'}{course.roomName ? ` · ${course.roomName}` : ''}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState title="Aucun cours attribué à ce formateur." />}
                </Panel>
              </div>
            )}
            {teacherProfileTab === 'groups' && (
              <Panel className="teacher-profile-panel">
                <div className="teacher-profile-section-heading">
                  <div><h2>Groupes associés</h2><p>Groupes de formation attribués à {selectedTeacher.name}.</p></div>
                  {canManage && <Link className="sp-btn sp-btn-ghost" to="/app/vfg">Gérer les groupes</Link>}
                </div>
                {teacherGroups.length ? (
                  <div className="teacher-profile-group-grid">
                    {teacherGroups.map((group) => (
                      <article key={group.id}>
                        <strong>{group.name}</strong>
                        <span>{group.formationName ?? 'Formation non définie'}</span>
                        <small>{formatDate(group.startsOn)} – {formatDate(group.endsOn)}</small>
                        <small>{group.active ? 'Actif' : 'Inactif'} · {group.capacity} places</small>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState title="Aucun groupe associé à ce formateur." />}
              </Panel>
            )}
            {teacherProfileTab === 'students' && (
              <Panel className="teacher-profile-panel">
                <h2>Étudiants des groupes attribués</h2>
                {teacherStudentsState.status === 'loading' && <LoadingState label="Chargement des étudiants…" />}
                {teacherStudentsState.status === 'error' && <Alert tone="error">{teacherStudentsState.message}</Alert>}
                {teacherStudentsState.status === 'loaded' && (students.length ? (
                  <div className="teacher-profile-student-list">
                    {students.map((student) => (
                      <article key={student.id}>
                        <span aria-hidden="true" className="management-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span>
                        <span><strong>{student.firstName} {student.lastName}</strong><small>{student.groupName ?? 'Groupe non défini'}</small></span>
                        <span>{student.email ?? student.telephone ?? 'Coordonnées non renseignées'}</span>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState title="Aucun étudiant dans les groupes de ce formateur." />)}
              </Panel>
            )}
            {teacherProfileTab === 'pay' && (
              <Panel className="teacher-profile-panel">
                <div className="teacher-profile-section-heading">
                  <div><h2>Rémunération</h2><p>Historique des rémunérations non annulées.</p></div>
                  {canManage && <Link className="sp-btn sp-btn-ghost" to="/app/vfinance">Ouvrir la finance</Link>}
                </div>
                {!canManage && <Alert>Le suivi des rémunérations est réservé à l’administration.</Alert>}
                {canManage && teacherPayrollState.status === 'loading' && <LoadingState label="Chargement des rémunérations…" />}
                {canManage && teacherPayrollState.status === 'error' && <Alert tone="error">{teacherPayrollState.message}</Alert>}
                {canManage && teacherPayrollState.status === 'loaded' && (teacherPayrollState.payroll.length ? (
                  <div className="teacher-profile-pay-list">
                    {teacherPayrollState.payroll.map((item) => (
                      <article key={item.id}>
                        <span><strong>{formatDate(item.periodStart)} – {formatDate(item.periodEnd)}</strong><small>{item.status === 'paid' ? `Payée le ${formatDate(item.paidAt)}` : item.status === 'approved' ? 'À régler' : 'Brouillon'}</small></span>
                        <strong>{new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(item.amountDue)}</strong>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState title="Aucune rémunération enregistrée pour ce formateur." />)}
              </Panel>
            )}
            {teacherProfileTab === 'settings' && (
              <Panel className="teacher-profile-panel">
                <div className="teacher-profile-section-heading">
                  <div><h2>Paramètres du profil</h2><p>Identité, coordonnées et formations associées au formateur.</p></div>
                  {canManage && <Button onClick={() => openForm(selectedTeacher)} type="button" variant="secondary">Modifier le profil</Button>}
                </div>
                <dl className="teacher-profile-settings">
                  <div><dt>Prénom</dt><dd>{teacherNameParts(selectedTeacher.name).firstName || 'Non renseigné'}</dd></div>
                  <div><dt>Nom</dt><dd>{teacherNameParts(selectedTeacher.name).lastName || 'Non renseigné'}</dd></div>
                  <div><dt>E-mail</dt><dd>{selectedTeacher.email ?? 'Non renseigné'}</dd></div>
                  <div><dt>Téléphone personnel</dt><dd>{selectedTeacher.telephone ?? 'Non renseigné'}</dd></div>
                  <div><dt>Date d’inscription</dt><dd>{formatDate(selectedTeacher.createdAt)}</dd></div>
                  <div><dt>Compte de connexion</dt><dd>{selectedTeacher.profileId ? 'Associé' : 'Non associé'}</dd></div>
                  <div><dt>Matières</dt><dd>{subjects.length}</dd></div>
                </dl>
                <div className="teacher-profile-settings-formations">
                  <h3>Formations inscrites</h3>
                  {teacherFormations.length ? (
                    <div className="management-chip-list">
                      {teacherFormations.map((formation) => (
                        <span className="management-chip" key={formation.id}>{formation.name}</span>
                      ))}
                    </div>
                  ) : <p className="management-muted">Aucune formation associée à un groupe attribué.</p>}
                </div>
              </Panel>
            )}
          </div>
        </section>
        {formOpen && canManage && <Modal label="Modifier le formateur" onClose={() => setFormOpen(false)}><Panel className="management-editor">
          <header className="management-editor-heading"><div><p className="planning-progress-eyebrow">Équipe pédagogique</p><h2>Modifier le formateur</h2></div></header>
          <form className="sp-form-grid" onSubmit={(event) => void saveTeacher(event)}>
            <label className="sp-form-field"><span className="sp-popup-sr-label">Prénom</span><input aria-label="Prénom" className="sp-field" autoComplete="given-name" placeholder="Prénom" required value={form.firstName} onChange={(event) => setForm((value) => ({ ...value, firstName: event.target.value }))} /></label>
            <label className="sp-form-field"><span className="sp-popup-sr-label">Nom</span><input aria-label="Nom" className="sp-field" autoComplete="family-name" placeholder="Nom" required value={form.lastName} onChange={(event) => setForm((value) => ({ ...value, lastName: event.target.value }))} /></label>
            <label className="sp-form-field"><span className="sp-popup-sr-label">E-mail</span><input aria-label="E-mail" className="sp-field" autoComplete="email" placeholder="E-mail" type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} /></label>
            <label className="sp-form-field"><span className="sp-popup-sr-label">Téléphone personnel</span><input aria-label="Téléphone personnel" className="sp-field" autoComplete="tel" placeholder="Téléphone personnel" type="tel" value={form.telephone} onChange={(event) => setForm((value) => ({ ...value, telephone: event.target.value }))} /></label>
            <p className="management-muted management-editor-wide">Le compte de connexion et les matières associées ne sont pas modifiés par ce formulaire.</p>
            <div className="management-toolbar management-editor-wide"><Button disabled={saving} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button><Button onClick={() => setFormOpen(false)} type="button" variant="secondary">Annuler</Button></div>
          </form>
        </Panel></Modal>}
      </PageFrame>
    );
  }

  return <PageFrame actions={canManage ? <Button onClick={() => openForm()} type="button">+ Ajouter un formateur</Button> : undefined}
    description="Équipe pédagogique, matières enseignées et séances attribuées dans le centre." title="Formateurs">
    {error && <Alert tone="error"><p>{error}</p></Alert>}
    {formOpen && canManage && <Modal label={editingId === null ? 'Nouveau formateur' : 'Modifier le formateur'} onClose={() => setFormOpen(false)}><Panel className="management-editor">
      <header className="management-editor-heading">
        <div>
          <p className="planning-progress-eyebrow">Équipe pédagogique</p>
          <h2>{editingId === null ? 'Nouveau formateur' : 'Modifier le formateur'}</h2>
        </div>
      </header>
      <form className="sp-form-grid" onSubmit={(event) => void saveTeacher(event)}>
        <label className="sp-form-field sp-popup-placeholder-field">
          <span className="sp-popup-sr-label">Prénom</span>
          <input aria-label="Prénom" className="sp-field" autoComplete="given-name" placeholder="Prénom" required value={form.firstName} onChange={(event) => setForm((v) => ({ ...v, firstName: event.target.value }))} />
        </label>
        <label className="sp-form-field sp-popup-placeholder-field">
          <span className="sp-popup-sr-label">Nom</span>
          <input aria-label="Nom" className="sp-field" autoComplete="family-name" placeholder="Nom" required value={form.lastName} onChange={(event) => setForm((v) => ({ ...v, lastName: event.target.value }))} />
        </label>
        <label className="sp-form-field sp-popup-placeholder-field">
          <span className="sp-popup-sr-label">E-mail</span>
          <input aria-label="E-mail" className="sp-field" autoComplete="email" placeholder="E-mail" type="email" value={form.email} onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))} />
        </label>
        <label className="sp-form-field sp-popup-placeholder-field">
          <span className="sp-popup-sr-label">Téléphone personnel</span>
          <input aria-label="Téléphone personnel" className="sp-field" autoComplete="tel" placeholder="Téléphone personnel" type="tel" value={form.telephone} onChange={(event) => setForm((v) => ({ ...v, telephone: event.target.value }))} />
        </label>
        <p className="management-muted management-editor-wide">Le compte de connexion et les matières associées ne sont pas modifiés par ce formulaire.</p>
        <div className="management-toolbar management-editor-wide"><Button disabled={saving} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button><Button onClick={() => setFormOpen(false)} type="button" variant="secondary">Annuler</Button></div>
      </form></Panel></Modal>}
    <PlanningLoadState retry={reload} state={state} />
    {state.status === 'loaded' && (state.data.filters.teachers.length === 0 ? <EmptyState title="Aucun formateur n’est enregistré dans ce centre." /> :
      <div className="management-card-grid management-four-column-grid">{state.data.filters.teachers.map((teacher) => {
        const courses = state.data.courses.filter((course) => String(course.teacherId) === String(teacher.id));
        const subjects = state.data.subjectIdsByTeacher[String(teacher.id)] ?? [];
        const hours = courses.reduce((total, course) => total + courseDuration(course), 0);
        return <Panel className="management-card management-teacher-card" key={teacher.id}>
          <div
            aria-label={`Ouvrir le profil de ${teacher.name}`}
            className="management-teacher-card-open"
            onClick={() => { setSelectedTeacherId(String(teacher.id)); setTeacherProfileTab('overview'); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedTeacherId(String(teacher.id));
                setTeacherProfileTab('overview');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="management-card-heading"><span aria-hidden="true" className="management-avatar">{initials(teacher.name)}</span><div><h2>{teacher.name}</h2><p>{teacher.email ?? 'Adresse e-mail non renseignée'}</p></div></div>
            <div className="management-chip-list">{subjects.map((subjectId) => { const subject = state.data.filters.subjects.find((item) => String(item.id) === String(subjectId)); return subject ? <span className="management-chip" key={subjectId}>{subject.name}</span> : null; })}
              {subjects.length === 0 && <span className="management-muted">Aucune matière associée</span>}</div>
            <div className="management-metrics"><div><span>Séances / semaine</span><strong>{courses.length}</strong></div><div><span>Heures planifiées</span><strong>{hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h</strong></div></div>
            <p className="management-card-note">{teacher.profileId ? 'Compte de connexion associé' : 'Aucun compte associé'}</p>
            <span className="management-teacher-card-link">Ouvrir le profil →</span>
          </div>
          {canManage && <div className="management-toolbar"><Button onClick={() => openForm(teacher)} type="button" variant="secondary">Modifier</Button><Button disabled={Boolean(teacher.profileId || courses.length)} onClick={() => void removeTeacher(teacher)} type="button" variant="danger">Supprimer</Button></div>}
        </Panel>;
      })}</div>)}
  </PageFrame>;
}

export function FormationGroupsPage() {
  const { profile } = useAuth();
  const { state, reload } = usePlanningData();
  const [selectedFormationId, setSelectedFormationId] = useState('');
  const [directoryView, setDirectoryView] = useState<'cards' | 'table'>('cards');
  const [directorySearch, setDirectorySearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [domains, setDomains] = useState<ModuleDomain[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) notify(value, 'error');
  };
  const setMessage = (value: string | null) => {
    if (value) notify(value, 'success');
  };
  const [searchModules, setSearchModules] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDomain, setNewModuleDomain] = useState('');
  const [formationForm, setFormationForm] = useState<FormationInput>({
    name: '',
    duration: '',
    hoursPerWeek: 5,
    description: '',
    moduleIds: [],
  });
  const [groupForm, setGroupForm] = useState<{ id?: string | number; name: string; formationId: string; teacherId: string; startsOn: string; capacity: number }>({
    name: '',
    formationId: '',
    teacherId: '',
    startsOn: isoDate(new Date()),
    capacity: 30,
  });
  const canManage = profile?.role === 'admin' || profile?.role === 'director';

  async function refreshFormations() {
    reload();
    if (profile?.centreId) {
      const [catalog, students] = await Promise.all([
        getFormationGroupData(getSupabaseClient(), profile.centreId),
        getCentreStudents(getSupabaseClient(), profile.centreId),
      ]);
      setModules(catalog.modules);
      setDomains(catalog.domains);
      setStudentCounts(
        students.reduce((counts, student) => {
          if (student.groupId !== null) {
            const key = String(student.groupId);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          return counts;
        }, new Map<string, number>()),
      );
    }
  }

  useEffect(() => {
    let active = true;
    async function loadAuxiliaryData() {
      if (!profile?.centreId) return;
      try {
        const [catalog, students] = await Promise.all([
          getFormationGroupData(getSupabaseClient(), profile.centreId),
          getCentreStudents(getSupabaseClient(), profile.centreId),
        ]);
        if (!active) return;
        setModules(catalog.modules);
        setDomains(catalog.domains);
        setStudentCounts(
          students.reduce((counts, student) => {
            if (student.groupId !== null) {
              const key = String(student.groupId);
              counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            return counts;
          }, new Map<string, number>()),
        );
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    }
    void loadAuxiliaryData();
    return () => {
      active = false;
    };
  }, [profile?.centreId]);

  const formations = state.status === 'loaded' ? state.data.filters.formations : [];
  const selectedFormation = formations.find(
    (formation) => String(formation.id) === selectedFormationId,
  );
  const selectedGroups =
    state.status === 'loaded'
      ? state.data.filters.groups.filter(
          (group) => String(group.formationId) === selectedFormationId,
        )
      : [];
  const visibleFormations = state.status === 'loaded'
    ? formations.filter((formation) => {
        const formationGroups = state.data.filters.groups.filter(
          (group) => String(group.formationId) === String(formation.id),
        );
        const moduleIds = state.data.subjectIdsByFormation[String(formation.id)] ?? [];
        const searchable = [
          formation.name,
          formation.description ?? '',
          ...formationGroups.map((group) => group.name),
        ].join(' ').toLocaleLowerCase('fr');
        return searchable.includes(directorySearch.trim().toLocaleLowerCase('fr')) &&
          (!moduleFilter || moduleIds.some((id) => String(id) === moduleFilter)) &&
          (!levelFilter || String(formation.id) === levelFilter) &&
          (!teacherFilter || formationGroups.some((group) => String(group.teacherId ?? '') === teacherFilter));
      })
    : [];
  const formationStats = state.status === 'loaded' ? {
    formationCount: formations.length,
    activeGroupCount: state.data.filters.groups.filter((group) => group.active).length,
    studentCount: [...studentCounts.values()].reduce((total, count) => total + count, 0),
    weeklyCourseCount: state.data.courses.length,
  } : null;
  const filteredModules = modules.filter((module) =>
    module.name.toLocaleLowerCase('fr').includes(searchModules.trim().toLocaleLowerCase('fr')),
  );

  function startFormationForm(formation?: (typeof formations)[number]) {
    setError(null);
    setMessage(null);
    setSearchModules('');
    setNewModuleName('');
    setNewModuleDomain('');
    setFormationForm({
      ...(formation ? { id: formation.id } : {}),
      name: formation?.name ?? '',
      duration: formation?.duration ?? '',
      hoursPerWeek: Number(formation?.hoursPerWeek ?? 5),
      description: formation?.description ?? '',
      moduleIds: formation
        ? state.status === 'loaded'
          ? (state.data.subjectIdsByFormation[String(formation.id)] ?? [])
          : []
        : [],
    });
    setFormOpen(true);
  }

  async function submitFormation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId || !canManage) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveFormation(getSupabaseClient(), profile.centreId, formationForm);
      setFormOpen(false);
      setMessage('Formation enregistrée avec succès.');
      await refreshFormations();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFormation(formationId: string | number) {
    if (
      !profile?.centreId ||
      !canManage ||
      !await confirmAction('Voulez-vous supprimer cette formation ?')
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await deleteFormation(getSupabaseClient(), profile.centreId, formationId);
      if (selectedFormationId === String(formationId)) setSelectedFormationId('');
      setMessage('Formation supprimée.');
      await refreshFormations();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function startGroupForm(
    formationId = selectedFormationId,
    group?: PlanningData['filters']['groups'][number],
  ) {
    setError(null);
    setMessage(null);
    setGroupForm({
      ...(group ? { id: group.id } : {}),
      name: group?.name ?? '',
      formationId: String(group?.formationId ?? formationId),
      teacherId: group?.teacherId == null ? '' : String(group.teacherId),
      startsOn: group?.startsOn ?? isoDate(new Date()),
      capacity: group?.capacity ?? 30,
    });
    setGroupFormOpen(true);
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId || !canManage) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input = {
        name: groupForm.name,
        formationId: groupForm.formationId,
        teacherId: groupForm.teacherId || null,
        startsOn: groupForm.startsOn,
        capacity: groupForm.capacity,
      };
      if (groupForm.id !== undefined) {
        await updateGroup(getSupabaseClient(), profile.centreId, groupForm.id, input);
      } else {
        await createGroup(getSupabaseClient(), profile.centreId, input);
      }
      setGroupFormOpen(false);
      setMessage(groupForm.id !== undefined ? 'Groupe modifié avec succès.' : 'Groupe créé avec succès.');
      await refreshFormations();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(groupId: string | number) {
    if (!profile?.centreId || !canManage || !await confirmAction('Voulez-vous supprimer ce groupe ?')) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await deleteGroup(getSupabaseClient(), profile.centreId, groupId);
      setMessage('Groupe supprimé.');
      await refreshFormations();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function handleCreateModule() {
    if (!profile?.centreId || !newModuleDomain) return;
    setSaving(true);
    setError(null);
    try {
      const module = await createModuleForCentre(
        getSupabaseClient(),
        profile.centreId,
        newModuleName,
        newModuleDomain,
      );
      setModules((current) =>
        [...current, module].sort((left, right) => left.name.localeCompare(right.name, 'fr')),
      );
      setFormationForm((current) => ({
        ...current,
        moduleIds: [...current.moduleIds, module.id],
      }));
      setNewModuleName('');
      setNewModuleDomain('');
      setMessage('Module créé et ajouté à la formation.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame
      actions={
        canManage ? (
          <div className="management-page-actions">
            <Button onClick={() => startFormationForm()} type="button" variant="secondary">
              + Ajouter une formation
            </Button>
            <Button onClick={() => startGroupForm()} type="button">
              + Ajouter un groupe
            </Button>
          </div>
        ) : undefined
      }
      description="Créez et gérez les formations du centre, leurs modules et leurs groupes."
      title="Formations & Groupes"
    >
      <PlanningLoadState retry={reload} state={state} />
      {error && <Alert tone="error">{error}</Alert>}
      {formOpen && (
        <Modal label={formationForm.id ? 'Modifier la formation' : 'Nouvelle formation'} onClose={() => setFormOpen(false)}>
        <Panel className="management-editor">
          <div className="management-editor-heading">
            <div>
              <p className="planning-progress-eyebrow">Catalogue pédagogique</p>
              <h2>{formationForm.id ? 'Modifier la formation' : 'Nouvelle formation'}</h2>
            </div>
            <button
              aria-label="Fermer le formulaire"
              className="planning-dialog-close"
              onClick={() => setFormOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <form
            className="management-editor-form"
            onSubmit={(event) => void submitFormation(event)}
          >
            <label className="sp-form-field">
              Nom de la formation
              <input
                className="sp-field"
                maxLength={150}
                onChange={(event) =>
                  setFormationForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={formationForm.name}
              />
            </label>
            <label className="sp-form-field">
              Durée
              <input
                className="sp-field"
                onChange={(event) =>
                  setFormationForm((current) => ({ ...current, duration: event.target.value }))
                }
                placeholder="Ex. : 6 mois"
                value={formationForm.duration}
              />
            </label>
            <label className="sp-form-field">
              Heures par semaine
              <input
                className="sp-field"
                max="168"
                min="0.5"
                onChange={(event) =>
                  setFormationForm((current) => ({
                    ...current,
                    hoursPerWeek: Number(event.target.value),
                  }))
                }
                required
                step="0.5"
                type="number"
                value={formationForm.hoursPerWeek}
              />
            </label>
            <label className="sp-form-field management-editor-wide">
              Description
              <textarea
                className="sp-field management-textarea"
                onChange={(event) =>
                  setFormationForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                value={formationForm.description}
              />
            </label>
            <div className="management-editor-wide">
              <div className="management-module-picker-heading">
                <div>
                  <strong>Modules de la formation</strong>
                  <p className="management-muted">
                    {formationForm.moduleIds.length} module(s) sélectionné(s)
                  </p>
                </div>
                <input
                  aria-label="Rechercher un module"
                  className="sp-field"
                  onChange={(event) => setSearchModules(event.target.value)}
                  placeholder="Rechercher un module"
                  type="search"
                  value={searchModules}
                />
              </div>
              <div className="management-module-options">
                {filteredModules.map((module) => {
                  const checked = formationForm.moduleIds.some(
                    (id) => String(id) === String(module.id),
                  );
                  return (
                    <label className="management-module-option" key={module.id}>
                      <input
                        checked={checked}
                        onChange={() =>
                          setFormationForm((current) => ({
                            ...current,
                            moduleIds: checked
                              ? current.moduleIds.filter((id) => String(id) !== String(module.id))
                              : [...current.moduleIds, module.id],
                          }))
                        }
                        type="checkbox"
                      />
                      {module.name}
                    </label>
                  );
                })}
                {filteredModules.length === 0 && (
                  <p className="management-muted">Aucun module dans le catalogue du centre.</p>
                )}
              </div>
              <div className="management-new-module">
                <strong>Ajouter un module au catalogue</strong>
                <div>
                  <input
                    aria-label="Nom du nouveau module"
                    className="sp-field"
                    maxLength={100}
                    onChange={(event) => setNewModuleName(event.target.value)}
                    placeholder="Nom du module"
                    value={newModuleName}
                  />
                  <select
                    aria-label="Domaine du nouveau module"
                    className="sp-field"
                    onChange={(event) => setNewModuleDomain(event.target.value)}
                    value={newModuleDomain}
                  >
                    <option value="">Choisir un domaine</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={saving || !newModuleName.trim() || !newModuleDomain}
                    onClick={() => void handleCreateModule()}
                    type="button"
                    variant="secondary"
                  >
                    + Créer et sélectionner
                  </Button>
                </div>
              </div>
            </div>
            <div className="management-editor-actions management-editor-wide">
              <Button onClick={() => setFormOpen(false)} type="button" variant="secondary">
                Annuler
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? 'Enregistrement…' : 'Enregistrer la formation'}
              </Button>
            </div>
          </form>
        </Panel>
        </Modal>
      )}
      {groupFormOpen && (
        <Modal label="Nouveau groupe" onClose={() => setGroupFormOpen(false)}>
        <Panel className="management-editor">
          <div className="management-editor-heading">
            <div>
              <p className="planning-progress-eyebrow">Organisation des étudiants</p>
              <h2>{groupForm.id !== undefined ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
            </div>
            <button
              aria-label="Fermer le formulaire"
              className="planning-dialog-close"
              onClick={() => setGroupFormOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <form className="management-editor-form" onSubmit={(event) => void submitGroup(event)}>
            <label className="sp-form-field">
              Nom du groupe
              <input
                className="sp-field"
                maxLength={100}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex. : Groupe A"
                required
                value={groupForm.name}
              />
            </label>
            <label className="sp-form-field">
              Formation
              <select
                className="sp-field"
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, formationId: event.target.value }))
                }
                required
                value={groupForm.formationId}
              >
                <option value="">Sélectionner une formation active</option>
                {formations
                  .filter((formation) => formation.active)
                  .map((formation) => (
                    <option key={formation.id} value={formation.id}>
                      {formation.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="sp-form-field">
              Formateur responsable
              <select
                className="sp-field"
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, teacherId: event.target.value }))
                }
                value={groupForm.teacherId}
              >
                <option value="">Aucun formateur</option>
                {state.status === 'loaded' &&
                  state.data.filters.teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="sp-form-field">
              Date de début
              <input
                className="sp-field"
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, startsOn: event.target.value }))
                }
                required
                type="date"
                value={groupForm.startsOn}
              />
            </label>
            <label className="sp-form-field">
              Capacité maximale
              <input
                className="sp-field"
                max="500"
                min="1"
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, capacity: Number(event.target.value) }))
                }
                required
                type="number"
                value={groupForm.capacity}
              />
            </label>
            <p className="management-muted management-editor-wide">
              {groupForm.formationId
                ? (() => {
                    const formation = formations.find(
                      (item) => String(item.id) === groupForm.formationId,
                    );
                    try {
                      return `Fin calculée selon la durée de la formation : ${calculateGroupEndDate(groupForm.startsOn, formation?.duration ?? '')}.`;
                    } catch {
                      return 'La durée de la formation doit être au format « 3 mois » ou « 1 an ».';
                    }
                  })()
                : 'Choisissez une formation pour calculer automatiquement la date de fin.'}
            </p>
            <div className="management-editor-actions management-editor-wide">
              <Button onClick={() => setGroupFormOpen(false)} type="button" variant="secondary">
                Annuler
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? 'Enregistrement…' : groupForm.id !== undefined ? 'Enregistrer les modifications' : 'Créer le groupe'}
              </Button>
            </div>
          </form>
        </Panel>
        </Modal>
      )}
      {state.status === 'loaded' && (
        <>
          {formationStats && (
            <section aria-label="Statistiques des formations et groupes" className="formation-overview-stats">
              <article className="is-highlighted"><span>Formations</span><strong>{formationStats.formationCount}</strong><small>{formations.filter((formation) => formation.active).length} actives</small></article>
              <article><span>Groupes actifs</span><strong>{formationStats.activeGroupCount}</strong><small>{state.data.filters.groups.length} groupe(s) au total</small></article>
              <article><span>Étudiants dans les groupes</span><strong>{formationStats.studentCount}</strong><small>Places occupées dans le centre</small></article>
              <article><span>Cours hebdomadaires</span><strong>{formationStats.weeklyCourseCount}</strong><small>Séances planifiées</small></article>
            </section>
          )}
          {state.data.filters.formations.length === 0 ? (
            <EmptyState title="Aucune formation n’est enregistrée dans ce centre." />
          ) : (
            <Panel className="formation-directory-panel">
              <header className="formation-directory-heading">
                <div>
                  <h2>Formations et groupes</h2>
                  <p>{visibleFormations.length} formation(s) affichée(s) sur {formations.length}</p>
                </div>
                <div aria-label="Mode d’affichage" className="student-view-toggle">
                  <Button aria-label="Afficher en cartes" aria-pressed={directoryView === 'cards'} className="student-view-toggle-button" onClick={() => setDirectoryView('cards')} title="Cartes" type="button" variant={directoryView === 'cards' ? 'primary' : 'secondary'}>
                    <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" /></svg>
                  </Button>
                  <Button aria-label="Afficher en tableau" aria-pressed={directoryView === 'table'} className="student-view-toggle-button" onClick={() => setDirectoryView('table')} title="Tableau" type="button" variant={directoryView === 'table' ? 'primary' : 'secondary'}>
                    <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></svg>
                  </Button>
                </div>
              </header>
              <div className="formation-directory-filters">
                <label className="sp-form-field">
                  Rechercher
                  <input className="sp-field" onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Formation ou groupe" type="search" value={directorySearch} />
                </label>
                <label className="sp-form-field">
                  Module
                  <select className="sp-field" onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}>
                    <option value="">Tous les modules</option>
                    {state.data.filters.subjects.map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.name}</option>)}
                  </select>
                </label>
                <label className="sp-form-field">
                  Formation / niveau
                  <select className="sp-field" onChange={(event) => setLevelFilter(event.target.value)} value={levelFilter}>
                    <option value="">Tous les niveaux</option>
                    {formations.map((formation) => <option key={formation.id} value={String(formation.id)}>{formation.name}</option>)}
                  </select>
                </label>
                <label className="sp-form-field">
                  Formateur
                  <select className="sp-field" onChange={(event) => setTeacherFilter(event.target.value)} value={teacherFilter}>
                    <option value="">Tous les formateurs</option>
                    {state.data.filters.teachers.map((teacher) => <option key={teacher.id} value={String(teacher.id)}>{teacher.name}</option>)}
                  </select>
                </label>
                <span className="management-result-count">{visibleFormations.length} résultat(s)</span>
              </div>
              {visibleFormations.length === 0 ? (
                <EmptyState title="Aucune formation ne correspond à ces filtres." />
              ) : directoryView === 'cards' ? (
                <div className="formation-directory-list">
                  {visibleFormations.map((formation) => {
                    let groups = state.data.filters.groups.filter(
                      (group) => String(group.formationId) === String(formation.id),
                    );
                    if (teacherFilter) {
                      groups = groups.filter((group) => String(group.teacherId ?? '') === teacherFilter);
                    }
                    const subjectIds = state.data.subjectIdsByFormation[String(formation.id)] ?? [];
                    return (
                      <Panel
                        className={`management-card management-formation-card${selectedFormationId === String(formation.id) ? ' is-selected' : ''}`}
                        key={formation.id}
                      >
                        <div className="management-card-heading">
                          <button
                            aria-label={`Afficher les groupes de ${formation.name}`}
                            aria-pressed={selectedFormationId === String(formation.id)}
                            className="management-icon management-icon-indigo management-formation-select"
                            onClick={() =>
                              setSelectedFormationId((current) =>
                                current === String(formation.id) ? '' : String(formation.id),
                              )
                            }
                            type="button"
                          >
                            F
                          </button>
                          <div>
                            <h2>{formation.name}</h2>
                            <p>{formation.active ? 'Formation active' : 'Formation inactive'}</p>
                          </div>
                        </div>
                        {formation.description && (
                          <p className="management-description">
                            {formation.description.trim().split(/\s+/).filter(Boolean).slice(0, 50).join(' ')}
                            {formation.description.trim().split(/\s+/).filter(Boolean).length > 50 ? '…' : ''}
                          </p>
                        )}
                        <div className="management-metrics">
                          <div><span>Durée</span><strong>{formation.duration || 'Non définie'}</strong></div>
                          <div><span>Volume hebdomadaire</span><strong>{formation.hoursPerWeek ?? '—'} h</strong></div>
                          <div><span>Groupes</span><strong>{groups.length}</strong></div>
                        </div>
                        <div className="management-chip-list">
                          {subjectIds.map((subjectId) => {
                            const subject = state.data.filters.subjects.find(
                              (item) => String(item.id) === String(subjectId),
                            );
                            return subject ? <span className="management-chip" key={subjectId}>{subject.name}</span> : null;
                          })}
                          {subjectIds.length === 0 && <span className="management-muted">Aucun module associé</span>}
                        </div>
                        <div className="management-group-list">
                          {groups.map((group) => {
                            const teacher = state.data.filters.teachers.find((item) => String(item.id) === String(group.teacherId));
                            const count = studentCounts.get(String(group.id)) ?? 0;
                            const groupCourses = state.data.courses.filter((course) => String(course.groupId) === String(group.id));
                            return (
                              <div className="management-group-row" key={group.id}>
                                <span>
                                  <strong>{group.name}</strong>
                                  <small>{group.startsOn || 'Début non défini'} – {group.endsOn || 'Fin non définie'}</small>
                                  <small>{teacher ? `Formateur : ${teacher.name}` : 'Formateur non défini'} · {count} étudiant(s) · {groupCourses.length} cours / semaine</small>
                                </span>
                                <span className={group.active ? 'management-status-active' : 'management-status-inactive'}>
                                  {group.active ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                            );
                          })}
                          {groups.length === 0 && <p className="management-muted">Aucun groupe rattaché à cette formation.</p>}
                        </div>
                        {canManage && (
                          <div className="management-card-actions">
                            {formation.active && <Button onClick={() => startGroupForm(String(formation.id))} type="button">+ Groupe</Button>}
                            <Button onClick={() => startFormationForm(formation)} type="button" variant="secondary">Modifier</Button>
                            <Button onClick={() => void handleDeleteFormation(formation.id)} type="button" variant="danger">Supprimer</Button>
                          </div>
                        )}
                      </Panel>
                    );
                  })}
                </div>
              ) : (
                <div className="formation-directory-table-wrap">
                  <table className="formation-directory-table">
                    <thead><tr><th>Formation</th><th>Groupe</th><th>Modules</th><th>Formateur</th><th>Étudiants</th><th>Cours / sem.</th><th>Dates</th><th>Statut</th></tr></thead>
                    <tbody>
                      {visibleFormations.flatMap((formation) => {
                        let groups = state.data.filters.groups.filter((group) => String(group.formationId) === String(formation.id));
                        if (teacherFilter) groups = groups.filter((group) => String(group.teacherId ?? '') === teacherFilter);
                        const moduleNames = (state.data.subjectIdsByFormation[String(formation.id)] ?? [])
                          .map((id) => state.data.filters.subjects.find((subject) => String(subject.id) === String(id))?.name)
                          .filter((name): name is string => Boolean(name));
                        const formationGroups = groups.length ? groups : [null];
                        return formationGroups.map((group) => {
                          const teacher = group
                            ? state.data.filters.teachers.find((item) => String(item.id) === String(group.teacherId))
                            : undefined;
                          const groupCourses = group
                            ? state.data.courses.filter((course) => String(course.groupId) === String(group.id))
                            : [];
                          return (
                            <tr key={`${formation.id}-${group?.id ?? 'no-group'}`}>
                              <td><strong>{formation.name}</strong><small>{formation.duration || 'Durée non définie'} · {formation.hoursPerWeek ?? '—'} h / semaine</small></td>
                              <td>{group?.name ?? 'Aucun groupe'}{group && <small>{group.capacity} places maximum</small>}</td>
                              <td><div className="management-chip-list">{moduleNames.length ? moduleNames.map((name) => <span className="management-chip" key={name}>{name}</span>) : <span className="management-muted">Aucun module</span>}</div></td>
                              <td>{teacher?.name ?? (group ? 'Non défini' : '—')}</td>
                              <td>{group ? `${studentCounts.get(String(group.id)) ?? 0} / ${group.capacity}` : '—'}</td>
                              <td>{group ? groupCourses.length : '—'}</td>
                              <td>{group ? `${group.startsOn ?? '—'} – ${group.endsOn ?? '—'}` : '—'}</td>
                              <td><span className={group?.active && formation.active ? 'management-status-active' : 'management-status-inactive'}>{group ? group.active ? 'Groupe actif' : 'Groupe inactif' : formation.active ? 'Formation active' : 'Formation inactive'}</span></td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
          {selectedFormation && (
            <section aria-label={`Groupes de ${selectedFormation.name}`} className="space-y-3">
              <header className="planning-progress-section-heading">
                <div>
                  <p className="planning-progress-eyebrow">Formation sélectionnée</p>
                  <h2>Groupes de {selectedFormation.name}</h2>
                </div>
                {canManage && (
                  <Button onClick={() => startGroupForm(selectedFormationId)} type="button">
                    + Ajouter un groupe
                  </Button>
                )}
              </header>
              {selectedGroups.length === 0 ? (
                <EmptyState title="Aucun groupe pour cette formation." />
              ) : (
                <div className="formation-group-card-list">
                  {selectedGroups.map((group) => {
                    const count = studentCounts.get(String(group.id)) ?? 0;
                    const remaining = Math.max(0, group.capacity - count);
                    const percentage = Math.min(100, Math.round((count / group.capacity) * 100));
                    const teacher = state.data.filters.teachers.find(
                      (item) => String(item.id) === String(group.teacherId),
                    );
                    return (
                      <Panel className="management-group-card" key={group.id}>
                        <header className="management-group-card-heading">
                          <div>
                            <p className="planning-progress-eyebrow">Groupe</p>
                            <h3>{group.name}</h3>
                          </div>
                          <span
                            className={
                              remaining === 0
                                ? 'management-group-full'
                                : 'management-group-available'
                            }
                          >
                            {remaining === 0 ? 'Complet' : 'Disponible'}
                          </span>
                        </header>
                        <div className="management-group-enrollment">
                          <strong>{count}</strong>
                          <span>/ {group.capacity} étudiants</span>
                        </div>
                        <div
                          aria-label={`${group.name} occupé à ${percentage} %`}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={percentage}
                          className={`management-group-progress${remaining === 0 ? ' is-full' : ''}`}
                          role="progressbar"
                        >
                          <span style={{ width: `${percentage}%` }} />
                        </div>
                        <div className="management-group-details">
                          <span>
                            <b>Formateur</b>
                            {teacher?.name ?? 'Non défini'}
                          </span>
                          <span>
                            <b>Début</b>
                            {group.startsOn ?? 'Non défini'}
                          </span>
                          <span>
                            <b>Fin</b>
                            {group.endsOn ?? 'Non définie'}
                          </span>
                          <span>
                            <b>Places restantes</b>
                            {remaining}
                          </span>
                        </div>
                        {canManage && (
                          <div className="management-card-actions">
                            <Button
                              onClick={() => startGroupForm(String(group.formationId), group)}
                              type="button"
                              variant="secondary"
                            >
                              Modifier
                            </Button>
                            <Button
                              onClick={() => void handleDeleteGroup(group.id)}
                              type="button"
                              variant="danger"
                            >
                              Supprimer le groupe
                            </Button>
                          </div>
                        )}
                      </Panel>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          {state.data.filters.groups.some((group) => !group.formationId) && (
            <Panel>
              <h2 className="management-unassigned-heading">Groupes sans formation</h2>
              <div className="management-chip-list">
                {state.data.filters.groups
                  .filter((group) => !group.formationId)
                  .map((group) => (
                    <span className="management-chip" key={group.id}>
                      {group.name}
                    </span>
                  ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </PageFrame>
  );
}

export function StudentsPage() {
  const { profile } = useAuth();
  const planning = usePlanningData();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [studentView, setStudentView] = useState<'table' | 'cards'>('table');
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<StudentState>({ status: 'loading' });
  const [attendanceState, setAttendanceState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; rate: number | null; recordedCount: number }
  >({ status: 'loading' });
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) notify(value, 'error');
  };
  const setMessage = (value: string | null) => {
    if (value) notify(value, 'success');
  };
  const [enrollmentIds, setEnrollmentIds] = useState<Record<string, Array<string | number>>>({});
  const [form, setForm] = useState<StudentRecordInput>({
    firstName: '', lastName: '', email: '', telephone: '', guardianName: '', guardianEmail: '', parentTelephone: '', guardianCity: '', city: '', address: '', educationLevel: '',
  });
  const canManage = profile?.role === 'admin' || profile?.role === 'director';

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ status: 'loading' });
      try {
        const students = await getCentreStudents(getSupabaseClient(), profile?.centreId ?? '');
        if (active) setState({ status: 'loaded', students });
      } catch (cause) {
        if (active) setState({ status: 'error', message: errorMessage(cause) });
      }
    }
    void load();
    return () => { active = false; };
  }, [profile?.centreId, reloadKey]);

  useEffect(() => {
    let active = true;
    if (!profile?.centreId) return;
    setAttendanceState({ status: 'loading' });
    void getCentreAttendanceSummary(getSupabaseClient(), profile.centreId)
      .then((summary) => {
        if (active) setAttendanceState({ status: 'loaded', ...summary });
      })
      .catch((cause: unknown) => {
        if (active) setAttendanceState({ status: 'error', message: errorMessage(cause) });
      });
    return () => { active = false; };
  }, [profile?.centreId, reloadKey]);

  useEffect(() => {
    let active = true;
    if (!profile?.centreId) { setEnrollmentIds({}); return; }
    void getStudentCourseEnrollmentIds(getSupabaseClient(), profile.centreId)
      .then((ids) => { if (active) setEnrollmentIds(ids); })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [profile?.centreId, reloadKey]);

  async function changeCourseEnrollment(student: ManagedStudent, courseId: string | number, enrolled: boolean) {
    if (!profile?.centreId || !canManage) return;
    setError(null); setMessage(null);
    try {
      await setStudentCourseEnrollment(getSupabaseClient(), profile.centreId, student.id, courseId, enrolled);
      setEnrollmentIds((current) => {
        const key = String(student.id);
        const currentIds = current[key] ?? [];
        return { ...current, [key]: enrolled
          ? (currentIds.some((id) => String(id) === String(courseId)) ? currentIds : [...currentIds, courseId])
          : currentIds.filter((id) => String(id) !== String(courseId)) };
      });
      setMessage(enrolled ? 'Étudiant inscrit au cours.' : 'Inscription au cours supprimée.');
      setReloadKey((key) => key + 1);
    } catch (cause) { setError(errorMessage(cause)); }
  }

  const levels = useMemo(() => {
    if (state.status !== 'loaded') return [];
    return [...new Set(state.students.map((student) => student.educationLevel).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [state]);
  const groupIdsByStudentId = useMemo(() => {
    const result = new Map<string, Set<string>>();
    if (state.status !== 'loaded') return result;
    const groupIdByCourseId = new Map<string, string>();
    if (planning.state.status === 'loaded') {
      for (const course of planning.state.data.courses) {
        if (course.groupId !== null) groupIdByCourseId.set(String(course.id), String(course.groupId));
      }
    }
    for (const student of state.students) {
      const groupIds = new Set<string>();
      if (student.groupId !== null) groupIds.add(String(student.groupId));
      for (const courseId of enrollmentIds[String(student.id)] ?? []) {
        const groupId = groupIdByCourseId.get(String(courseId));
        if (groupId) groupIds.add(groupId);
      }
      result.set(String(student.id), groupIds);
    }
    return result;
  }, [enrollmentIds, planning.state, state]);
  const visibleStudents = useMemo(() => {
    if (state.status !== 'loaded') return [];
    const normalized = search.trim().toLocaleLowerCase('fr');
    return state.students.filter((student) =>
      [student.firstName, student.lastName, student.email, student.telephone, student.guardianName, student.guardianEmail, student.parentTelephone, student.guardianCity, student.city, student.groupName]
        .filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(normalized) &&
      (!groupFilter || groupIdsByStudentId.get(String(student.id))?.has(groupFilter) === true) &&
      (!levelFilter || student.educationLevel === levelFilter),
    );
  }, [groupFilter, groupIdsByStudentId, levelFilter, search, state]);
  const totalActiveEnrollments = state.status === 'loaded'
    ? state.students.reduce((total, student) => total + student.courseCount, 0)
    : 0;
  const studentsWithActiveEnrollments = state.status === 'loaded'
    ? state.students.filter((student) => student.courseCount > 0).length
    : 0;
  const groupOccupancy = useMemo(() => {
    if (state.status !== 'loaded') return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const student of state.students) {
      for (const groupId of groupIdsByStudentId.get(String(student.id)) ?? []) {
        counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
      }
    }
    return counts;
  }, [groupIdsByStudentId, state]);

  function startCreate() {
    setEditingId(null);
    setForm({ firstName: '', lastName: '', email: '', telephone: '', guardianName: '', guardianEmail: '', parentTelephone: '', guardianCity: '', city: '', address: '', educationLevel: '' });
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function startEdit(student: ManagedStudent) {
    setEditingId(student.id);
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email ?? '',
      telephone: student.telephone ?? '',
      guardianName: student.guardianName ?? '',
      guardianEmail: student.guardianEmail ?? '',
      parentTelephone: student.parentTelephone ?? '',
      guardianCity: student.guardianCity ?? '',
      city: student.city ?? '',
      address: student.address ?? '',
      educationLevel: student.educationLevel ?? '',
    });
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.centreId || !canManage) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editingId === null) {
        await createCentreStudent(getSupabaseClient(), profile.centreId, form);
        setMessage('Étudiant créé avec succès.');
      } else {
        await updateCentreStudent(getSupabaseClient(), profile.centreId, editingId, form);
        setMessage('Dossier étudiant modifié.');
      }
      setFormOpen(false);
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function changeStudentGroup(student: ManagedStudent, value: string) {
    if (!profile?.centreId || !canManage) return;
    try {
      await assignStudentToGroup(getSupabaseClient(), profile.centreId, student.id, value ? value : null);
      setMessage('Affectation au groupe enregistrée.');
      setError(null);
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }


  async function removeStudent(student: ManagedStudent) {
    if (!profile?.centreId || !canManage) return;
    if (!await confirmAction(`Supprimer le dossier de ${student.firstName} ${student.lastName} ?`)) return;
    setError(null);
    setMessage(null);
    try {
      await deleteCentreStudent(getSupabaseClient(), profile.centreId, student.id);
      setMessage('Dossier étudiant supprimé.');
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const fields: Array<{ key: keyof StudentRecordInput; label: string; required?: boolean; type?: string }> = [
    { key: 'firstName', label: 'Prénom', required: true },
    { key: 'lastName', label: 'Nom', required: true },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'telephone', label: 'Téléphone de l’étudiant', type: 'tel' },
    { key: 'guardianName', label: 'Nom du parent / tuteur' },
    { key: 'guardianEmail', label: 'E-mail du parent / tuteur', type: 'email' },
    { key: 'parentTelephone', label: 'Téléphone du parent / tuteur', type: 'tel' },
    { key: 'guardianCity', label: 'Ville du parent / tuteur' },
    { key: 'city', label: 'Ville' },
    { key: 'address', label: 'Adresse' },
    { key: 'educationLevel', label: 'Niveau d’études' },
  ];
  const planningData = planning.state.status === 'loaded' ? planning.state.data : null;

  return (
    <PageFrame
      actions={canManage ? <Button onClick={startCreate} type="button">+ Ajouter un étudiant</Button> : undefined}
      description="Dossiers étudiants du centre, groupe d’affectation et inscriptions aux cours."
      title="Étudiants"
    >
      {error && <Alert tone="error"><p>{error}</p></Alert>}
      {formOpen && canManage && (
        <Modal label={editingId === null ? 'Nouvel étudiant' : 'Modifier l’étudiant'} onClose={() => setFormOpen(false)}>
        <Panel className="management-editor">
          <header className="management-editor-heading">
            <div>
              <p className="planning-progress-eyebrow">Dossier étudiant</p>
              <h2>{editingId === null ? 'Nouvel étudiant' : 'Modifier l’étudiant'}</h2>
            </div>
            <button aria-label="Fermer le formulaire" className="planning-dialog-close" onClick={() => setFormOpen(false)} type="button">×</button>
          </header>
          <form className="sp-form-grid" onSubmit={(event) => void submitStudent(event)}>
            {fields.map((field) => (
              <label className="sp-form-field sp-popup-placeholder-field" key={field.key}>
                <span className="sp-popup-sr-label">{field.label}</span>
                <input
                  className="sp-field"
                  autoComplete="off"
                  placeholder={field.label}
                  aria-label={field.label}
                  required={field.required}
                  type={field.type ?? 'text'}
                  value={form[field.key]}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </label>
            ))}
            <div className="management-toolbar">
              <Button disabled={saving} type="submit">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
              <Button onClick={() => setFormOpen(false)} type="button" variant="secondary">Annuler</Button>
            </div>
          </form>
        </Panel>
        </Modal>
      )}
      {state.status === 'loaded' && (
        <section aria-label="Statistiques des étudiants" className="student-overview-stats">
          <article className="is-highlighted"><span>Total des étudiants</span><strong>{state.students.length}</strong><small>{visibleStudents.length} affiché(s) selon les filtres</small></article>
          <article><span>Taux de présence</span><strong>{attendanceState.status === 'loaded' && attendanceState.rate !== null ? `${Math.round(attendanceState.rate)}%` : attendanceState.status === 'loading' ? '…' : '—'}</strong><small>{attendanceState.status === 'loaded' ? `${attendanceState.recordedCount} présence(s) enregistrée(s)` : attendanceState.status === 'error' ? 'Indisponible' : 'Chargement'}</small></article>
          <article><span>Inscriptions actives</span><strong>{totalActiveEnrollments}</strong><small>{studentsWithActiveEnrollments} étudiant(s) inscrit(s) à au moins un cours</small></article>
        </section>
      )}
      {attendanceState.status === 'error' && (
        <Alert tone="error"><p>Le taux de présence n’a pas pu être calculé.</p><p>{attendanceState.message}</p></Alert>
      )}
      {state.status === 'loading' && <Panel><LoadingState label="Chargement des étudiants…" /></Panel>}
      {state.status === 'error' && (
        <Alert tone="error">
          <p>La liste des étudiants n’a pas pu être chargée.</p>
          <p>{state.message}</p>
          <Button onClick={() => setReloadKey((key) => key + 1)} type="button" variant="secondary">Réessayer</Button>
        </Alert>
      )}
      {state.status === 'loaded' && (
        <Panel className="student-directory-panel">
          <header className="student-directory-heading">
            <div><h2>Gestion des étudiants</h2><p>{visibleStudents.length} étudiant(s) affiché(s) sur {state.students.length}</p></div>
            <div aria-label="Mode d’affichage" className="student-view-toggle">
              <Button aria-label="Afficher en tableau" aria-pressed={studentView === 'table'} className="student-view-toggle-button" onClick={() => setStudentView('table')} title="Tableau" type="button" variant={studentView === 'table' ? 'primary' : 'secondary'}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></svg>
              </Button>
              <Button aria-label="Afficher en cartes" aria-pressed={studentView === 'cards'} className="student-view-toggle-button" onClick={() => setStudentView('cards')} title="Cartes" type="button" variant={studentView === 'cards' ? 'primary' : 'secondary'}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" /></svg>
              </Button>
            </div>
          </header>
          <div className="student-directory-filters">
            <label className="sp-form-field">
              Rechercher par nom
              <input className="sp-field" onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail, téléphone…" type="search" value={search} />
            </label>
            <label className="sp-form-field">
              Groupe
              <select className="sp-field" onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
                <option value="">Tous les groupes</option>
                {planningData?.filters.groups.map((group) => (
                  <option key={group.id} value={String(group.id)}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="sp-form-field">
              Niveau
              <select className="sp-field" onChange={(event) => setLevelFilter(event.target.value)} value={levelFilter}>
                <option value="">Tous les niveaux</option>
                {levels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <span className="management-result-count">{visibleStudents.length} résultat(s)</span>
          </div>
          {visibleStudents.length === 0 ? (
            <EmptyState title={search || groupFilter || levelFilter ? 'Aucun résultat avec ces filtres.' : 'Aucun étudiant enregistré dans ce centre.'} />
          ) : studentView === 'table' ? (
            <div className="student-directory-table-wrap">
              <table className="student-directory-table">
                <thead><tr><th>Nom</th><th>Niveau</th><th>Groupes</th><th>Tuteur</th><th>Inscrit</th><th>Inscriptions</th>{canManage && <th>Actions</th>}</tr></thead>
                <tbody>
                  {visibleStudents.map((student) => {
                    const studentGroups = planningData
                      ? [...(groupIdsByStudentId.get(String(student.id)) ?? [])]
                        .map((groupId) => planningData.filters.groups.find((item) => String(item.id) === groupId))
                        .filter((group): group is PlanningData['filters']['groups'][number] => Boolean(group))
                      : [];
                    return (
                      <tr key={student.id}>
                        <td><strong>{student.firstName} {student.lastName}</strong>{student.telephone && <a href={`tel:${student.telephone}`}>{student.telephone}</a>}{student.email && <a href={`mailto:${student.email}`}>{student.email}</a>}</td>
                        <td><span className="student-level-badge">{student.educationLevel || 'Non renseigné'}</span></td>
                        <td>
                          {studentGroups.length ? (
                            <div className="student-directory-group-list">
                              {studentGroups.map((group) => {
                                const occupied = groupOccupancy.get(String(group.id)) ?? 0;
                                const remaining = Math.max(0, group.capacity - occupied);
                                const lowCapacity = remaining <= 5;
                                const teacher = planningData?.filters.teachers.find((item) => String(item.id) === String(group.teacherId));
                                return (
                                  <span className={`student-group-badge${lowCapacity ? ' is-warning' : ''}`} key={group.id}>
                                    {lowCapacity && <span aria-hidden="true">⚠ </span>}
                                    {group.name} - {group.formationName ?? 'Formation non définie'}
                                    <small>{remaining === 0 ? 'Groupe complet' : `${remaining} place(s) restante(s)`}</small>
                                    {teacher && <small>Formateur : {teacher.name}</small>}
                                  </span>
                                );
                              })}
                            </div>
                          ) : groupIdsByStudentId.get(String(student.id))?.size ? (
                            <span className="management-muted">Chargement des groupes…</span>
                          ) : <span className="management-muted">Non affecté</span>}
                        </td>
                        <td>
                          <div className="student-guardian-details">
                            <strong>{student.guardianName || '—'}</strong>
                            {student.guardianEmail && <a href={`mailto:${student.guardianEmail}`}>{student.guardianEmail}</a>}
                            {student.parentTelephone && <a href={`tel:${student.parentTelephone}`}>{student.parentTelephone}</a>}
                            {student.guardianCity && <span>{student.guardianCity}</span>}
                          </div>
                        </td>
                        <td>{student.createdAt ? new Date(student.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                        <td><span className={`student-enrollment-badge${student.courseCount ? ' is-active' : ''}`}>{student.courseCount ? `${student.courseCount} active(s)` : 'Aucune'}</span></td>
                        {canManage && <td><div className="student-directory-actions"><Button onClick={() => startEdit(student)} type="button" variant="secondary">Modifier</Button><Button onClick={() => void removeStudent(student)} type="button" variant="danger">Supprimer</Button></div></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="management-card-grid management-four-column-grid management-student-grid">
              {visibleStudents.map((student) => (
            <Panel className="management-student-card" key={student.id}>
              <header className="management-student-heading">
                <span aria-hidden="true" className="management-avatar management-student-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span>
                <div>
                  <h2>{student.firstName} {student.lastName}</h2>
                  <p>{student.educationLevel || 'Niveau non renseigné'}</p>
                </div>
              </header>
              <div className="management-student-details">
                {student.email && <a href={`mailto:${student.email}`}><span aria-hidden="true">✉</span>{student.email}</a>}
                {student.telephone && <a href={`tel:${student.telephone}`}><span aria-hidden="true">☎</span>{student.telephone}</a>}
                {student.city && <span><span aria-hidden="true">⌖</span>{student.city}</span>}
              </div>
              {(student.guardianName || student.guardianEmail || student.parentTelephone || student.guardianCity) && (
                <div className="student-card-guardian">
                  <strong>Parent / tuteur</strong>
                  {student.guardianName && <span>{student.guardianName}</span>}
                  {student.guardianEmail && <a href={`mailto:${student.guardianEmail}`}>{student.guardianEmail}</a>}
                  {student.parentTelephone && <a href={`tel:${student.parentTelephone}`}>{student.parentTelephone}</a>}
                  {student.guardianCity && <span>{student.guardianCity}</span>}
                </div>
              )}
              {planningData && (
                <div className="student-card-groups">
                  {groupIdsByStudentId.get(String(student.id))?.size === 0 && <span className="management-muted">Groupe non affecté</span>}
                  {[...(groupIdsByStudentId.get(String(student.id)) ?? [])].map((groupId) => {
                    const group = planningData.filters.groups.find((item) => String(item.id) === groupId);
                    if (!group) return null;
                    const remaining = Math.max(0, group.capacity - (groupOccupancy.get(groupId) ?? 0));
                    const teacher = planningData.filters.teachers.find((item) => String(item.id) === String(group.teacherId));
                    return (
                      <span className={`student-group-badge${remaining <= 5 ? ' is-warning' : ''}`} key={group.id}>
                        {remaining <= 5 && <span aria-hidden="true">⚠ </span>}
                        {group.name} - {group.formationName ?? 'Formation non définie'}
                        <small>{remaining === 0 ? 'Groupe complet' : `${remaining} place(s) restante(s)`}{teacher ? ` · ${teacher.name}` : ''}</small>
                      </span>
                    );
                  })}
                </div>
              )}
              {!planningData && groupIdsByStudentId.get(String(student.id))?.size ? (
                <span className="management-muted">Chargement des groupes…</span>
              ) : null}
              <footer className="management-student-footer">
                <span>{student.educationLevel || 'Niveau non renseigné'}</span>
                <span>{student.courseCount} inscription(s)</span>
              </footer>
              {student.createdAt && <p className="management-muted">Inscrit le {new Date(student.createdAt).toLocaleDateString('fr-FR')}</p>}
              {canManage && planning.state.status === 'loaded' && (
                <div className="sp-form-grid">
                  <label className="sp-form-field">
                    Groupe
                    <select className="sp-field" value={student.groupId === null ? '' : String(student.groupId)} onChange={(event) => void changeStudentGroup(student, event.target.value)}>
                      <option value="">Non affecté</option>
                      {planning.state.data.filters.groups.filter((group) => group.active).map((group) => (
                        <option key={group.id} value={String(group.id)}>{group.name} · {group.formationName ?? 'Formation'}</option>
                      ))}
                    </select>
                  </label>
                  <details>
                    <summary>Gérer les inscriptions aux cours</summary>
                    <div className="sp-form-grid">
                      {planning.state.data.courses.map((course) => {
                        const enrolled = (enrollmentIds[String(student.id)] ?? []).some((id) => String(id) === String(course.id));
                        const groupMismatch = Boolean(course.groupId && String(student.groupId) !== String(course.groupId));
                        return (
                          <label className="cb" key={course.id}>
                            <input
                              type="checkbox"
                              checked={enrolled}
                              disabled={!enrolled && groupMismatch}
                              onChange={(event) => void changeCourseEnrollment(student, course.id, event.target.checked)}
                            />
                            {course.subjectName} — {course.groupName ?? 'Sans groupe'}
                          </label>
                        );
                      })}
                    </div>
                    <p className="management-muted">Les cours d’un autre groupe sont désactivés. Affectez d’abord l’étudiant au groupe correspondant.</p>
                  </details>
                </div>
              )}
              {canManage && (
                <div className="management-toolbar">
                  <Button onClick={() => startEdit(student)} type="button" variant="secondary">Modifier</Button>
                  <Button onClick={() => void removeStudent(student)} type="button" variant="danger">Supprimer</Button>
                </div>
              )}
            </Panel>
          ))}
            </div>
          )}
        </Panel>
      )}
    </PageFrame>
  );
}

function isoDate(date: Date): string {
  return [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
  ].join('-');
}

function formatCourseTime(occurrence: PlanningOccurrence): string {
  return `${occurrence.startsAt.slice(0, 5)} – ${occurrence.endsAt.slice(0, 5)}`;
}

function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `212${digits.slice(1)}`;
  return digits;
}

function formatAbsenceDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR');
}

function getDefaultAttendanceRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const to = new Date(from);
  to.setDate(from.getDate() + 5);
  return { from: isoDate(from), to: isoDate(to) };
}

function isValidAttendanceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && isoDate(date) === value;
}

export function AttendancePage() {
  const { profile } = useAuth();
  const { state: planningState, reload } = usePlanningData();
  const [dateRange, setDateRange] = useState(getDefaultAttendanceRange);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [absenceAlerts, setAbsenceAlerts] = useState<AbsenceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) notify(value, 'error');
  };
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const setMessage = (value: string | null) => {
    if (value) notify(value, 'success');
  };
  const [revision, setRevision] = useState(0);
  const [rosterEditor, setRosterEditor] = useState<
    | null
    | { status: 'loading'; groupId: string }
    | { status: 'error'; groupId: string; message: string }
    | {
        status: 'loaded';
        groupId: string;
        students: FormationGroupStudentOption[];
        selectedIds: Set<string>;
        saving: boolean;
      }
  >(null);

  const attendanceGroups = useMemo(() => {
    if (planningState.status !== 'loaded') return [];
    if (profile?.role !== 'formateur') return planningState.data.filters.groups;
    const teacherIds = new Set(
      planningState.data.filters.teachers.map((teacher) => String(teacher.id)),
    );
    return planningState.data.filters.groups.filter(
      (group) => group.teacherId !== null && teacherIds.has(String(group.teacherId)),
    );
  }, [planningState, profile?.role]);
  const selectedAttendanceGroup = attendanceGroups.find(
    (group) => String(group.id) === selectedGroupId,
  );

  async function openRosterEditor() {
    if (!selectedAttendanceGroup) return;
    const groupId = String(selectedAttendanceGroup.id);
    setRosterEditor({ status: 'loading', groupId });
    try {
      const students = await getMyFormationGroupStudents(
        getSupabaseClient(),
        selectedAttendanceGroup.id,
      );
      setRosterEditor({
        status: 'loaded',
        groupId,
        students,
        selectedIds: new Set(students.filter((student) => student.assigned).map((student) => String(student.id))),
        saving: false,
      });
    } catch (cause) {
      setRosterEditor({ status: 'error', groupId, message: errorMessage(cause) });
    }
  }

  async function saveRosterEditor() {
    if (!rosterEditor || rosterEditor.status !== 'loaded') return;
    const group = attendanceGroups.find((item) => String(item.id) === rosterEditor.groupId);
    if (!group) {
      setError('Le groupe sélectionné n’est plus disponible.');
      return;
    }
    setRosterEditor({ ...rosterEditor, saving: true });
    try {
      await saveMyFormationGroupStudents(
        getSupabaseClient(),
        group.id,
        [...rosterEditor.selectedIds],
      );
      setRosterEditor(null);
      setRevision((current) => current + 1);
      setMessage('La liste des étudiants du groupe a été enregistrée.');
    } catch (cause) {
      setRosterEditor({ ...rosterEditor, saving: false });
      setError(errorMessage(cause));
    }
  }

  const validDateRange = isValidAttendanceDate(dateRange.from)
    && isValidAttendanceDate(dateRange.to)
    && dateRange.from <= dateRange.to;
  const occurrences = useMemo(() => {
    if (planningState.status !== 'loaded' || !validDateRange) return [];
    const result: PlanningOccurrence[] = [];
    const lastDate = new Date(`${dateRange.to}T12:00:00`);
    for (let current = new Date(`${dateRange.from}T12:00:00`); current <= lastDate; current.setDate(current.getDate() + 1)) {
      const currentDate = isoDate(current);
      const currentOccurrences = getWeekOccurrences(
        planningState.data.courses,
        current,
        planningState.data.closedDates,
        planningState.data.cancelledOccurrences,
        planningState.data.completedOccurrences,
      )
        .filter((occurrence) => occurrence.date === currentDate && !occurrence.cancelled)
        .filter((occurrence) => {
          const group = planningState.data.filters.groups.find(
            (item) => String(item.id) === String(occurrence.groupId),
          );
          return (!group?.startsOn || currentDate >= group.startsOn)
            && (!group?.endsOn || currentDate <= group.endsOn);
        });
      result.push(...currentOccurrences);
    }
    return result;
  }, [dateRange, planningState, validDateRange]);
  const visibleCourseSheets = useMemo(() => {
    if (!sheet) return [];
    return sheet.courses.filter((courseSheet) => {
      const occurrence = occurrences.find((item) =>
        String(item.id) === String(courseSheet.courseId) && item.date === courseSheet.date,
      );
      return !selectedGroupId || String(occurrence?.groupId ?? '') === selectedGroupId;
    });
  }, [occurrences, selectedGroupId, sheet]);
  const attendanceTotals = useMemo(() => visibleCourseSheets.reduce(
    (totals, course) => {
      for (const student of course.students) {
        if (student.status === 'present') totals.present += 1;
        else if (student.status === 'absent') totals.absent += 1;
        else if (student.status === 'retard') totals.late += 1;
        else totals.unmarked += 1;
      }
      return totals;
    },
    { present: 0, absent: 0, late: 0, unmarked: 0 },
  ), [visibleCourseSheets]);
  const canRecordAttendance = profile?.role === 'formateur';

  async function exportAttendance(format: 'excel' | 'pdf') {
    const columns = [
      { label: 'Date', width: 1.1 },
      { label: 'Formation', width: 1.7 },
      { label: 'Groupe', width: 1.3 },
      { label: 'Cours / module', width: 1.5 },
      { label: 'Étudiant', width: 1.8 },
      { label: 'Statut', width: 1 },
      { label: 'Formateur', width: 1.5 },
      { label: 'Horaire', width: 1 },
      { label: 'Salle', width: 1.2 },
    ];
    const rows = visibleCourseSheets.flatMap((courseSheet) => {
      const occurrence = occurrences.find((item) =>
        String(item.id) === String(courseSheet.courseId) && item.date === courseSheet.date,
      );
      if (!occurrence) return [];
      const group = planningState.status === 'loaded'
        ? planningState.data.filters.groups.find(
          (item) => String(item.id) === String(occurrence.groupId),
        )
        : undefined;
      return courseSheet.students.map(({ student, status }) => [
        courseSheet.date,
        group?.formationName ?? 'Formation',
        group?.name ?? occurrence.groupName ?? 'Groupe non défini',
        occurrence.subjectName,
        `${student.firstName} ${student.lastName}`,
        status === 'present' ? 'Présent' : status === 'absent' ? 'Absent' : status === 'retard' ? 'En retard' : 'Non marqué',
        occurrence.teacherName,
        formatCourseTime(occurrence),
        occurrence.roomName || 'Salle non définie',
      ]);
    });

    setExporting(format);
    try {
      const groupName = selectedGroupId
        ? planningState.status === 'loaded'
          ? planningState.data.filters.groups.find(
            (group) => String(group.id) === selectedGroupId,
          )?.name ?? 'groupe'
          : 'groupe'
        : 'tous-les-groupes';
      const safeGroupName = groupName.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
      if (format === 'excel') {
        await exportTableToExcel(
          `presences-${dateRange.from}-au-${dateRange.to}-${safeGroupName}.xlsx`,
          'Présences',
          columns,
          rows,
        );
      } else {
        await exportTableToPdf(
          `presences-${dateRange.from}-au-${dateRange.to}-${safeGroupName}.pdf`,
          `Présences du ${formatAbsenceDate(dateRange.from)} au ${formatAbsenceDate(dateRange.to)}${selectedGroupId ? ` · ${groupName}` : ''}`,
          columns,
          rows,
        );
      }
      setMessage(`Export ${format.toUpperCase()} des présences téléchargé.`);
    } catch (cause) {
      const message = errorMessage(cause);
      setError(`Impossible de générer l’export ${format.toUpperCase()} des présences : ${message}`);
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (planningState.status !== 'loaded' || !profile?.centreId) return;
    let active = true;
    if (!validDateRange) {
      setSheet(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    const sessions = occurrences.map((occurrence) => ({
      courseId: occurrence.id,
      date: occurrence.date,
    }));
    void getAttendanceSheet(getSupabaseClient(), profile.centreId, dateRange.from, dateRange.to, sessions)
      .then((nextSheet) => {
        if (active) setSheet(nextSheet);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dateRange, occurrences, planningState, profile?.centreId, revision, validDateRange]);

  useEffect(() => {
    if (planningState.status !== 'loaded' || !profile?.centreId) return;
    let active = true;
    setAlertsLoading(true);
    setAbsenceAlerts([]);
    const courseIds = planningState.data.courses.map((course) => course.id);
    void getAbsenceAlerts(getSupabaseClient(), profile.centreId, courseIds)
      .then((alerts) => {
        if (active) setAbsenceAlerts(alerts);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setAlertsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planningState, profile?.centreId, revision]);

  async function updateStatus(
    courseId: string | number,
    sessionDate: string,
    studentId: string | number,
    status: AttendanceStatus,
  ) {
    if (!canRecordAttendance) {
      setError('La modification des présences est réservée au formateur.');
      return;
    }
    if (!profile?.centreId) {
      setError('Votre profil n’est rattaché à aucun centre.');
      return;
    }
    setError(null);
    setMessage(null);
    const key = `${courseId}|${sessionDate}|${studentId}`;
    setSavingKey(key);
    try {
      await saveAttendance(
        getSupabaseClient(),
        profile.centreId,
        courseId,
        studentId,
        sessionDate,
        status,
      );
      setMessage('Présence enregistrée.');
      setRevision((current) => current + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingKey(null);
    }
  }

  async function markCoursePresent(
    courseId: string | number,
    sessionDate: string,
    students: AttendanceSheet['courses'][number]['students'],
  ) {
    const centreId = profile?.centreId;
    if (!canRecordAttendance || !centreId) {
      setError('La modification des présences est réservée au formateur.');
      return;
    }
    if (students.length === 0) return;
    setSavingKey(`${courseId}|${sessionDate}`);
    setError(null);
    setMessage(null);
    try {
      await Promise.all(students.map(({ student }) => saveAttendance(
        getSupabaseClient(),
        centreId,
        courseId,
        student.id,
        sessionDate,
        'present',
      )));
      setMessage(`Présence enregistrée pour les ${students.length} étudiants du groupe.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingKey(null);
      setRevision((current) => current + 1);
    }
  }

  return (
    <PageFrame
      actions={
        <div className="attendance-filters">
          <label className="sp-form-field">
            Du
            <input
              className="sp-field"
              onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
              type="date"
              value={dateRange.from}
            />
          </label>
          <label className="sp-form-field">
            Au
            <input
              className="sp-field"
              onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
              type="date"
              value={dateRange.to}
            />
          </label>
          <label className="sp-form-field">
            Groupe
            <select className="sp-field" onChange={(event) => setSelectedGroupId(event.target.value)} value={selectedGroupId}>
              <option value="">Tous les groupes</option>
              {attendanceGroups.map((group) => (
                <option key={group.id} value={String(group.id)}>{group.name}{group.formationName ? ` · ${group.formationName}` : ''}</option>
              ))}
            </select>
          </label>
          {canRecordAttendance && (
            <Button
              disabled={!selectedAttendanceGroup || loading || savingKey !== null}
              onClick={() => void openRosterEditor()}
              type="button"
              variant="secondary"
            >
              Choisir les étudiants du groupe
            </Button>
          )}
          <div className="management-toolbar">
            <Button
              disabled={!visibleCourseSheets.length || exporting !== null}
              onClick={() => void exportAttendance('excel')}
              type="button"
              variant="secondary"
            >
              {exporting === 'excel' ? 'Export Excel…' : 'Exporter Excel'}
            </Button>
            <Button
              disabled={!visibleCourseSheets.length || exporting !== null}
              onClick={() => void exportAttendance('pdf')}
              type="button"
              variant="secondary"
            >
              {exporting === 'pdf' ? 'Export PDF…' : 'Exporter PDF'}
            </Button>
          </div>
        </div>
      }
      description={canRecordAttendance
        ? 'Choisissez une période et un groupe, puis enregistrez le statut de chaque étudiant pour chacune de ses séances.'
        : 'Consultez les présences enregistrées par les formateurs. Cette vue est en lecture seule.'}
      title="Suivi des présences"
    >
      <PlanningLoadState retry={reload} state={planningState} />
      {planningState.status === 'loaded' && (
        <Panel className="management-absence-alerts">
          <header className="management-attendance-heading">
            <div>
              <p className="planning-progress-eyebrow">Suivi automatique</p>
              <h2>Alertes d’absences répétées</h2>
              <p>Un étudiant apparaît après sa 4ᵉ absence dans le même cours.</p>
            </div>
            <span className="management-attendance-count">{absenceAlerts.length} alerte{absenceAlerts.length === 1 ? '' : 's'}</span>
          </header>
          {alertsLoading ? (
            <LoadingState label="Vérification des absences historiques…" />
          ) : absenceAlerts.length === 0 ? (
            <p className="management-muted">Aucun étudiant n’a dépassé 3 absences dans les cours accessibles à votre rôle.</p>
          ) : (
            <div className="management-attendance-list">
              {absenceAlerts.map((alert) => {
                const course = planningState.data.courses.find((item) => String(item.id) === String(alert.courseId));
                const phone = alert.parentTelephone ? normalizeWhatsAppPhone(alert.parentTelephone) : '';
                const messageText = `Bonjour, nous vous contactons au sujet de ${alert.firstName} ${alert.lastName}, qui compte ${alert.absenceCount} absences dans le cours « ${course?.subjectName ?? 'cours'} » à SchoolPlans. Dernière absence enregistrée : ${formatAbsenceDate(alert.lastAbsenceDate)}. Merci de contacter le centre pour faire le point.`;
                const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}` : '';
                return (
                  <div className="management-attendance-row management-absence-alert-row" key={`${alert.courseId}|${alert.studentId}`}>
                    <div className="management-absence-alert-info">
                      <strong>{alert.firstName} {alert.lastName}</strong>
                      <span>{course?.subjectName ?? 'Cours'} · {alert.absenceCount} absences</span>
                      <small>Dernière absence : {formatAbsenceDate(alert.lastAbsenceDate)}</small>
                      {alert.parentTelephone ? (
                        <small>Parent / tuteur : {alert.parentTelephone}</small>
                      ) : (
                        <small className="management-absence-alert-missing">Téléphone du parent manquant — complétez la fiche étudiant.</small>
                      )}
                    </div>
                    <div className="management-toolbar">
                      {alert.parentTelephone && <a className="sp-btn sp-btn-ghost" href={`tel:${alert.parentTelephone}`}>Appeler</a>}
                      {whatsappUrl && <a className="sp-btn" href={whatsappUrl} rel="noreferrer" target="_blank">WhatsApp</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {!validDateRange && (
        <Alert tone="error">La date « Du » doit être une date valide et antérieure ou égale à la date « Au ».</Alert>
      )}
      {!loading && planningState.status === 'loaded' && sheet && visibleCourseSheets.length > 0 && (
        <section aria-label="Bilan des présences de la période" className="attendance-status-summary">
          <article className="is-present"><strong>{attendanceTotals.present}</strong><span>Présents</span></article>
          <article className="is-absent"><strong>{attendanceTotals.absent}</strong><span>Absents</span></article>
          <article className="is-late"><strong>{attendanceTotals.late}</strong><span>En retard</span></article>
          <article className="is-unmarked"><strong>{attendanceTotals.unmarked}</strong><span>Non marqués</span></article>
        </section>
      )}
      {loading && (
        <Panel>
          <LoadingState label="Chargement de la feuille de présence…" />
        </Panel>
      )}
      {!loading &&
        planningState.status === 'loaded' &&
        validDateRange &&
        (!sheet || visibleCourseSheets.length === 0 ? (
          <EmptyState
            title={!validDateRange ? 'Période à vérifier.' : selectedGroupId ? 'Aucune séance pour ce groupe sur cette période.' : 'Aucun cours prévu sur cette période.'}
            description={
              !validDateRange
                ? 'Saisissez une période valide avec une date de début antérieure ou égale à la date de fin.'
                : 'Modifiez la période ou le groupe pour consulter les séances.'
            }
          />
        ) : (
          <div className="attendance-group-list">
            {visibleCourseSheets.map((courseSheet) => {
              const occurrence = occurrences.find(
                (item) => String(item.id) === String(courseSheet.courseId) && item.date === courseSheet.date,
              );
              if (!occurrence) return null;
              const present = courseSheet.students.filter(
                (item) => item.status === 'present',
              ).length;
              const group = planningState.data.filters.groups.find(
                (item) => String(item.id) === String(occurrence.groupId),
              );
              return (
                <Panel className="attendance-session-panel" key={`${courseSheet.courseId}|${courseSheet.date}`}>
                  <header className="management-attendance-heading">
                    <div>
                      <p className="attendance-session-date">{formatAbsenceDate(courseSheet.date)}</p>
                      <p className="planning-progress-eyebrow">
                        {group?.formationName ?? 'Formation'} · {group?.name ?? occurrence.groupName ?? 'Groupe non défini'}
                      </p>
                      <h2>{occurrence.subjectName}</h2>
                      <p>
                        {formatCourseTime(occurrence)} · {occurrence.roomName || 'Salle non définie'} · {occurrence.teacherName}
                      </p>
                    </div>
                    <div className="attendance-session-actions">
                      <span className="management-attendance-count">
                        {present} / {courseSheet.students.length} présents
                      </span>
                      {canRecordAttendance && courseSheet.students.length > 0 && (
                        <Button
                          disabled={savingKey !== null}
                          onClick={() => void markCoursePresent(occurrence.id, courseSheet.date, courseSheet.students)}
                          type="button"
                          variant="secondary"
                        >
                          {savingKey === `${occurrence.id}|${courseSheet.date}` ? 'Enregistrement…' : 'Marquer le groupe présent'}
                        </Button>
                      )}
                    </div>
                  </header>
                  {courseSheet.students.length === 0 ? (
                    <p className="management-muted">
                      Aucun étudiant n’est associé à ce groupe. Choisissez les étudiants du groupe
                      ci-dessus pour les ajouter à la feuille de présence.
                    </p>
                  ) : (
                    <div className="management-attendance-list">
                      {courseSheet.students.map(({ student, status }) => (
                        <div className={`attendance-student-row${status ? ` is-${status}` : ''}`} key={student.id}>
                          <div className="attendance-student-name">
                            <span aria-hidden="true" className="management-avatar">{initials(`${student.firstName} ${student.lastName}`)}</span>
                            <span><strong>{student.firstName} {student.lastName}</strong><small>{status ? `Statut : ${status === 'present' ? 'Présent' : status === 'absent' ? 'Absent' : 'En retard'}` : 'Non marqué'}</small></span>
                          </div>
                          {canRecordAttendance ? (
                            <div aria-label={`Présence de ${student.firstName} ${student.lastName}`} className="management-status-actions">
                              {([
                                ['present', 'Présent'],
                                ['absent', 'Absent'],
                                ['retard', 'Retard'],
                              ] as const).map(([value, label]) => {
                                return (
                                  <button
                                    aria-pressed={status === value}
                                    className={`management-status-button attendance-status-button is-${value}${status === value ? ' is-selected' : ''}`}
                                    disabled={savingKey !== null}
                                    key={value}
                                    onClick={() => void updateStatus(occurrence.id, courseSheet.date, student.id, value)}
                                    type="button"
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="attendance-readonly-status">{status ? (status === 'present' ? 'Présent' : status === 'absent' ? 'Absent' : 'En retard') : 'Non marqué'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        ))}
      {rosterEditor && (
        <Modal
          label="Choisir les étudiants du groupe"
          onClose={() => {
            if (rosterEditor.status !== 'loaded' || !rosterEditor.saving) setRosterEditor(null);
          }}
        >
          <Panel className="management-editor">
            <h2 className="management-editor-title">
              Étudiants — {selectedAttendanceGroup?.name ?? 'groupe'}
            </h2>
            <p className="management-muted">
              Les étudiants choisis seront liés au groupe et apparaîtront dans les présences de ses cours.
              Un étudiant déjà affecté à un autre groupe ne peut pas être déplacé depuis cet écran.
            </p>
            {rosterEditor.status === 'loading' && (
              <LoadingState label="Chargement des étudiants disponibles…" />
            )}
            {rosterEditor.status === 'error' && <Alert tone="error">{rosterEditor.message}</Alert>}
            {rosterEditor.status === 'loaded' && (
              <>
                {rosterEditor.students.length === 0 ? (
                  <EmptyState title="Aucun étudiant disponible pour ce groupe." />
                ) : (
                  <div className="management-attendance-list">
                    {rosterEditor.students.map((student) => (
                      <label className="attendance-student-row" key={String(student.id)}>
                        <span className="attendance-student-name">
                          <input
                            checked={rosterEditor.selectedIds.has(String(student.id))}
                            disabled={rosterEditor.saving}
                            onChange={(event) => {
                              const selectedIds = new Set(rosterEditor.selectedIds);
                              if (event.target.checked) selectedIds.add(String(student.id));
                              else selectedIds.delete(String(student.id));
                              setRosterEditor({ ...rosterEditor, selectedIds });
                            }}
                            type="checkbox"
                          />
                          <span>
                            <strong>{student.firstName} {student.lastName}</strong>
                            <small>{student.assigned ? 'Déjà dans ce groupe' : 'Non affecté'}</small>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="management-toolbar">
                  <Button
                    disabled={rosterEditor.saving}
                    onClick={() => void saveRosterEditor()}
                    type="button"
                  >
                    {rosterEditor.saving ? 'Enregistrement…' : 'Enregistrer la sélection'}
                  </Button>
                  <Button
                    disabled={rosterEditor.saving}
                    onClick={() => setRosterEditor(null)}
                    type="button"
                    variant="secondary"
                  >
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </Panel>
        </Modal>
      )}
    </PageFrame>
  );
}
