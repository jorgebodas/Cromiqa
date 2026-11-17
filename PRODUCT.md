# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Cyclists in south-east Madrid (Rivas-Vaciamadrid, Vallecas and the surrounding area) who don't repair their bike themselves or don't want to. This covers two groups equally:
- **Everyday riders** (urban or weekend) who want someone trustworthy, a clear price and no hassle.
- **Demanding enthusiasts** (MTB and road, expensive bikes) who know their components and look for specialists such as suspension work or a pre-purchase inspection.

The secondary audience is **mechanics**: independent professionals and small workshops, some of whom work at the customer's home. They receive requests, send quotes, agree dates and do the work.

## Product Purpose
Cromiqa connects a cyclist with a trusted mechanic and carries the whole job in one place:
1. The cyclist chooses a service, describes the problem and picks their bike.
2. They send the request to **one** mechanic.
3. The mechanic replies with a fixed-price quote, a question or a rejection.
4. The cyclist accepts, and both agree on a date.
5. The work is done and the cyclist confirms delivery, or reports a problem. A request closes administratively 72 h after the work is finished.

Success means the cyclist has their bike fixed without uncertainty about price, timing or who to trust.

## Positioning
**Trust and a fixed price.** Mechanics are verified and reviewed, the quote is closed before anything is hired, and every step (quote, date, delivery, incidents) is recorded in a single place. Phoning a workshop or searching Google or Wallapop offers none of this.

## Operating Context
- Mobile first. The cyclist checks on their phone what is waiting for them: a quote to review, a date to confirm, a delivery to confirm.
- Things that are waiting on the cyclist are "pendientes" and must always be easy to find (in the dock on mobile, in the header on desktop).

## Capabilities and Constraints
- One request = one mechanic. There is no comparing or inviting several mechanics within one request; asking someone else means creating another request.
- Nothing happens on the user's behalf. Sending, accepting, confirming and cancelling are always explicit actions. Accepting a quote is not a payment.
- Services: Mantenimiento, Frenos, Transmisión, Ruedas, Suspensión, Diagnóstico.
- Modes: at the cyclist's home or in a workshop.
- Stack: React 18, TypeScript, Vite, Tailwind v4, Zustand, HashRouter.
- Hosting: GitHub Pages (cromiqa.com).
- Current state: a functional prototype in a demo environment. Mechanics, users, reviews, prices and verifications are fictitious, and no payments are processed.

## Brand Commitments
Nothing is fixed. Name, logo, colour and tone can all be reconsidered (as confirmed by the user). The product copy is in Spanish (Spain), addresses the user as "tú" and uses short sentences.

## Evidence on Hand
- Real photography of mechanics and services in `src/assets/mechanics/` and `src/assets/services/`.
- There are no real testimonials, customers or metrics. Demo data must never be presented as real.

## Product Principles
1. Price and next step always visible: the user knows what it costs and what comes next.
2. The user decides; the product never acts on their behalf.
3. Say it once: each piece of information appears once per screen.
4. What needs the user stands out; everything else stays quiet.
5. Serve both the beginner and the expert, without jargon and without condescension.

## Accessibility & Inclusion
WCAG AA contrast, 44 px touch targets, a visible focus state, no information conveyed by colour alone, and respect for reduced motion.
