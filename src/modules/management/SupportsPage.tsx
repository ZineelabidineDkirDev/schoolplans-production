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
          // L'étudiant consulte toutes les ressources de son centre, pas uniquement
          // celles des cours auxquels il est individuellement inscrit.
          // getCourseSupports filtre explicitement sur profile.centreId.
          const documents = await getCourseSupports(client, profile.centreId);
          const courseById = new Map(
            workspace.courses.map((course) => [String(course.id), course]),
          );
          if (active) {
            setState({
              status: 'loaded',
              documents,
              courses: [...courseById.values()].map((course) => ({
                id: course.id,
                label: course.subject,
              })),
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
        const documents = await getCourseSupports(client, profile.centreId);
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

  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5">
      <PageHeader
        description="Consultez les fichiers pédagogiques et les liens vidéo associés aux cours de votre centre."
        eyebrow="Espace pédagogique"
        title="Cours en ligne"
      />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
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
      {state.status === 'loaded' && profile?.role === 'formateur' && (
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
          {state.documents.length === 0 ? (
            <EmptyState
              description="Les vidéos et ressources partagées par les formateurs de votre centre apparaîtront ici."
              title="Aucun support disponible."
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
                  {state.documents.map((support) => {
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
