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

  test('cyclist: Inicio · Mecánicos · Solicitudes and a +; with active requests Solicitudes becomes the Hub', async ({ page }) => {
    const mobile = isMobile(page);
    const nav = page.getByRole('navigation', { name: mobile ? 'Principal (móvil)' : 'Principal', exact: true });
    const links = nav.getByRole('link');
    // No active requests: three destinations and "+ Nueva" (phones show icons only; labels stay as accessible names).
    await freshDemo(page);
    await expect(links).toHaveCount(3);
    for (const [i, name] of ['Inicio', 'Mecánicos', 'Solicitudes'].entries()) await expect(links.nth(i)).toHaveAccessibleName(name);
    if (mobile) await expect(page.getByTestId('new-request-fab')).toHaveAccessibleName('Nueva solicitud'); // a round +
    else await expect(page.getByRole('button', { name: 'Nueva solicitud' }).first()).toBeVisible();
    await expect(page.getByTestId(mobile ? 'request-hub-chip' : 'header-hub-chip')).toHaveCount(0);

    // Ana has something pending: the three tabs stay and the Hub takes the place of the +.
    const hubEntry = page.getByTestId(mobile ? 'pending-main' : 'header-hub-chip');
    await freshDemo(page, 'u-ana');
    await expect(links).toHaveCount(3);
    await expect(hubEntry).toBeVisible();
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
    if (!mobile) await expect(page.getByRole('banner').getByRole('button', { name: 'Nueva solicitud' })).toHaveCount(0);
    // The full Requests section (history included) is where the Hub leads.
    await hubEntry.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitudes');
    await page.getByRole('tab', { name: /Todas/ }).click();
    await expect(page.getByTestId('case-card').first()).toBeVisible();
    // Inside Requests the Hub hides: the selected tab says where you are.
    await expect(hubEntry).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('aria-current', 'page');
    // Leaving brings it back.
    await nav.getByRole('link', { name: 'Inicio' }).click();
    await expect(hubEntry).toBeVisible();

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

  test('request hub: the lime pill points to the Requests section, where everything is managed', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    const mobile = isMobile(page);
    const chip = page.getByTestId(mobile ? 'pending-main' : 'header-hub-chip');
    if (mobile) await expect(chip).toHaveText('1 pendiente');
    else await expect(chip).toHaveAccessibleName(/^2 presupuestos para comparar · Inspección antes de comprar\. 1 solicitud activa más/);
    // No management box: one tap goes to Solicitudes.
    await chip.click();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitudes');
    await expect(page.getByTestId('request-hub')).toHaveCount(0);
    await expect(page.getByTestId('case-card').first()).toBeVisible();
    // From there, a new request is one tap away.
    await page.getByTestId('requests-new').click();
    await expect(page.getByTestId('request-hub').getByText('Paso 1 de 7')).toBeVisible();
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
    if (mobile) {
      // Waiting for mechanics is nothing the cyclist has to do: the phone dock keeps its +.
      await expect(page.getByTestId('pending-pill')).toHaveCount(0);
      await expect(page.getByTestId('new-request-fab')).toBeVisible();
    } else {
      // Desktop: the header chip shows the request's status and leads to the Requests section.
      const chip = page.getByTestId('header-hub-chip');
      await expect(chip).toHaveAccessibleName(/^Buscando mecánicos · Mantenimiento\. Abrir$/);
      await chip.click();
      await expect(page).toHaveURL(/#\/solicitudes$/);
    }
  });

  test('desktop hub chip: one prioritised message, marquee only when needed, and the right destination', async ({ page }) => {
    test.skip(isMobile(page), 'The phone dock shows pending actions instead (own test)');
    const mobile = isMobile(page);
    const chip = () => page.getByTestId(mobile ? 'request-hub-chip' : 'header-hub-chip');
    const situation = () => chip().getAttribute('data-situation');

    // Zero active requests: the + (mobile) / no chip (desktop).
    await freshDemo(page);
    await expect(chip()).toHaveCount(0);
    if (mobile) await expect(page.getByTestId('new-request-fab')).toBeVisible();

    // Multiple requests with different priorities: the confirmation wins; the counter shows the rest.
    await freshDemo(page, 'u-diego');
    await expect(chip()).toHaveAccessibleName(/^Confirma tu cita · Mantenimiento\. 2 solicitudes activas más\. Abrir tus solicitudes$/);
    await expect(chip()).not.toContainText('+2');
    // The tap goes to the Requests section.
    await chip().click();
    await expect(page).toHaveURL(/#\/solicitudes$/);

    // One request needing action: no counter; short message stays still.
    await freshDemo(page, 'u-dani');
    await expect(chip()).toHaveAccessibleName(/^Confirma tu cita · Mantenimiento\. Abrir$/);
    await expect(chip()).not.toContainText('+');
    if (mobile) await expect(chip().getByTestId('marquee')).not.toHaveAttribute('data-moving', 'true');

    // One request waiting on someone else: calm (not bold), informational.
    await freshDemo(page, 'u-bea');
    expect(await situation()).toBe('searching');
    await expect(chip().getByTestId('marquee')).toHaveClass(/font-semibold/);

    // Long message: it slides (only the text; the counter and chevron stay put and never overlap it).
    await freshDemo(page, 'u-pablo');
    const marquee = chip().getByTestId('marquee');
    // Desktop has room for the whole message: it stays still.
    if (mobile) await expect(marquee).toHaveAttribute('data-moving', 'true');
    else await expect(marquee).not.toHaveAttribute('data-moving', 'true');
    const [m, c] = [await marquee.boundingBox(), await chip().boundingBox()];
    expect(m!.x + m!.width).toBeLessThanOrEqual(c!.x + c!.width); // the text never spills out of the capsule
    // Reduced motion: no movement, the whole message still readable and in the accessible name.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(marquee).not.toHaveAttribute('data-moving', 'true');
    await expect(chip()).toHaveAccessibleName(/^2 presupuestos para comparar/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // From a lower to a higher priority: reporting a problem turns "terminada" into an incident.
    await freshDemo(page, 'u-fran');
    expect(await situation()).toBe('work_finished');
    await expect(chip()).toHaveAccessibleName(/^Reparación terminada/);
    await page.goto('./#/solicitudes/r-fran/mecanico/r-fran');
    await page.getByRole('button', { name: 'Reportar un problema' }).click();
    await page.getByLabel('Qué ha pasado').fill('El cambio sigue saltando.');
    await page.getByRole('button', { name: 'Reportar problema' }).click();
    await expect(chip()).toHaveCount(0); // inside Requests: no Hub
    await page.goto('./#/mecanicos');
    await expect(chip()).toHaveAccessibleName(/^Incidencia pendiente/);
    expect(await situation()).toBe('incident');

    // Narrow phone: the three tabs keep their size; the Hub is the Solicitudes tab stretched to the bar's end.
    if (mobile) {
      await page.setViewportSize({ width: 320, height: 640 });
      await expect.poll(async () => {
        const [n, c] = [await page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Mecánicos' }).boundingBox(), await chip().boundingBox()];
        return n && c ? c.x >= n.x + n.width && c.x + c.width <= 320 && c.height >= 44 : false;
      }).toBe(true);
    }
  });

  test('desktop header: Nueva solicitud ⇄ Request Hub as requests start and end, from every entry point', async ({ page }) => {
    test.skip(isMobile(page), 'Phones: see the pending-hub test');
    const mobile = isMobile(page);
    const nav = page.getByRole('navigation', { name: mobile ? 'Principal (móvil)' : 'Principal', exact: true });
    const chip = page.getByTestId(mobile ? 'request-hub-chip' : 'header-hub-chip');
    const hub = page.getByTestId('request-hub');
    const stateA = async () => {
      await expect(nav.getByRole('link')).toHaveCount(3);
      await expect(chip).toHaveCount(0);
      if (mobile) await expect(page.getByTestId('new-request-fab')).toBeVisible();
    };
    const stateB = async (message: RegExp) => {
      await expect(nav.getByRole('link')).toHaveCount(3);
      await expect(chip).toHaveAccessibleName(message);
      await expect(page.getByRole('banner').getByRole('button', { name: 'Nueva solicitud' })).toHaveCount(0);
    };
    const send = async () => {
      await hub.getByText('Reparación', { exact: true }).click();
      await hub.getByLabel('Describe el problema').fill('Los frenos chirrían mucho al frenar.');
      await hub.getByRole('button', { name: 'Continuar' }).click();
      // The first request saves the bike to the garage; the next one picks it from there.
      if (await hub.getByText('Elige de tu garaje').count()) await hub.locator('label', { hasText: 'Montaña (MTB)' }).first().click();
      else await hub.locator('label', { hasText: 'Montaña (MTB)' }).click();
      for (let i = 0; i < 2; i++) await hub.getByRole('button', { name: 'Continuar' }).click();
      await hub.getByLabel('Zona', { exact: true }).selectOption('rivas');
      await hub.locator('label', { hasText: 'A domicilio' }).click();
      for (let i = 0; i < 2; i++) await hub.getByRole('button', { name: 'Continuar' }).click();
      await hub.getByTestId('provider-option').first().click();
      await hub.getByRole('button', { name: 'Continuar' }).click();
      await hub.getByRole('button', { name: 'Enviar solicitud' }).click();
      await expect(hub).toHaveCount(0);
    };

    // A new user with nothing active (Álex, the clean test cyclist); a request from the Home hero turns the dock into the Hub.
    await freshDemo(page, 'u-test');
    await stateA();
    await page.getByTestId('widget-need').getByRole('button', { name: 'Nueva solicitud' }).click();
    await send();
    await stateB(/^Buscando mecánicos · Reparación\. Abrir$/);
    if (mobile) await expect(page.getByTestId('dock')).toHaveAttribute('data-state', 'hub');

    // A second one from the Requests section (where the Hub leads): the counter appears.
    await chip.click();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    // Inside Requests: navigation only, Solicitudes selected.
    await expect(chip).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('requests-new').click();
    await send();
    await nav.getByRole('link', { name: 'Inicio' }).click();
    await stateB(/1 solicitud activa más/);

    // The Hub works from any section.
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await chip.click();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    await expect(page.getByTestId('case-card')).toHaveCount(2);

    // Cancelling both: the last one brings back the three tabs and "+ Nueva".
    for (let i = 0; i < 2; i++) {
      await page.goto('./#/solicitudes');
      await page.getByTestId('case-card').first().click();
      await page.getByRole('button', { name: 'Retirar solicitud' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Retirar solicitud' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.goto('./#/');
    await stateA();

    // Completing the last active request also returns to "+ Nueva" (reduced motion: instantly).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freshDemo(page, 'u-fran');
    await stateB(/^Reparación terminada/);
    await page.goto('./#/solicitudes/r-fran/mecanico/r-fran');
    await page.getByRole('button', { name: 'Confirmar que está terminado' }).click();
    await page.goto('./#/');
    await stateA();
  });

  test('phone dock: "N pendientes" pill, chevron preview, request detail and back to the list', async ({ page }) => {
    test.skip(!isMobile(page), 'Phone dock');
    const nav = page.getByRole('navigation', { name: 'Principal (móvil)' });
    const main = page.getByTestId('pending-main');
    const toggle = page.getByTestId('pending-toggle');
    const preview = page.getByTestId('pending-preview');

    // Nothing to do: the tabs and the separate +.
    await freshDemo(page, 'u-bea'); // waiting for mechanics: nothing for her to do
    await expect(page.getByTestId('pending-pill')).toHaveCount(0);
    await expect(page.getByTestId('new-request-fab')).toBeVisible();

    // One pending action: the Solicitudes tab becomes the pill.
    await freshDemo(page, 'u-ana');
    await expect(main).toHaveText('1 pendiente');
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
    // The chevron opens the preview without navigating, and closes it again.
    await toggle.click();
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Pendiente de ti' })).toBeVisible();
    await expect(page).not.toHaveURL(/solicitudes/); // the chevron doesn't navigate
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(preview).toHaveCount(0);
    // An item opens that request; back returns to the Solicitudes list.
    await toggle.click();
    await preview.getByTestId('pending-item').first().click();
    await expect(page).toHaveURL(/#\/solicitudes\/r-14\/mecanico\/r-14$/);
    await expect(preview).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitudes');
    // Inside Solicitudes: no Hub, Solicitudes selected.
    await expect(page.getByTestId('pending-pill')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('aria-current', 'page');
    // "Ver todas las solicitudes" and the main area both open the list.
    await nav.getByRole('link', { name: 'Inicio' }).click();
    await toggle.click();
    await preview.getByTestId('pending-all').click();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await main.click();
    await expect(page).toHaveURL(/#\/solicitudes$/);
    // Escape and navigation close the preview.
    await nav.getByRole('link', { name: 'Inicio' }).click();
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);

    // Several pending actions in different categories: plural, one row each, grouped.
    await freshDemo(page, 'u-pablo');
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('cromiqa:demo:db')!);
      for (const r of db.requests) if (r.caseId === 'r-04') r.ownerId = 'u-pablo'; // Diego's date proposal, now Pablo's
      localStorage.setItem('cromiqa:demo:db', JSON.stringify(db));
    });
    await page.reload();
    await expect(main).toHaveText('2 pendientes');
    await toggle.click();
    await expect(preview.getByTestId('pending-item')).toHaveCount(2);
    await expect(preview.getByTestId('pending-item').nth(0)).toContainText('Cita');
    await expect(preview.getByTestId('pending-item').nth(1)).toContainText('Presupuestos');
    await expect(preview.getByTestId('pending-item').nth(1)).toContainText('2 propuestas para comparar');
    await page.keyboard.press('Escape');

    // Narrow phone: the pill and its chevron fit inside the screen.
    await page.setViewportSize({ width: 320, height: 640 });
    await expect.poll(async () => {
      const t = await toggle.boundingBox();
      return t ? t.x + t.width <= 320 - 12 : false;
    }).toBe(true);
    await toggle.click();
    await expect(preview).toBeInViewport();

    // Doing the last pending action brings the + back.
    await page.setViewportSize({ width: 390, height: 760 });
    await freshDemo(page, 'u-ana');
    await page.goto('./#/solicitudes/r-14/mecanico/r-14');
    await page.getByRole('button', { name: 'Confirmar que está terminado' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar que está terminado' })).toHaveCount(0);
    await page.goto('./#/');
    await expect(page.getByTestId('pending-pill')).toHaveCount(0);
    await expect(page.getByTestId('new-request-fab')).toBeVisible();
  });

  test('tabs remember their state, and back works from a direct link', async ({ page }) => {
    await freshDemo(page); // no active requests: the three tabs
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await page.getByRole('searchbox', { name: /Buscar/ }).fill('suspensión');
    await expect(page).toHaveURL(/q=suspensi/);
    await nav.getByRole('link', { name: 'Solicitudes' }).click();
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await expect(page.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('suspensión');

    await freshDemo(page, 'u-ana');
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
    await expect(page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Mecánicos' })).toBeVisible();
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
