# Existing project structure

## Project type

Browser-based training-centre management SPA served as one HTML document. The reference keeps landing page, login, pending registration, member dashboard and all member views in one DOM. Tabs are changed by JavaScript selectors; no URL router is present.

## Functional domains visible in the reference

Authentication and profile; centre selection and rights; formations, groups, modules/domains, teachers, classrooms, students and registrations; courses and weekly planning; cancellations, closures and realized sessions; attendance; course documents; certificates; dashboard/statistics; connection history; centre administration and director access.

## Existing files and layers

- `legacy/vntest.html`: supplied functional reference.
- `index.html`, `css/app.css`, `js/app.js`: existing split HTML/CSS/JavaScript runtime.
- `js/services/*.js`: prepared data-service files; comments state that they are not automatically wired in v1.
- `backend/supabase/rpc/get_my_centre_students.sql`: proposed SQL only; repository README says no migrations have been applied.
- `docs/MIGRATION-PLAN.md`: earlier structural migration plan.

The legacy HTML uses direct DOM manipulation and a global Supabase client. Business logic, view rendering and persistence calls are interleaved. The React bootstrap uses `react-app.html` and root `src/` without replacing the existing `index.html`.
