# Data model observed in frontend

This is a list of client-used names and fields, not a verified PostgreSQL schema. The repository contains no applied migrations or RLS definitions; physical types, constraints, foreign keys and policies are **À vérifier dans Supabase**. See `docs/SCHEMA_SUPABASE.md` for the table/field detail.

## Entities and relationships inferred from queries

- Centre (`centres`) owns/filters profiles, formations, groups, teachers, rooms, courses, students, registrations, closures, presence, documents, certificates and requests by `centre_id`.
- Profile (`profiles`) is tied to Supabase Auth user ID and carries role, full name, status and centre ID.
- Formation (`formations`) has duration, hours per week/total, status and centre; groups point to a formation and optionally a teacher.
- Domain and module (`domaines`, `matieres`) connect through `domaine_id`; centre catalog and formation-module associations use `centre_matieres` and `formation_matieres`.
- Teacher profile (`formateurs`) links to a profile and teacher-module association via `formateur_matieres`.
- Course (`cours`) carries module, teacher, room, group, weekday/time and effective-date fields.
- Cancellation and completed-session records are keyed by course/date in client behavior; closure records are keyed by date and centre in the upsert.
- Student (`etudiants`) belongs to a centre and may have a group; course enrollment (`inscriptions`) joins students/courses; attendance (`presences`) adds date/status.
- Course document metadata (`documents`) points to a course and Storage path. Certificates point to students; connection history points to a user; requests point to an Auth user/centre.

These are application-level joins inferred from fields and query filters. Database cardinality/constraints are not verified.

## Transaction evidence

No explicit multi-statement transaction boundary is visible in the client. Some single operations use PostgREST `upsert`; course save and related enrollment writes happen as separate calls. Whether RPCs provide transactions and how failures roll back are **À vérifier dans Supabase**.
