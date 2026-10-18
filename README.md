# Cromiqa — Tu bici, en buenas manos.

Functional prototype of **Cromiqa**, a marketplace that connects bicycle owners with independent
mechanics in the southeast of Madrid (Madrid, Rivas-Vaciamadrid, Arganda del Rey, Coslada and
surroundings).

> **Entorno de demostración.** Every mechanic, user, review, price and "verified" state is fictional.
> No payments, bookings or emails are real. Data lives only in your browser (LocalStorage).

- Live (GitHub Pages): https://jorgebodas.github.io/Cromiqa/
- Canonical domain (once DNS is configured): https://cromiqa.com

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + unit tests + production build
npm run build && npm run test:e2e   # Playwright, desktop + mobile (serves dist on :4173)
```

Node 20+ (CI uses 22). For e2e tests on a fresh machine: `npx playwright install chromium`.

## What you can do

| Area | Screens |
| --- | --- |
| Owner | Inicio (“¿Qué necesita tu bici?”), Encontrar mecánico (filters + sort), Perfil de mecánico, Solicitud en 4 pasos + confirmación, Mis solicitudes (+ detalle, aceptar/rechazar propuesta, cancelar, mensajes, valoración), Mi garaje (alta/edición/baja, foto, historial), Mi cuenta |
| Mechanic | Panel principal, Solicitudes (aceptar para valorar, proponer precio y cita, rechazar, en curso, completar), Servicios y precios, Disponibilidad, Mi perfil (cambios visibles al instante en el perfil público) |
| Demo | `#/demo`: cambiar de cuenta, guía de escenarios A–E, todas las solicitudes, *Restaurar escenarios* y *Reset demo* |

### Request lifecycle

`Solicitud enviada → Esperando propuesta → Propuesta recibida → Confirmada → En curso → Completada`
(+ `Cancelada` from the owner or the mechanic). A rejected proposal returns the request to
*Esperando propuesta* so the mechanic can send another. Completing a job on a garage bike adds a
maintenance record to that bike. Nothing is called a booking until the owner accepts a proposal.

## Demo accounts

Switch from the dark **Entorno de demostración** bar (top of every page), from *Mi cuenta*, or from
`#/demo`. Switching is instant; there are no passwords. Guests can browse everything and choose a
demo owner account at the last step of a request (where a real product would ask for sign-up).

| Account | Role | Notes |
| --- | --- | --- |
| Ana López | Owner · Rivas | MTB *La de monte* + urban bike, maintenance history |
| Pablo Serrano | Owner · Vallecas | Road + Brompton, has a pending inspection proposal |
| Irene Martín | Owner · Coslada | Two e-bikes, proposal waiting, job in progress |
| Diego Ruiz | Owner · Arganda | Gravel + second-hand MTB (inspected before buying) |
| Carlos Ortega | Mechanic · Rivas | MTB, transmission, suspension; home + workshop |
| Marta Ibáñez | Mechanic · Moratalaz | Road, wheels, bike fitting |
| Lucía Ferrer | Mechanic · Coslada | E-bikes and urban |
| Javier Molina | Mechanic · Arganda | Home service only (mobile workshop) |
| Andrés Vidal | Mechanic · Vallecas | Workshop only; urban, folding, restoration |
| Nerea Campos | Mechanic · San Fernando | Suspension specialist, pre-purchase inspections |

Seed: 6 mechanics, 4 owners, 8 bikes, 12 requests covering every status, 15 reviews, 6 maintenance
records. Dates are generated relative to the reset moment so the demo always looks current.

## Test scenarios (all automated in `tests/e2e/scenarios.spec.ts`)

- **A — Reparación:** Inicio → *Reparación* → “los cambios saltan…” → MTB → A domicilio en Rivas →
  Carlos → enviar → visible en *Mis solicitudes*.
- **B — Respuesta:** cambiar a Carlos → abrir la solicitud → *Aceptar para valorar* → precio y cita →
  volver a Ana → *Aceptar propuesta* → *Confirmada*.
- **C — Completar:** Carlos → *Marcar en curso* → *Marcar como completado* → Ana ve *Completada* y el
  registro en *Mi garaje*.
- **D — Buscar:** buscar “suspensión” → filtro *Domicilio* → perfil → *Solicitar servicio*.
- **E — Inspección:** *Inspección antes de comprar* → datos de la bici usada → mecánico que inspecciona →
  enviar → revisar estado.

Shortcut buttons (“Ver como Carlos”, “Ver como Ana”) on request pages jump to the other side of the
same request.

## Architecture

```
src/
  domain/            types.ts (backend-agnostic model), catalog.ts (labels, zones, statuses),
                     logic/ (pure business rules: request lifecycle, search, garage/profile) + tests
  data/seed.ts       fictional demo dataset
  services/          backend.ts  ← CromiqaBackend interface (the only data contract the UI uses)
                     localBackend.ts (LocalStorage implementation), storage.ts, index.ts (wiring)
  state/             store.ts (Zustand: db mirror, session, request draft, toasts), selectors.ts
  components/ui      accessible primitives (Button, Field, ChoiceCard, Dialog, Toaster, TabBar…)
  components/layout  AppShell (demo bar, header, mobile tab bar), AccountSwitcher, RoleGate
  components/domain  MechanicCard, RequestCard, Status, RequestParts
  pages/             owner/, owner/request/, owner/garage/, mechanic/, demo/
  brand/             provisional wordmark (independent of the UI; static SVGs in public/brand)
  styles/            Tailwind v4 theme tokens (index.css) + tokens.ts
```

- **Replacing LocalStorage:** implement `CromiqaBackend` (e.g. with Supabase) and swap the single line in
  `src/services/index.ts`. All rules live in `domain/logic` as pure functions, so they can be reused
  server-side (or ported to SQL policies / edge functions). Pages never touch storage directly.
- **Routing:** `HashRouter` (`/#/mecanicos/m-carlos`) so deep links and refreshes work on GitHub Pages
  with no server rewrites, under both the repo sub-path and the custom domain. Vite `base: './'`.
- **Stack:** React 18, TypeScript (strict), Vite 6, Tailwind CSS 4, React Router 6, Zustand 5,
  Lucide icons, self-hosted Manrope + Inter (Fontsource). Vitest + Playwright.

## Design

*Precision Garage*: white/sand surfaces, ink text, technical lime `#C7FF2F` reserved for the primary
action and selected states. Manrope for headings, Inter for UI. Mobile-first with a bottom tab bar;
visible focus rings, labelled controls, keyboard-accessible dialogs, reduced-motion support.

## Private preview gate

Production builds show a public **coming-soon page** (logo, tagline, short description). The
prototype opens from a hidden entrance (`src/access/`):

- an invisible hotspot in the **top-right corner**, or
- the secret link **`/#/entrar`** (handy as a phone bookmark).

Both open a password dialog. Only a salted SHA-256 hash is in the code, never the password; input is
trimmed and lowercased (phone keyboards), and hashing has a pure-JS fallback so it also works on plain
http before the HTTPS certificate exists. *Recordar este dispositivo* keeps the device unlocked;
*Panel demo → Bloquear este dispositivo* locks it again.

- **Change the password:** set `DEFAULT_HASH` in `AccessGate.tsx` to `sha256("cromiqa-gate-v1:" + password)`
  (lowercase password), or build with `VITE_ACCESS_HASH`. Every device is locked again automatically.
- **Disable the gate:** build with `VITE_ACCESS_GATE=off`. It is always off in `npm run dev`.
- **Limits:** this is a curtain, not security. The site is static and the repo is public, so the
  code (and fictional demo data) can be read by anyone technical or on GitHub. For real access
  control, put the domain behind an identity proxy such as Cloudflare Access (free tier: email
  one-time codes) and/or make the repo private (GitHub Pages on private repos needs a paid plan).

## Marketing page

- **Layout** (`src/marketing/ComingSoonPage.tsx`): animated app icon, centred wordmark and tagline,
  a swipeable auto-advancing benefits carousel (`BenefitsCarousel.tsx`, pauses on interaction and with
  reduced motion) and a floating dock (`LeadDock.tsx`) with two one-line CTAs, *Avísame* and
  *Soy mecánico*. Choosing one grows the dock upwards with a springy expansion and staggered fields;
  success draws the brand check with a small burst.
- **Photos:** any image in `src/assets/mechanics/` is interleaved with the benefit cards; the file name
  (minus the leading number) becomes the alt text. Keep them ~528×422 JPEG (≈25 KB each).
- **Staging:** `npm run staging` builds a private preview with simulated form submissions, published as a
  private claude.ai Artifact for review before pushing to `main` (which deploys to cromiqa.com).
- **Lead forms** (`src/marketing/LeadForms.tsx`): waitlist (email + zone) and mechanics. Submissions go to FormSubmit's AJAX API and arrive by email. They are
  **hidden until `DEFAULT_LEAD_EMAIL` in `src/marketing/leads.ts` is set** (or `VITE_LEAD_EMAIL`), so
  the page never shows a form that cannot deliver. First submission triggers a one-time FormSubmit
  activation email; afterwards you can swap the address for FormSubmit's random alias.
  A honeypot field filters basic bots.
  Forms never lock after a submission (many workshops can register from one device). A repeated email
  is rejected, but only for emails registered **from the same browser**: there is no backend, so
  cross-device duplicate detection needs one (e.g. Supabase or a Google Sheet behind Apps Script).
- **SEO & sharing:** indexable (no `noindex`), meta description, Open Graph/Twitter card
  (`public/og-image.png`), Organization JSON-LD, `robots.txt`, `sitemap.xml`, `apple-touch-icon.png`.
  Regenerate images with `node scripts/generate-share-images.mjs`.

## Backend y panel de administración

The public forms, the carousel content and the admin panel (`cromiqa.com/#/admin`) run on
**Supabase** (Postgres + auth + storage). Until it is configured, the site keeps working with the
email-only forms and the bundled carousel, and `#/admin` shows a "Conecta Supabase" screen.

**Panel (`#/admin`, own login, never behind the preview gate):**
Resumen (totals, last-30-day charts, by zone, by status) · Lista de espera (search, zone filter,
CSV export, delete) · Mecánicos (status pipeline, internal notes, CSV, delete) · Contenido (carousel
texts and photos; photos are cropped to 5:4 and compressed in the browser before upload).

**Security:** visitors can only *insert* leads (only allowed columns, validated by DB constraints);
they can never read them. Everything else requires a signed-in user listed in `public.admins`
(`public.is_admin()` in every row-level-security policy). Emails are unique per table, so duplicates
are rejected from any device.

### Puesta en marcha (≈10 minutos, solo una vez)

Guía completa en español: [`docs/supabase-setup.md`](docs/supabase-setup.md).

1. **Crea el proyecto:** entra en [supabase.com](https://supabase.com) → *New project* → nombre
   `cromiqa`, región **West EU (Ireland)** o **Central EU (Frankfurt)**, guarda la contraseña de la base de datos.
2. **Crea las tablas:** *SQL Editor* → *New query* → pega todo el contenido de `supabase/schema.sql` → *Run*.
3. **Crea tu usuario de administrador:** *Authentication* → *Users* → *Add user* → *Create new user*
   con tu email y una contraseña (marca *Auto Confirm User*).
4. **Date permisos de administrador:** en *SQL Editor* ejecuta
   `insert into public.admins (email) values ('tu-email@ejemplo.com');` con el mismo email.
5. **Conecta la web:** *Project Settings* → *API* → copia **Project URL** y la clave **anon public**
   y pégalas en `DEFAULT_URL` y `DEFAULT_ANON_KEY` de `src/services/supabase.ts` (o pásaselas a Claude).
   La clave *anon* es pública por diseño; **nunca** pegues la clave `service_role`.
6. Publica (push a `main`). Entra en `cromiqa.com/#/admin` con tu email y contraseña.

Optional: *Authentication* → *Providers* → *Email* → turn off *Allow new users to sign up*, so nobody
can create accounts (admins are added by you in step 3).

## Deployment & domain

`.github/workflows/deploy.yml` runs type check, unit tests, build and Playwright (desktop + mobile) on
every push/PR, then publishes `dist/` to the **`gh-pages`** branch on pushes to `main`.

**Custom domain.** `public/CNAME` contains `cromiqa.com`. On each deploy the workflow checks DNS:
the CNAME is published only once `cromiqa.com` resolves to GitHub Pages, so the github.io URL never
redirects to a domain that does not resolve yet. A daily scheduled run re-checks, so the domain gets
attached automatically after DNS propagates (or run the workflow manually with `custom_domain=always`).

DNS records to create at the registrar for `cromiqa.com`:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA (optional) | @ | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
| CNAME | www | jorgebodas.github.io |

Remove any other A/AAAA/ALIAS records on `@` and any conflicting `www` record (e.g. registrar
parking). Then, in **Settings → Pages**: confirm *Source = Deploy from a branch → `gh-pages` / root*,
check that the custom domain shows `cromiqa.com` and the DNS check passes, and enable **Enforce HTTPS**
once the certificate is issued (can take up to ~1 h). With both records in place GitHub redirects
`www.cromiqa.com` → `cromiqa.com`. Recommended: verify the domain under *Settings (account) → Pages →
Verified domains* to prevent takeovers.

## Known limitations

- Demo only: no auth, payments, notifications or real-time chat; data is per browser.
- Distances are approximate between area centres (static table), never geolocation.
- Photos are downscaled into LocalStorage (~5 MB browser quota).
- Reviews and "Perfil revisado" are fictional demo states.

## Next steps

**Pending (owner):** activate the lead forms with a dedicated address (e.g. `hola@cromiqa.com` on
Hostinger, or a new Gmail forwarding to the personal one) so no personal email is published (the forms currently use the owner's personal Gmail as a temporary destination):
1. Create the address. 2. Demo panel → *Formularios de la página Próximamente* → *Enviar activación*.
3. Confirm FormSubmit's email. 4. Set `DEFAULT_LEAD_EMAIL` in `src/marketing/leads.ts` to that
address (or FormSubmit's alias if provided) and deploy.

1. Connect the marketplace prototype to Supabase too (implement `CromiqaBackend`), reusing the admin auth.
2. Real onboarding + identity/insurance checks for mechanics before any "verified" badge.
3. Notifications (email/WhatsApp) for new requests and proposals; calendar slots instead of free dates.
4. Garage → full maintenance timeline, reminders, and inspection reports with photos for resale.
5. Analytics on the funnel (need → results → request → accepted proposal).
