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

1. Supabase backend implementing `CromiqaBackend` (auth with magic link, RLS per role).
2. Real onboarding + identity/insurance checks for mechanics before any "verified" badge.
3. Notifications (email/WhatsApp) for new requests and proposals; calendar slots instead of free dates.
4. Garage → full maintenance timeline, reminders, and inspection reports with photos for resale.
5. Analytics on the funnel (need → results → request → accepted proposal).
