# Prompt · Nuevo look & feel de Cromiqa

Copy everything below the line into Claude, Figma Make, v0, Lovable or a similar tool. Attach the reference screenshot and the mockups (board-v2.png first, then board-1.png and board-2.png) if the tool accepts images.

---

You are a senior product designer. Define the visual language (a design system and its key screens) for **Cromiqa**, a mobile-first web app in Spanish that connects cyclists with trusted bike mechanics in south-east Madrid.

## Product in one paragraph
A cyclist picks a service (Mantenimiento, Frenos, Transmisión, Ruedas, Suspensión, Diagnóstico), describes the problem, chooses its bike and **one** mechanic, and sends a request. The mechanic answers with a fixed-price quote, a question or a rejection. The cyclist accepts the quote, agrees on a date, the work is done, and the cyclist confirms delivery (or reports a problem; the request closes automatically 72 h after the work is finished). **One request = one mechanic.** Things that need the cyclist (review a quote, confirm a date, answer a question, confirm delivery, an open incident) are "pendientes" and must always be easy to find.

## Mood and references
Take the feel of the attached reference (an AI assistant UI): calm, soft, premium, quiet. It is the *feel* we want, not the product:
- Light grey canvas (#f1f1f3), white cards with very large radii (24–28 px), hairline borders (rgba(20,20,20,.06)) and long, soft shadows.
- **Soft light instead of decoration:** blurred blobs of colour behind the content, and a glow that "leaks" from the bottom edge of key surfaces.
- **Dark sheets** (#111113, inner cards #1c1c1f / #26262a) for floating panels: a grab handle, round icon buttons in the corners (close / collapse) and a small centred title.
- **Draft cards:** a title with a small tag ("Borrador", "Pendiente"), rows of icon tile + title + subtitle, and two pill buttons at the bottom (a secondary grey one and a primary one).
- **Status pills with a dot**, like "Counting days": a small pill with a dot and a short label; the dot glows when it is the user's turn.
- An orb or "listening" state for waiting moments (request sent, waiting for an answer).
- Small type, sentence case, generous spacing, very little on screen at once.

## Colour: use Cromiqa's lime and yellow, never purple
- Lime `#c7ff2f` (deep `#a8e000`; text on light backgrounds `#557a00`), soft yellow `#f6ff9a` / `#e4ff6e`.
- Ink `#141414`, muted `#75757a`, subtle `#a6a6ab`.
- Lime is **light and signal**: dots, glows, the current step, the cyclist's own chat bubbles, and **primary buttons (lime with ink text)**.
- Black is used sparingly. There are two options to choose from (see board-v2.png):
  - **A · No black:** everything light, with floating sheets in frosted white glass. Ink is used only for text.
  - **B · Black only for layers:** floating sheets ("Pendiente de ti", "Revisa y envía"), the chat and the "request sent" screen are dark (#111113); every other screen is light.
  In both options, black is never used for buttons, tabs or selected chips (those use lime or a soft lime, #eaffb3).
- Every glow uses lime → yellow → transparent radial gradients with a 10–30 px blur.

## Type
Inter for UI text (13–15 px body; 12 px for secondary text), Manrope Bold for titles and big numbers (prices at 48–56 px, titles at 28–32 px, tracking −2%).

## Components to define (with states)
1. **Status pill:** waiting (grey dot), your turn (lime dot with glow), info (icon). Labels such as: Esperando respuesta, Esperando presupuesto, Presupuesto recibido, Confirma tu cita, Cita confirmada, Reparación en curso, Reparación terminada, Incidencia pendiente.
2. **Draft card** (light and dark): quote, request summary, revised quote.
3. **Dark sheet** with a grab handle, corner buttons and a title.
4. **Dock (mobile):** a frosted white pill with 3 tabs (Inicio, Mecánicos, Solicitudes; the active tab is ink with a lime icon) and, on the right, either a lime "+" (nothing pending) or an ink pill "● N pendientes ⌃" with a lime counter that opens the "Pendiente de ti" sheet.
5. **Ask bar:** a large input with a sparkle icon on the left and a round ink microphone button with a lime icon.
6. **Choice chips**, a **text field with a lime focus halo**, a **step progress bar** (the current step is lime with a glow), a **timeline** (done = ink, current = lime with a glow, next = grey).
7. **Service cards** with a photo, a dark gradient and the label on top; **mechanic cards** (avatar, name, speciality, ★ rating · reviews · response time).
8. **Chat:** a dark theme; mechanic bubbles in #1c1c1f, the cyclist's in lime; system cards (for example a revised quote) inline.

## Screens to design (mobile, 390 × 844)
1. **Inicio:** a lime aura at the top, a status pill ("2 presupuestos por revisar"), the greeting "Hola, Pablo. ¿Qué le pasa a tu bici?", the ask bar, a service carousel, a "Pendiente de ti" list and the dock.
2. **Nueva solicitud (one step):** the progress bar, a pill with the chosen service, the question as a title, chips, a focused text field, photo and dictate buttons, and Atrás / Continuar.
3. **Revisar y enviar:** a dark sheet with the user's input as a bubble, a sentence of context and a draft card (service, mechanic, bike, availability) with Cambiar / Enviar solicitud.
4. **Solicitud enviada:** a dark screen with the lime orb, the pill "Esperando respuesta · 00:12", "Enviada a Carlos" and three round actions.
5. **Solicitudes:** Activas / Completadas tabs and cards (service photo, service, bike · mechanic, status pill).
6. **Presupuesto:** the price as the hero, a draft card (date, mechanic, scope) with Rechazar / Aceptar presupuesto, and folded rows for Detalles and Actividad.
7. **Pendiente de ti:** the dark sheet opened from the dock pill.
8. **Reparación en curso:** a human headline ("Marta está con tu Giant"), a timeline, Mensajes and Reportar un problema.
9. **Mensajes:** the dark chat with an inline revised-quote card ("Mantener 75 €" / "Aprobar 103 €").
10. **Mecánicos:** a zone search, filter chips and mechanic cards.
Also show the desktop (1280 px) version of Inicio and Presupuesto: the same components in a centred column; the "pendientes" pill lives in the header.

## Copy: say it once
- Each piece of information appears **once** per screen. If the price is the headline, it doesn't come back in a row or a button ("Aceptar", not "Aceptar presupuesto 50 €").
- A status pill, a title and a paragraph never say the same thing. Pick one. (Before: pill "Presupuesto recibido" + title "Presupuesto recibido" + text "Revisa el precio…". After: pill "Te toca decidir" + price as the title.)
- Leave out the obvious: no "Pendiente de ti" tag inside a list already titled "Pendiente de ti", and no explanation sentence above a card that already explains itself.
- Buttons are 1–2 words: Aceptar, Rechazar, Enviar, Cambiar, Ver solicitud.
- Subtitles hold one fact, not a sentence: "Unos 75 min", "De tu garaje", "Responde en ~2 h".
- Keep only the reassurances that matter, in one short line: "Aceptar no es un pago."

## Rules (do not break)
- All copy is in Spanish (Spain). Sentence case. Short, human sentences.
- Nothing happens on the user's behalf: sending, accepting, paying and confirming are always explicit buttons. "Aceptar" a quote is not a payment.
- One request has exactly one mechanic. Never show "comparar presupuestos" or "invitar a más mecánicos" inside a request.
- This is a demo: mechanics, reviews and prices are fictitious; say so discreetly where they appear.
- Accessibility: AA contrast (lime is never used for text on white; use `#557a00`), 44 px minimum touch targets, a visible focus state, and no information conveyed by colour alone (the dot always comes with a label).
- Respect `prefers-reduced-motion`: glows can breathe slowly (3–4 s), nothing else animates by default.

## Deliverables
1. Tokens (colours, radii, shadows, glows, type scale, spacing) as CSS variables and/or a Tailwind v4 `@theme` block.
2. The components above with their states.
3. The 10 mobile screens and 2 desktop screens.
4. A short note on motion: the sheet opening, the pill turning into the sheet, the glow breathing, and the orb on the sent screen.
