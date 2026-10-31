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
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<StudentsPageState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      setState({ status: 'loading' });

      try {
        const students = await getMyCentreStudents(getSupabaseClient(), profile?.centreId ?? '');
        if (active) setState({ status: 'loaded', students });
      } catch (error) {
        if (active) setState({ status: 'error', message: describeError(error) });
      }
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [profile?.centreId, reloadKey]);

  return (
    <section
      aria-labelledby="my-students-title"
      className="mx-auto w-full max-w-screen-2xl space-y-5"
    >
      <PageHeader
        description="Étudiants enregistrés dans votre centre et cours auxquels ils sont inscrits."
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
            description="Les étudiants inscrits apparaîtront ici."
            title="Aucun étudiant enregistré dans votre centre."
          />
        ) : (
          <>
            <div className="management-toolbar">
              <label className="sp-form-field">
                Rechercher dans mes étudiants
                <input className="sp-field" type="search" placeholder="Nom, prénom, e-mail, téléphone ou cours" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <span className="management-result-count">
                {state.students.filter(({ student, courses }) => [student.lastName, student.firstName, student.email, student.telephone, ...courses].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))).length} / {state.students.length} étudiants
              </span>
            </div>
            <Panel className="!p-0">
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Nom
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Prénom
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      E-mail
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Téléphone
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Mes cours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.students.filter(({ student, courses }) => [student.lastName, student.firstName, student.email, student.telephone, ...courses].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))).map(({ student, courses }) => (
                    <tr
                      className="border-b border-line last:border-0 hover:bg-slate-50/70"
                      key={String(student.id)}
                    >
                      <td data-label="Nom">
                        <strong>{student.lastName}</strong>
                      </td>
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
                      <td data-label="Mes cours">
                        <div className="flex flex-wrap gap-1.5">
                          {courses.map((course, index) => (
                            <span className="sp-course-chip" key={`${course}-${index}`}>
                              {course}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Panel>
            {state.students.filter(({ student, courses }) => [student.lastName, student.firstName, student.email, student.telephone, ...courses].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))).length === 0 && (
              <EmptyState title="Aucun étudiant ne correspond à cette recherche." />
            )}
          </>
        ))}
    </section>
  );
}
