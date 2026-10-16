# Existing technology stack

- HTML5, CSS, vanilla JavaScript in `legacy/vntest.html`; no framework or build system is used by that file.
- Supabase JavaScript UMD client 2.45.4 from jsDelivr; Supabase project URL and public client key are hard-coded in the legacy script. Do not reproduce those literals in the React frontend; use `.env` variables.
- jsPDF UMD 2.5.1 from jsDelivr for local PDF certificate generation.
- Manrope web font loaded from Google Fonts.
- Supabase Auth, PostgREST queries, RPC, Edge Functions and Storage are called from the browser.
- Current workspace has prepared JavaScript service modules but no root package manifest or test/build/lint setup at initial inspection.
- Runtime/browser version requirements are not specified in the reference. Backend, RLS, server-side function versions and schema are **À vérifier dans Supabase**.

The new React bootstrap adds Vite, React, TypeScript, React Router, `@supabase/supabase-js`, Vitest, ESLint and Prettier. This is target scaffolding, not a claim about the existing reference runtime.
