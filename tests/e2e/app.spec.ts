import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, switchAccount } from './helpers';

test.describe('Navegación', () => {
  test('cyclist routes render and deep links survive reloads', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const routes: [string, RegExp][] = [
      ['#/', /^Inicio$/],
      ['#/mecanicos', /^Mecánicos$/],
      ['#/mecanicos/m-marta', /Marta Ibáñez/],
      ['#/solicitudes', /^Solicitudes$/],
      ['#/actividad', /^Notificaciones$/],
      ['#/garaje', /^Garaje$/],
      ['#/garaje/b-ana-mtb', /La de monte/],
      ['#/cuenta', /^Perfil$/],
      ['#/demo', /^Demo$/],
      ['#/no-existe', /Esta página no existe/],
    ];
    for (const [hash, heading] of routes) {
      await page.goto('./' + hash);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
  });

  test('mechanic routes render, and old list links still land on the right segment', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    for (const [hash, heading] of [
      ['#/pro', /^Inicio$/],
      ['#/pro/solicitudes', /^Solicitudes$/],
      ['#/pro/trabajos', /^Servicios$/],
      ['#/pro/servicios', /^Tarifas$/],
      ['#/pro/disponibilidad', /^Disponibilidad$/],
      ['#/pro/perfil', /^Perfil profesional$/],
    ] as const) {
      await page.goto('./' + hash);
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
    await page.goto('./#/pro/solicitudes?estado=agenda');
    await expect(page).toHaveURL(/#\/pro\/trabajos\?estado=proximos/);
    await expect(page.getByRole('tab', { name: /Con cita/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('cyclist: Inicio · Mecánicos · Solicitudes, a separate +, bell and avatar top-right, no general search', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const mobile = isMobile(page);
    const nav = page.getByRole('navigation', { name: mobile ? 'Principal (móvil)' : 'Principal', exact: true });
    // Phones show icons only; the labels stay as accessible names.
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(3);
    for (const [i, name] of ['Inicio', 'Mecánicos', 'Solicitudes'].entries()) await expect(links.nth(i)).toHaveAccessibleName(name);
    // Ana has active requests: the Request Hub shows their status instead of a bare +.
    await expect(mobile ? page.getByTestId('request-hub-chip') : page.getByRole('button', { name: 'Nueva solicitud' }).first()).toBeVisible();

    await nav.getByRole('link', { name: 'Solicitudes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitudes');
    await page.getByRole('tab', { name: /Todas/ }).click();
    await expect(page.getByTestId('case-card').first()).toBeVisible();
    await page.getByTestId('case-card').first().click();
    await expect(nav.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('aria-current', 'page');

    // No general search: searching lives in Mecánicos.
    await page.goto('./#/');
    await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toHaveCount(0);

    // Garage is secondary: not in the bar, reached from the profile.
    await expect(nav.getByRole('link', { name: 'Garaje' })).toHaveCount(0);
    await page.goto('./#/');
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perfil');
    await page.getByRole('link', { name: /^Garaje/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });

  test('notifications live inside the avatar: the badge counts unread updates and clears once seen', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await expect(page.getByTestId('activity-link')).toHaveCount(0); // no bell any more
    const avatar = page.getByTestId('account-link').filter({ visible: true });
    await expect(avatar).toHaveAttribute('aria-label', /sin leer/);
    await avatar.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perfil');
    await page.getByRole('link', { name: /^Notificaciones/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notificaciones');
    await expect(page.getByTestId('updates').getByRole('link').first()).toBeVisible();
    await page.goto('./#/');
    await expect(page.getByTestId('account-link').filter({ visible: true })).toHaveAttribute('aria-label', 'Tu perfil');
    await page.reload();
    await expect(page.getByTestId('account-link').filter({ visible: true })).toHaveAttribute('aria-label', 'Tu perfil');
  });

  test('mechanic: Inicio · Solicitudes · Servicios, without +', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(3);
    for (const [i, name] of [/^Inicio/, /^Solicitudes/, /^Servicios/].entries()) await expect(links.nth(i)).toHaveAccessibleName(name);
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva solicitud' }).first()).toHaveCount(0);
  });

  test('role switch from the profile, each mode returning to where it was', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    // Carlos has a professional profile: he starts in mechanic mode.
    await page.goto('./#/pro/trabajos');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Servicios');
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    // Cyclist mode, new to it: the Home invites to a first request, with no fake activity.
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByText('Encuentra al mecánico adecuado.')).toBeVisible();
    await expect(page.getByTestId('attention')).toHaveCount(0);
    await expect(page.getByTestId('discover')).not.toContainText('Carlos Ortega'); // never his own workshop
    await page.goto('./#/mecanicos');
    // Back to mechanic mode: the last mechanic place, not the start.
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Mecánico' }).click();
    await expect(page).toHaveURL(/#\/pro\/trabajos$/);
    // …and cyclist mode remembers Mecánicos.
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    await expect(page).toHaveURL(/#\/mecanicos$/);
    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mecánicos');
  });

  test('cyclist-only accounts have no mechanic mode, and mechanic screens lead to the onboarding', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/cuenta');
    await expect(page.getByRole('radio', { name: 'Mecánico' })).toHaveCount(0);
    await expect(page.getByTestId('start-onboarding')).toHaveText('Hazte mecánico');
    await page.goto('./#/pro');
    await expect(page.getByRole('heading', { name: 'Aún no tienes perfil profesional' })).toBeVisible();
    await page.getByRole('link', { name: 'Hazte mecánico' }).click();
    await expect(page).toHaveURL(/#\/pro\/alta/);
  });

  test('professional onboarding: draft kept, submitted for verification, listed only once approved', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await page.goto('./#/cuenta');
    await page.getByTestId('start-onboarding').click();
    await expect(page.getByText('Paso 1 de 5')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Indica tu nombre profesional')).toBeVisible();
    await page.getByLabel('Nombre profesional o del taller').fill('Taller Serrano');
    // Leaving keeps the draft on this device.
    await page.getByRole('button', { name: 'Salir del alta' }).click();
    await expect(page.getByTestId('start-onboarding')).toHaveText('Continuar alta de mecánico');
    await page.getByTestId('start-onboarding').click();
    await expect(page.getByLabel('Nombre profesional o del taller')).toHaveValue('Taller Serrano');

    await page.getByLabel('Especialidad principal').fill('Carretera y gravel');
    await page.getByLabel('Sobre ti').fill('Diez años montando y ajustando bicis de carretera en Vallecas.');
    await page.getByLabel('Años de experiencia').fill('10');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('group', { name: 'Especialidades' }).getByRole('button').first().click();
    await page.getByRole('group', { name: 'Tipos de bici con los que trabajas' }).getByRole('button', { name: /Carretera/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Zona del taller').fill('Vallecas Villa');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Ofrece al menos un servicio.')).toBeVisible();
    await page.locator('label', { hasText: 'Mantenimiento' }).first().click();
    await page.getByLabel('Precio desde para Mantenimiento').fill('40');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByTestId('onboarding-review')).toContainText('Taller Serrano');
    await page.getByRole('button', { name: 'Enviar a verificación' }).click();
    await expect(page).toHaveURL(/#\/pro$/);
    await expect(page.getByTestId('mechanic-hero')).toContainText('Tu perfil está en revisión.');
    await expect(page.getByTestId('profile-status')).toContainText('Pendiente de verificación');

    // Not listed yet.
    await page.goto('./#/mecanicos');
    await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Pablo Serrano' })).toHaveCount(0);

    await page.goto('./#/pro');
    await page.getByRole('button', { name: 'Simular aprobación (demo)' }).click();
    await expect(page.getByTestId('profile-status')).toContainText('Activo');
    await page.goto('./#/mecanicos');
    await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Pablo Serrano' })).toHaveCount(1);
  });

  test('a fresh demo starts as a clean cyclist: just the +, no requests', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cromiqa:access', '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d');
    });
    await page.reload();
    await expect(page.getByTestId('demo-switch')).toContainText('Álex');
    if (isMobile(page)) await expect(page.getByTestId('new-request-fab')).toBeVisible();
    await expect(page.getByTestId('request-hub-chip')).toHaveCount(0);
    await expect(page.getByTestId('header-hub-chip')).toHaveCount(0);
    await expect(page.getByTestId('attention')).toHaveCount(0);
    await page.goto('./#/solicitudes');
    await expect(page.getByText('Aún no tienes solicitudes')).toBeVisible();
  });

  test('request hub: a + with nothing active opens the new request in a panel, without leaving the page', async ({ page }) => {
    await freshDemo(page, 'u-carlos'); // Carlos in cyclist mode has no requests
    await page.goto('./#/cuenta');
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    await page.goto('./#/');
    const mobile = isMobile(page);
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).first().click();
    const hub = page.getByTestId('request-hub');
    await expect(hub.getByRole('heading', { name: 'Nueva solicitud' })).toBeVisible();
    await expect(hub.getByText('Paso 1 de 7')).toBeVisible();
    await expect(page).toHaveURL(/#\/$/); // same page underneath
    if (!mobile) {
      // Desktop: the same box as the entrance card, centred at the bottom.
      const panel = hub.getByRole('dialog');
      await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThanOrEqual(448);
      await expect.poll(async () => {
        const b = (await panel.boundingBox())!;
        return Math.abs(b.x + b.width / 2 - page.viewportSize()!.width / 2);
      }).toBeLessThan(4);
    }

    // Closing with changes asks first; the draft can be kept or discarded.
    await hub.getByLabel('Describe el problema').fill('Revisión completa antes del verano.');
    await page.keyboard.press('Escape');
    const confirm = page.getByRole('dialog', { name: '¿Salir de la nueva solicitud?' });
    await confirm.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(hub).toHaveCount(0);
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).first().click();
    await expect(hub.getByLabel('Describe el problema')).toHaveValue('Revisión completa antes del verano.');
    await hub.getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('dialog', { name: '¿Salir de la nueva solicitud?' }).getByRole('button', { name: 'Descartar' }).click();
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).first().click();
    await expect(hub.getByLabel('Describe el problema')).toHaveValue('');
  });

  test('request hub: several active requests show a count; the panel lists them, opens one, and creates more', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    const mobile = isMobile(page);
    const chip = mobile ? page.getByTestId('request-hub-chip') : page.getByTestId('header-hub-chip');
    // Light pill: one circle per request and one word; the full status is its accessible name.
    await expect(chip).toHaveAccessibleName(/2 solicitudes, 1 pendiente/);
    await expect(chip).toContainText('Revisar');
    await chip.click();
    const hub = page.getByTestId('request-hub');
    // Pending actions first: the inspection with two quotes.
    await expect(hub.getByTestId('hub-item').first()).toContainText('2 presupuestos');
    await expect(hub.getByTestId('hub-item').first()).toContainText('Compara y elige uno');
    // Opening an item goes straight to its next action: the quote comparison.
    await hub.getByTestId('hub-item').first().click();
    await expect(hub.getByTestId('quick-compare')).toContainText('Carlos Ortega');
    await expect(hub.getByTestId('quick-compare')).toContainText('Nerea Campos');
    await hub.getByRole('button', { name: 'Volver a tus solicitudes' }).click();
    await hub.getByRole('button', { name: 'Nueva solicitud' }).click();
    await expect(hub.getByText('Paso 1 de 7')).toBeVisible();
    // From the overview, back on the first step returns to the list.
    await hub.getByRole('button', { name: 'Atrás' }).click();
    await expect(hub.getByTestId('hub-overview')).toBeVisible();
    await hub.getByTestId('hub-item').first().click();
    await hub.getByRole('button', { name: 'Ver solicitud completa' }).click();
    await expect(hub).toHaveCount(0);
    await expect(page.getByTestId('case-status')).toHaveText('Propuestas recibidas');
  });

  test('request hub quick actions: one request opens its next action in one tap, without executing it', async ({ page }) => {
    const mobile = isMobile(page);
    const chip = () => (mobile ? page.getByTestId('request-hub-chip') : page.getByTestId('header-hub-chip'));
    const hub = page.getByTestId('request-hub');
    // Leave each account with a single active request by withdrawing the others in the stored demo data.
    const keepOnly = async (owner: string, keep: string) =>
      page.evaluate(([o, k]) => {
        const db = JSON.parse(localStorage.getItem('cromiqa:demo:db')!);
        for (const r of db.requests)
          if (r.ownerId === o && r.caseId !== k && ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress', 'awaiting_completion'].includes(r.status)) {
            r.status = 'cancelled';
            r.events.push({ id: 'x' + r.id, type: 'cancelled_by_owner', by: 'owner', at: new Date().toISOString() });
          }
        localStorage.setItem('cromiqa:demo:db', JSON.stringify(db));
      }, [owner, keep]);

    // Two quotes → the comparison, nothing accepted.
    await freshDemo(page, 'u-pablo');
    await keepOnly('u-pablo', 'r-03');
    await page.reload();
    await expect(chip()).toHaveAccessibleName(/2 presupuestos/);
    await chip().click();
    await expect(hub.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible();
    await expect(hub.getByTestId('quick-quote')).toHaveCount(2);
    await expect(chip()).toContainText('Elegir'); // still pending: nothing was accepted
    // Back to the overview, and a new request is one tap away.
    await hub.getByRole('button', { name: 'Volver a tus solicitudes' }).click();
    await expect(hub.getByTestId('hub-overview')).toBeVisible();
    await expect(hub.getByRole('button', { name: 'Nueva solicitud' })).toBeVisible();
    // Accepting is an explicit tap; the hub then moves on to the appointment.
    await hub.getByTestId('hub-item').first().click();
    await hub.getByTestId('quick-quote').first().getByRole('button', { name: 'Aceptar presupuesto' }).click();
    await expect(hub.getByTestId('quick-appointment')).toBeVisible();
    await expect(chip()).toHaveAccessibleName(/Confirmar cita/);

    // A date proposed by the mechanic → appointment confirmation, still pending.
    await freshDemo(page, 'u-diego');
    await keepOnly('u-diego', 'r-04');
    await page.reload();
    await expect(chip()).toHaveAccessibleName(/Confirmar cita/);
    await chip().click();
    await expect(hub.getByTestId('quick-appointment')).toBeVisible();
    await expect(hub.getByTestId('appointment-pending')).toContainText('Javier propone');
    await expect(hub.getByRole('button', { name: 'Confirmar cita' })).toBeVisible();

    // Work in progress → tracking.
    await freshDemo(page, 'u-irene');
    await keepOnly('u-irene', 'r-09');
    await page.reload();
    await expect(chip()).toHaveAccessibleName(/En curso/);
    await expect(chip()).toContainText('Trabajando');
    await chip().click();
    await expect(hub.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();
    await expect(hub.getByTestId('appointment-confirmed')).toBeVisible();
    await expect(page).not.toHaveURL(/solicitudes/); // never left the page
  });

  test('request hub: one active request shows its status; photos can be attached, previewed and removed', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/cuenta');
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    await page.goto('./#/');
    const mobile = isMobile(page);
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).first().click();
    const hub = page.getByTestId('request-hub');
    await hub.getByText('Mantenimiento', { exact: true }).click();
    await hub.getByLabel('Describe el problema').fill('Puesta a punto y ruido en el pedalier.');
    await hub.getByRole('button', { name: 'Continuar' }).click();
    await hub.locator('label', { hasText: 'Carretera' }).first().click();
    await hub.getByRole('button', { name: 'Continuar' }).click();
    // A small valid PNG.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
    await hub.getByTestId('photo-input').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }]);
    await expect(hub.getByTestId('photo-previews').getByRole('img')).toHaveCount(2);
    await hub.getByRole('button', { name: 'Quitar foto 2' }).click();
    await expect(hub.getByTestId('photo-previews').getByRole('img')).toHaveCount(1);
    await hub.getByTestId('photo-input').setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(hub.getByText('Solo se admiten imágenes')).toBeVisible();
    await hub.getByRole('button', { name: 'Continuar' }).click();
    await expect(hub.getByLabel('Zona', { exact: true })).toHaveValue('rivas'); // their own zone, prefilled
    await hub.getByLabel('Zona', { exact: true }).selectOption('madrid-moratalaz');
    await hub.locator('label', { hasText: 'En taller' }).click();
    await hub.getByRole('button', { name: 'Continuar' }).click();
    await hub.getByRole('button', { name: 'Continuar' }).click(); // timing is optional
    await hub.getByTestId('provider-option').first().click();
    await hub.getByRole('button', { name: 'Continuar' }).click();
    await expect(hub.getByTestId('request-photos').getByRole('img')).toHaveCount(1);
    await hub.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(hub).toHaveCount(0);
    // The + became the request's status.
    const chip = mobile ? page.getByTestId('request-hub-chip') : page.getByTestId('header-hub-chip');
    await expect(chip).toHaveAccessibleName(/Mantenimiento: Esperando respuesta/);
    await expect(chip).toContainText('Esperando');
    await chip.click();
    await expect(hub.getByTestId('hub-detail')).toBeVisible();
    await expect(hub.getByTestId('request-photos').getByRole('img')).toHaveCount(1);
  });

  test('tabs remember their state, and back works from a direct link', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await page.getByRole('searchbox', { name: /Buscar/ }).fill('suspensión');
    await expect(page).toHaveURL(/q=suspensi/);
    await nav.getByRole('link', { name: 'Solicitudes' }).click();
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await expect(page.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('suspensión');

    await page.goto('./#/garaje/b-ana-mtb');
    await page.reload();
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });

  test('phones: scrolling shrinks the title into the pinned bar and the tabs into a circle', async ({ page }) => {
    test.skip(!isMobile(page), 'Phone-only behaviour');
    await freshDemo(page, 'u-ana');
    await page.goto('./#/mecanicos');
    await page.mouse.wheel(0, 700);
    const condensed = page.getByTestId('nav-condensed');
    await expect(condensed).toBeVisible();
    await expect(condensed).toHaveAccessibleName(/Mecánicos/);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(68); // one circle
    // The large title has shrunk into the pinned bar, which keeps its buttons.
    const bar = page.getByTestId('screen-bar');
    await expect(bar).toHaveAttribute('data-compact', 'true');
    await expect.poll(async () => {
      const [t, b] = [await page.getByTestId('screen-title').boundingBox(), await bar.boundingBox()];
      return t && b ? Math.abs(t.y + t.height / 2 - (b.y + b.height / 2)) : 99;
    }).toBeLessThan(3);
    await expect(page.getByTestId('account-link').filter({ visible: true })).toBeVisible();
    // Tapping the circle brings the full bar back.
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(68);
    await condensed.click();
    await expect(page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Solicitudes' })).toBeVisible();
  });

  test('role gates offer a demo account instead of a fake login', async ({ page }) => {
    await freshDemo(page);
    await page.goto('./#/garaje');
    await expect(page.getByText('Entra con una cuenta de demostración')).toBeVisible();
    await page.getByRole('button', { name: /Continuar como Ana/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });
});

test.describe('Validación de formularios', () => {
  test('cyclist home puts what needs you first, then a short summary and grounded suggestions', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await expect(page.getByTestId('widget-need')).toBeVisible();
    const proposal = page.getByTestId('attention-proposal');
    // Pablo has two quotes for the same request: one card to compare them.
    await expect(proposal).toContainText('2 presupuestos para comparar');
    await expect(page.getByTestId('discover').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('discover')).not.toContainText('★');
    await proposal.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitud');
    await expect(page.getByTestId('case-status')).toHaveText('Propuestas recibidas');
  });

  test('mechanic home: to-do by urgency, counts open filtered lists, profile status', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro');
    await expect(page.getByTestId('todo-respond').first()).toContainText('Responder');
    await expect(page.getByTestId('profile-status')).toBeVisible();
    await page.getByTestId('count-unanswered').click();
    await expect(page).toHaveURL(/estado=sin-responder/);
    await expect(page.getByRole('tab', { name: /Sin responder/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('request flow blocks invalid steps', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/solicitar?mecanico=m-andres');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Elige el tipo de servicio.')).toBeVisible();
    await expect(page.getByText('Describe el problema con al menos 10 caracteres.')).toBeVisible();
    await page.getByText('Reparación', { exact: true }).click();
    await page.getByLabel('Describe el problema').fill('Pinchazo en la rueda trasera.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.locator('label', { hasText: 'Otra bici' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Elige el tipo de bici.')).toBeVisible();
    // Brand and model are optional.
    await page.locator('label').filter({ hasText: /^Urbana$/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Paso 3 de 7')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    // Andrés offers no home service: the option is disabled
    await expect(page.getByRole('radio', { name: /A domicilio/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Continuar' }).click();
    // Timing is optional, but a past date isn't accepted.
    await page.getByLabel(/Fecha preferida/).fill('2020-01-01');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('La fecha no puede estar en el pasado.')).toBeVisible();
  });

  test('proposal form rejects a zero price', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro/solicitudes/r-02');
    await page.getByTestId('respond-options').getByRole('button', { name: 'Presupuesto cerrado' }).click();
    const form = page.getByTestId('proposal-form');
    await form.getByLabel('Precio total (€)').fill('0');
    await form.getByRole('button', { name: 'Enviar presupuesto' }).click();
    await expect(form.getByText('Indica un precio mayor que 0 €.')).toBeVisible();
  });

  test('garage bike form validates and saves', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/garaje');
    await page.getByRole('button', { name: 'Añadir bici' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Añadir bici' });
    await dialog.getByRole('button', { name: 'Añadir al garaje' }).click();
    await expect(dialog.getByText('Ponle un nombre a tu bici.')).toBeVisible();
    await dialog.getByLabel('Nombre').fill('La de gravel');
    await dialog.getByLabel('Marca').fill('Orbea');
    await dialog.getByLabel('Modelo').fill('Terra H40');
    await dialog.getByLabel('Tipo').selectOption('gravel');
    await dialog.getByRole('button', { name: 'Añadir al garaje' }).click();
    await expect(page.getByTestId('bike-card')).toHaveCount(3);
    await page.reload();
    await expect(page.getByTestId('bike-card').filter({ hasText: 'La de gravel' })).toBeVisible();
  });
});

test.describe('Persistencia y modo demo', () => {
  test('mechanic profile edits show up publicly and survive reload', async ({ page }) => {
    await freshDemo(page, 'u-marta');
    await page.goto('./#/pro/perfil');
    await page.getByLabel('Especialidad principal').fill('Carretera, gravel y ruedas a mano');
    await page.getByRole('button', { name: 'Suspensiones' }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Cambios guardados').first()).toBeVisible();

    await page.goto('./#/pro/servicios');
    await page.getByLabel('Nombre del servicio').first().fill('Puesta a punto premium');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Cambios guardados').first()).toBeVisible();

    await page.reload();
    await switchAccount(page, 'Invitado');
    await page.goto('./#/mecanicos/m-marta');
    await expect(page.getByText('Carretera, gravel y ruedas a mano').first()).toBeVisible();
    await expect(page.getByText('Puesta a punto premium')).toBeVisible();
    await page.goto('./#/mecanicos?especialidad=suspension');
    await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Marta Ibáñez' })).toBeVisible();
  });

  test('current account persists across reloads and reset restores scenarios', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/garaje/b-ana-urban');
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: 'Eliminar bici' }).click();
    await expect(page.getByTestId('bike-card')).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId('bike-card')).toHaveCount(1);
    await expect(page.getByTestId('demo-switch')).toContainText('Ana');

    await page.goto('./#/demo');
    await expect(page.getByTestId('demo-requests-table').locator('tbody tr')).toHaveCount(22);
    await page.getByTestId('reset-demo').click();
    await page.getByTestId('confirm-reset').click();
    await expect(page.getByTestId('demo-switch')).toContainText('Álex'); // back to the clean default account
    await switchAccount(page, 'Ana López');
    await page.goto('./#/garaje');
    await expect(page.getByTestId('bike-card')).toHaveCount(2);
  });
});
