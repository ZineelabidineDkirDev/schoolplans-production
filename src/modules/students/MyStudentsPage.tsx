import { useEffect, useState } from 'react';
import { Alert, Button, EmptyState, LoadingState, PageHeader, Panel } from '../../components/ui';
import { getMyCentreStudents } from '../../data/repositories/studentRepository';
import { getSupabaseClient } from '../../data/supabase/client';
import type { MyStudentListItem } from '../../types/students';
import { useAuth } from '../auth/AuthProvider';

type StudentsPageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; students: MyStudentListItem[] };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function MyStudentsPage() {
  const { profile } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<StudentsPageState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      setState({ status: 'loading' });

      try {
        if (!profile?.id) throw new Error('Votre profil formateur ne peut pas être vérifié.');
        const students = await getMyCentreStudents(
          getSupabaseClient(),
          profile.centreId ?? '',
          profile.id,
        );
        if (active) setState({ status: 'loaded', students });
      } catch (error) {
        if (active) setState({ status: 'error', message: describeError(error) });
      }
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [profile?.centreId, profile?.id, reloadKey]);

  const groupOptions = state.status === 'loaded'
    ? [...new Map(
        state.students
          .flatMap(({ groups }) => groups)
          .map((group) => [String(group.id), group]),
      ).values()].sort((left, right) => left.name.localeCompare(right.name, 'fr'))
    : [];
  const visibleStudents = state.status === 'loaded'
    ? state.students.filter(({ groups }) =>
        !selectedGroupId || groups.some((group) => String(group.id) === selectedGroupId),
      )
    : [];

  return (
    <section
      aria-labelledby="my-students-title"
      className="mx-auto w-full max-w-screen-2xl space-y-5"
    >
      <PageHeader
        description="Étudiants inscrits dans vos groupes de formation ou à vos cours."
        eyebrow="Espace formateur"
        title="Mes étudiants"
      />

      {state.status === 'loading' && (
        <Panel>
          <LoadingState label="Chargement des étudiants…" />
        </Panel>
      )}

      {state.status === 'error' && (
        <Alert className="space-y-2" tone="error">
          <p>
            La liste des étudiants ne peut pas être chargée tant que cette erreur n’est pas
            corrigée.
          </p>
          <p>{state.message}</p>
          <Button onClick={() => setReloadKey((key) => key + 1)} type="button" variant="secondary">
            Réessayer
          </Button>
        </Alert>
      )}

      {state.status === 'loaded' &&
        (state.students.length === 0 ? (
          <EmptyState
            description="Les étudiants de vos groupes ou inscrits à vos cours apparaîtront ici."
            title="Aucun étudiant dans vos groupes ou cours."
          />
        ) : (
          <>
            <label className="sp-form-field max-w-md">
              Groupe de formation
              <select
                className="sp-field"
                onChange={(event) => setSelectedGroupId(event.target.value)}
                value={selectedGroupId}
              >
                <option value="">Tous mes groupes et cours</option>
                {groupOptions.map((group) => (
                  <option key={String(group.id)} value={String(group.id)}>
                    {group.name}{group.formationName ? ` · ${group.formationName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {visibleStudents.length === 0 ? (
            <EmptyState
              description="Choisissez un autre groupe ou vérifiez les affectations."
              title="Aucun étudiant dans ce groupe."
            />
            ) : (
            <Panel className="!p-0">
              <div className="sp-table-wrap">
                <table className="sp-table">
                  <thead>
                    <tr className="border-b border-line bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                      <th className="px-4 py-3 font-semibold" scope="col">Nom</th>
                      <th className="px-4 py-3 font-semibold" scope="col">Prénom</th>
                      <th className="px-4 py-3 font-semibold" scope="col">E-mail</th>
                      <th className="px-4 py-3 font-semibold" scope="col">Téléphone</th>
                      <th className="px-4 py-3 font-semibold" scope="col">Groupe / formation</th>
                      <th className="px-4 py-3 font-semibold" scope="col">Mes cours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map(({ student, courses, groups }) => (
                      <tr
                        className="border-b border-line last:border-0 hover:bg-slate-50/70"
                        key={String(student.id)}
                      >
                        <td data-label="Nom"><strong>{student.lastName}</strong></td>
                        <td data-label="Prénom">{student.firstName}</td>
                        <td data-label="E-mail">
                        {student.email && (
                          <a
                            className="text-brand-900 underline-offset-4 hover:underline"
                            href={`mailto:${student.email}`}
                          >
                            {student.email}
                          </a>
                        )}
                        </td>
                        <td data-label="Téléphone">
                        {student.telephone && (
                          <a
                            className="text-brand-900 underline-offset-4 hover:underline"
                            href={`tel:${student.telephone}`}
                          >
                            {student.telephone}
                          </a>
                        )}
                        </td>
                        <td data-label="Groupe / formation">
                        <div className="flex flex-wrap gap-1.5">
                          {groups.length ? groups.map((group) => (
                            <span className="sp-course-chip" key={String(group.id)}>
                              {group.name}{group.formationName ? ` · ${group.formationName}` : ''}
                            </span>
                          )) : '—'}
                        </div>
                        </td>
                        <td data-label="Mes cours">
                        <div className="flex flex-wrap gap-1.5">
                          {courses.length ? courses.map((course, index) => (
                            <span className="sp-course-chip" key={`${course}-${index}`}>
                              {course}
                            </span>
                          )) : '—'}
                        </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            )}
          </>
        ))}
    </section>
  );
}
