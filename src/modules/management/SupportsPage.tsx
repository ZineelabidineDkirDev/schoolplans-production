import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, EmptyState, LoadingState, PageHeader, Panel, confirmAction, notify } from '../../components/ui';
import {
  createLinkCourseSupport,
  deleteCourseSupport,
  getCourseSupports,
  getSupportSignedUrl,
  swapCourseSupportOrder,
  updateCourseSupport,
  uploadCourseSupport,
  type CourseSupport,
} from '../../data/repositories/supportRepository';
import { getPlanningData } from '../../data/repositories/planningRepository';
import { getStudentWorkspace } from '../../data/repositories/studentWorkspaceRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { StudentIdentifier } from '../../types/students';
import type { PlanningCourse } from '../../types/planning';
import { useAuth } from '../auth/AuthProvider';

type SupportCourse = { id: StudentIdentifier; label: string };
type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded';
      documents: CourseSupport[];
      courses: SupportCourse[];
      studentFound: boolean;
    };

function fileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(size / 1024))} Ko`;
}

function sortSupports(supports: CourseSupport[]) {
  return [...supports].sort((a, b) =>
    String(a.courseId).localeCompare(String(b.courseId)) ||
    a.sortOrder - b.sortOrder ||
    a.createdAt.localeCompare(b.createdAt),
  );
}

function sessionCourse(course: PlanningCourse): SupportCourse {
  return {
    id: course.id,
    label: `${course.subjectName} · ${course.teacherName}${course.roomName ? ` · ${course.roomName}` : ''}`,
  };
}

export function SupportsPage() {
  const { profile, session } = useAuth();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [resourceType, setResourceType] = useState<'file' | 'link'>('file');
  const [externalUrl, setExternalUrl] = useState('');
  const [editingSupportId, setEditingSupportId] = useState<StudentIdentifier | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeMode, setActiveMode] = useState<'recorded' | 'live'>('recorded');
  const [liveCourse, setLiveCourse] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [liveProvider, setLiveProvider] = useState<'Google Meet' | 'Zoom' | 'Microsoft Teams' | 'Autre'>('Google Meet');
  const [liveUrl, setLiveUrl] = useState('');
  const [liveDate, setLiveDate] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [message, setMessageState] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const setMessage = (value: { tone: 'success' | 'error'; text: string } | null) => {
    setMessageState(value);
    if (value) notify(value.text, value.tone === 'error' ? 'error' : 'success');
  };

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile?.centreId) {
        setState({ status: 'error', message: 'Votre profil n’est pas rattaché à un centre.' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const client = getSupabaseClient();
        if (profile.role === 'etudiant') {
          const workspace = await getStudentWorkspace(
            client,
            profile.centreId,
            session?.user.email ?? '',
          );
          if (!workspace.studentFound) {
            if (active) {
              setState({
                status: 'loaded',
                documents: [],
                courses: [],
                studentFound: false,
              });
            }
            return;
          }
          // Charger uniquement les cours réellement rattachés au centre de l'étudiant.
          // Les ressources sont ensuite filtrées par centre ET par ces cours pour éviter
          // toute fuite si une ligne documents est mal rattachée à un autre centre.
          const { data: centreCourses, error: centreCoursesError } = await client
            .from('cours')
            .select('id,matiere_id')
            .eq('centre_id', profile.centreId);
          if (centreCoursesError) throw centreCoursesError;
          const centreCourseIds = [...new Set(
            (centreCourses ?? [])
              .map((course) => course.id)
              .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number'),
          )];
          const documents = await getCourseSupports(client, profile.centreId, centreCourseIds);
          const moduleIds = [...new Set(
            (centreCourses ?? [])
              .map((course) => course.matiere_id)
              .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number'),
          )];
          const { data: modules, error: modulesError } = moduleIds.length
            ? await client.from('matieres').select('id,nom').in('id', moduleIds)
            : { data: [], error: null };
          if (modulesError) throw modulesError;
          const moduleNames = new Map(
            (modules ?? []).map((module) => [String(module.id), String(module.nom ?? 'Module')]),
          );
          const courses: SupportCourse[] = (centreCourses ?? []).map((course) => ({
            id: course.id as StudentIdentifier,
            label: course.matiere_id == null
              ? 'Module du centre'
              : (moduleNames.get(String(course.matiere_id)) ?? 'Module du centre'),
          }));
          if (active) {
            setState({
              status: 'loaded',
              documents,
              courses,
              studentFound: true,
            });
          }
          return;
        }
        if (!['admin', 'director', 'formateur'].includes(profile.role)) {
          throw new Error('Votre rôle ne permet pas de consulter les supports du centre.');
        }
        const planning = await getPlanningData(client, profile.centreId, profile.id, profile.role);
        // Tous les formateurs peuvent consulter les ressources pédagogiques du centre.
        // Les droits de création, modification et suppression restent réservés aux formateurs
        // et les règles Supabase doivent protéger ces actions côté serveur.
        // La bibliothèque visible est limitée aux cours rattachés à ce centre.
        const { data: centreCourses, error: centreCoursesError } = await client
          .from('cours')
          .select('id')
          .eq('centre_id', profile.centreId);
        if (centreCoursesError) throw centreCoursesError;
        const centreCourseIds = [...new Set(
          (centreCourses ?? [])
            .map((course) => course.id)
            .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number'),
        )];
        const documents = await getCourseSupports(client, profile.centreId, centreCourseIds);
        if (active) {
          setState({
            status: 'loaded',
            documents,
            courses: planning.courses.map(sessionCourse),
            studentFound: true,
          });
        }
      } catch (cause) {
        if (active) {
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Impossible de charger les supports.',
          });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [profile?.centreId, profile?.id, profile?.role, session?.user.email, reload]);

  function resetEditor() {
    setEditingSupportId(null);
    setSelectedCourse('');
    setTitle('');
    setDescription('');
    setFile(null);
    setResourceType('file');
    setExternalUrl('');
    const fileInput = document.getElementById('support-file') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }

  function editSupport(support: CourseSupport) {
    setEditingSupportId(support.id);
    setSelectedCourse(String(support.courseId));
    setTitle(support.title);
    setDescription(support.description ?? '');
    setResourceType(support.resourceType);
    setExternalUrl(support.externalUrl ?? '');
    setFile(null);
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'loaded' || !profile?.centreId) return;
    if (!selectedCourse || !title.trim()) {
      setMessage({ tone: 'error', text: 'Sélectionnez un cours et saisissez un titre.' });
      return;
    }
    if (!editingSupportId && resourceType === 'file' && !file) {
      setMessage({ tone: 'error', text: 'Choisissez un fichier à importer.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const client = getSupabaseClient();
      const ownCourseIds = state.courses.map((course) => course.id);

      if (editingSupportId) {
        const existing = state.documents.find((item) => String(item.id) === String(editingSupportId));
        if (!existing) throw new Error('Le support à modifier est introuvable.');
        const updated = await updateCourseSupport(client, profile.centreId, existing, ownCourseIds, {
          title,
          description,
          url: externalUrl,
        });
        setState({
          ...state,
          documents: sortSupports(state.documents.map((item) =>
            String(item.id) === String(updated.id) ? updated : item,
          )),
        });
        resetEditor();
        setMessage({ tone: 'success', text: 'Support modifié.' });
        return;
      }

      const support = resourceType === 'link'
        ? await createLinkCourseSupport(client, {
            centreId: profile.centreId,
            courseId: selectedCourse,
            title,
            description,
            url: externalUrl,
          })
        : await uploadCourseSupport(client, {
            centreId: profile.centreId,
            courseId: selectedCourse,
            title,
            description,
            file: file as File,
          });
      setState({ ...state, documents: sortSupports([support, ...state.documents]) });
      resetEditor();
      setMessage({
        tone: 'success',
        text: resourceType === 'link'
          ? 'Lien ajouté. Les étudiants de votre centre peuvent le consulter.'
          : 'Fichier importé. Les étudiants de votre centre peuvent le consulter et le télécharger.',
      });
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Impossible d’enregistrer la ressource.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitLiveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'loaded' || !profile?.centreId) return;
    if (!liveCourse || !liveTitle.trim() || !liveUrl.trim() || !liveDate || !liveTime) {
      setMessage({ tone: 'error', text: 'Complétez le cours, le titre, le lien, la date et l’heure de la séance.' });
      return;
    }
    try {
      const parsedUrl = new URL(liveUrl);
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error('Le lien de réunion doit commencer par https:// ou http://.');
      setBusy(true);
      setMessage(null);
      const support = await createLinkCourseSupport(getSupabaseClient(), {
        centreId: profile.centreId,
        courseId: liveCourse,
        title: `🔴 LIVE — ${liveTitle.trim()}`,
        description: `Séance en direct via ${liveProvider} · ${new Date(`${liveDate}T${liveTime}`).toLocaleString('fr-FR')}`,
        url: parsedUrl.toString(),
      });
      setState({ ...state, documents: sortSupports([support, ...state.documents]) });
      setLiveTitle('');
      setLiveUrl('');
      setLiveDate('');
      setLiveTime('');
      setMessage({ tone: 'success', text: 'Séance LIVE publiée. Les étudiants de votre centre peuvent ouvrir le lien depuis Cours en ligne.' });
    } catch (cause) {
      setMessage({ tone: 'error', text: cause instanceof Error ? cause.message : 'Impossible de publier la séance LIVE.' });
    } finally {
      setBusy(false);
    }
  }

  async function openSupport(support: CourseSupport, download: boolean) {
    setMessage(null);
    try {
      if (support.resourceType === 'link') {
        if (!support.externalUrl) throw new Error('Le lien de cette ressource est manquant.');
        const link = document.createElement('a');
        link.href = support.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.append(link);
        link.click();
        link.remove();
        return;
      }
      const url = await getSupportSignedUrl(getSupabaseClient(), support, download);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (download) link.download = support.fileName;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Impossible d’ouvrir ce support.',
      });
    }
  }

  async function moveSupport(support: CourseSupport, direction: -1 | 1) {
    if (!profile?.centreId || profile.role !== 'formateur' || state.status !== 'loaded') return;
    const courseSupports = state.documents
      .filter((item) => String(item.courseId) === String(support.courseId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    const index = courseSupports.findIndex((item) => String(item.id) === String(support.id));
    const neighbor = courseSupports[index + direction];
    if (!neighbor) return;

    setBusy(true);
    setMessage(null);
    try {
      await swapCourseSupportOrder(
        getSupabaseClient(),
        profile.centreId,
        support,
        neighbor,
        state.courses.map((course) => course.id),
      );
      const updated = state.documents.map((item) => {
        if (String(item.id) === String(support.id)) return { ...item, sortOrder: neighbor.sortOrder };
        if (String(item.id) === String(neighbor.id)) return { ...item, sortOrder: support.sortOrder };
        return item;
      });
      setState({ ...state, documents: sortSupports(updated) });
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Impossible de réorganiser les supports.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeSupport(support: CourseSupport) {
    if (!profile?.centreId || profile.role !== 'formateur' || state.status !== 'loaded') return;
    if (!await confirmAction('Supprimer ce document ?')) return;
    const ownCourseIds = state.courses.map((course) => course.id);
    setMessage(null);
    try {
      await deleteCourseSupport(getSupabaseClient(), profile.centreId, support, ownCourseIds);
      setState({
        ...state,
        documents: state.documents.filter((item) => String(item.id) !== String(support.id)),
      });
      setMessage({ tone: 'success', text: 'Le support a été supprimé.' });
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Impossible de supprimer ce support.',
      });
    }
  }

  const displayedDocuments = state.status === 'loaded'
    ? state.documents.filter((item) => activeMode === 'live'
      ? item.title.startsWith('🔴 LIVE — ')
      : !item.title.startsWith('🔴 LIVE — '))
    : [];

  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        description="Consultez les fichiers pédagogiques et les liens vidéo associés aux cours de votre centre."
        eyebrow="Espace pédagogique"
        title="Cours en ligne"
      />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {state.status === 'loaded' && state.studentFound && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveMode('recorded')}
            aria-pressed={activeMode === 'recorded'}
            className={`group rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeMode === 'recorded' ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300'}`}
          >
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition-transform group-hover:scale-105">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none"/></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-slate-900">Mettre un cours en ligne</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">Publier des vidéos MP4, PDF, documents et ressources à consulter à tout moment.</span>
                <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Cours enregistrés <span aria-hidden="true">→</span></span>
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('live')}
            aria-pressed={activeMode === 'live'}
            className={`group rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${activeMode === 'live' ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
          >
            <div className="flex items-start gap-4">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition-transform group-hover:scale-105">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="12" r="2"/></svg>
                <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">LIVE</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-slate-900">Séance en ligne LIVE</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">Programmer une séance et partager un lien Google Meet, Zoom ou Microsoft Teams.</span>
                <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">Préparer une séance <span aria-hidden="true">→</span></span>
              </span>
            </div>
          </button>
        </div>
      )}
      {state.status === 'loading' && (
        <Panel>
          <LoadingState label="Chargement des supports…" />
        </Panel>
      )}
      {state.status === 'error' && (
        <Panel className="space-y-3">
          <EmptyState description={state.message} title="Les supports ne sont pas disponibles." />
          <Button onClick={() => setReload((value) => value + 1)} type="button" variant="secondary">
            Réessayer
          </Button>
        </Panel>
      )}
      {state.status === 'loaded' && !state.studentFound && (
        <Alert tone="warning">
          Votre compte n’est pas relié à un dossier étudiant de ce centre. Demandez à
          l’administration de vérifier l’adresse e-mail associée à votre dossier.
        </Alert>
      )}
      {state.status === 'loaded' && activeMode === 'live' && profile?.role === 'formateur' && (
        <Panel>
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <div><h2 className="management-panel-title">Programmer une séance LIVE</h2><p className="sp-muted">Collez le lien créé dans Google Meet, Zoom ou Teams. La séance sera partagée avec les étudiants de votre centre.</p></div>
          </div>
          {state.courses.length === 0 ? (
            <EmptyState description="Affectez-vous d’abord à un cours dans le planning." title="Aucun cours disponible." />
          ) : (
            <form className="management-editor-form" onSubmit={(event) => void submitLiveSession(event)}>
              <label className="sp-form-field">Cours / module<select className="sp-field" value={liveCourse} onChange={(event) => setLiveCourse(event.target.value)} required><option value="">Sélectionner un cours</option>{state.courses.map((course) => <option key={String(course.id)} value={String(course.id)}>{course.label}</option>)}</select></label>
              <label className="sp-form-field">Titre de la séance<input className="sp-field" value={liveTitle} onChange={(event) => setLiveTitle(event.target.value)} maxLength={150} placeholder="Ex. Révision SQL — chapitre 3" required /></label>
              <label className="sp-form-field">Plateforme<select className="sp-field" value={liveProvider} onChange={(event) => setLiveProvider(event.target.value as typeof liveProvider)}><option>Google Meet</option><option>Zoom</option><option>Microsoft Teams</option><option>Autre</option></select></label>
              <label className="sp-form-field">Lien de réunion<input className="sp-field" type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://meet.google.com/..." required /></label>
              <label className="sp-form-field">Date<input className="sp-field" type="date" value={liveDate} onChange={(event) => setLiveDate(event.target.value)} required /></label>
              <label className="sp-form-field">Heure de début<input className="sp-field" type="time" value={liveTime} onChange={(event) => setLiveTime(event.target.value)} required /></label>
              <div className="management-editor-actions management-editor-wide"><Button disabled={busy} type="submit">{busy ? 'Publication…' : 'Publier la séance LIVE'}</Button></div>
            </form>
          )}
        </Panel>
      )}
      {state.status === 'loaded' && activeMode === 'recorded' && profile?.role === 'formateur' && (
        <Panel>
          <h2 className="management-panel-title">{editingSupportId ? 'Modifier un support' : 'Partager une ressource'}</h2>
          {state.courses.length === 0 ? (
            <EmptyState
              description="Affectez-vous d’abord à un cours dans le planning."
              title="Aucun cours disponible."
            />
          ) : (
            <form className="management-editor-form" onSubmit={(event) => void submit(event)}>
              <label className="sp-form-field">
                Cours
                <select
                  className="sp-field"
                  onChange={(event) => setSelectedCourse(event.target.value)}
                  required
                  disabled={Boolean(editingSupportId)}
                  value={selectedCourse}
                >
                  <option value="">Sélectionner un cours</option>
                  {state.courses.map((course) => (
                    <option key={String(course.id)} value={String(course.id)}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>
              {!editingSupportId && (
                <label className="sp-form-field">
                  Type de ressource
                  <select
                    className="sp-field"
                    value={resourceType}
                    onChange={(event) => {
                      setResourceType(event.target.value as 'file' | 'link');
                      setFile(null);
                      setExternalUrl('');
                    }}
                  >
                    <option value="file">Fichier pédagogique</option>
                    <option value="link">Lien vidéo ou ressource en ligne</option>
                  </select>
                </label>
              )}
              <label className="sp-form-field">
                Titre
                <input
                  className="sp-field"
                  maxLength={150}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
                />
              </label>
              <label className="sp-form-field management-editor-wide">
                Description
                <textarea
                  className="sp-field management-textarea"
                  maxLength={1000}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  value={description}
                />
              </label>
              {resourceType === 'link' ? (
                <label className="sp-form-field management-editor-wide">
                  Adresse du lien (YouTube, vidéo, site pédagogique…)
                  <input
                    className="sp-field"
                    type="url"
                    placeholder="https://…"
                    required
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                  />
                </label>
              ) : editingSupportId ? (
                <p className="sp-muted management-editor-wide">
                  Le fichier existant sera conservé. Pour le remplacer, supprimez ce support puis importez le nouveau fichier.
                </p>
              ) : (
                <label className="sp-form-field management-editor-wide">
                  Fichier ou vidéo MP4 (20 Mo maximum)
                  <input
                    accept="video/mp4,.mp4,application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                    className="sp-field"
                    id="support-file"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    required
                    type="file"
                  />
                </label>
              )}
              <div className="management-editor-actions management-editor-wide">
                {editingSupportId && (
                  <Button disabled={busy} onClick={resetEditor} type="button" variant="secondary">
                    Annuler
                  </Button>
                )}
                <Button disabled={busy} type="submit">
                  {busy ? 'Enregistrement…' : editingSupportId ? 'Enregistrer les modifications' : resourceType === 'link' ? 'Ajouter le lien' : 'Importer le support'}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      )}
      {state.status === 'loaded' && state.studentFound && (
        <Panel className="!p-0">
          {displayedDocuments.length === 0 ? (
            <EmptyState
              description={activeMode === 'live'
                ? 'Les séances LIVE publiées par les formateurs de votre centre apparaîtront ici.'
                : 'Les vidéos et ressources partagées par les formateurs de votre centre apparaîtront ici.'}
              title={activeMode === 'live' ? 'Aucune séance LIVE disponible.' : 'Aucun cours enregistré disponible.'}
            />
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Cours</th>
                    <th>Fichier / lien</th>
                    <th>Ajouté le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDocuments.map((support) => {
                    const course = state.courses.find(
                      (item) => String(item.id) === String(support.courseId),
                    );
                    const sameCourse = state.documents
                      .filter((item) => String(item.courseId) === String(support.courseId))
                      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
                    const position = sameCourse.findIndex((item) => String(item.id) === String(support.id));
                    return (
                      <tr key={String(support.id)}>
                        <td>
                          <strong>{support.title}</strong>
                          {support.description && <p className="sp-muted">{support.description}</p>}
                          <small>{support.resourceType === 'link' ? 'Lien externe' : 'Fichier pédagogique'}</small>
                        </td>
                        <td>{course?.label ?? 'Cours associé'}</td>
                        <td>
                          {support.resourceType === 'link' ? (
                            <a href={support.externalUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                              {support.externalUrl}
                            </a>
                          ) : (
                            <>
                              {support.fileName}
                              <br />
                              <small>{fileSize(support.size)}</small>
                            </>
                          )}
                        </td>
                        <td>{new Date(support.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void openSupport(support, false)}
                              type="button"
                              variant="secondary"
                            >
                              {support.resourceType === 'link' ? 'Ouvrir le lien' : 'Voir'}
                            </Button>
                            {support.resourceType === 'file' && (
                              <Button
                                onClick={() => void openSupport(support, true)}
                                type="button"
                                variant="secondary"
                              >
                                Télécharger
                              </Button>
                            )}
                            {profile?.role === 'formateur' && (
                              <>
                                <Button
                                  disabled={busy}
                                  onClick={() => editSupport(support)}
                                  type="button"
                                  variant="secondary"
                                >
                                  Modifier
                                </Button>
                                <Button
                                  disabled={busy || position <= 0}
                                  onClick={() => void moveSupport(support, -1)}
                                  type="button"
                                  variant="secondary"
                                >
                                  ↑
                                </Button>
                                <Button
                                  disabled={busy || position >= sameCourse.length - 1}
                                  onClick={() => void moveSupport(support, 1)}
                                  type="button"
                                  variant="secondary"
                                >
                                  ↓
                                </Button>
                                <Button
                                  disabled={busy}
                                  onClick={() => void removeSupport(support)}
                                  type="button"
                                  variant="danger"
                                >
                                  Supprimer
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}
