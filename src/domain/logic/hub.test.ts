import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import { applyRequestAction } from './requests';
import { hubItems, hubState } from './hub';

const now = new Date('2026-10-17T10:00:00');
const forOwner = (db: ReturnType<typeof createSeed>, id: string) => db.requests.filter((r) => r.ownerId === id);

describe('request hub', () => {
  it('in progress and confirmed appointments open tracking; nothing is executed', () => {
    const db = createSeed(now);
    const irene = hubItems(forOwner(db, 'u-irene'));
    expect(irene.find((i) => i.lead.id === 'r-09')?.quick).toMatchObject({ label: 'En curso', screen: 'tracking', requiresAction: false });
    expect(hubItems(forOwner(db, 'u-diego')).find((i) => i.lead.id === 'r-11')?.quick).toMatchObject({ screen: 'tracking', requiresAction: false });
    // Resolving doesn't change any request.
    expect(forOwner(db, 'u-irene').map((r) => r.status)).toEqual(forOwner(createSeed(now), 'u-irene').map((r) => r.status));
  });

  it('is a + when there is nothing active', () => {
    expect(hubState(hubItems([]))).toEqual({ kind: 'empty' });
    // Irene: one quote waiting and one job in progress; nothing completed or cancelled counts.
    const db = createSeed(now);
    const items = hubItems(forOwner(db, 'u-irene'));
    expect(items.every((i) => !i.threads.every((r) => ['completed', 'cancelled'].includes(r.status)))).toBe(true);
  });

  it('shows one request as its status, quotes before progress', () => {
    const db = createSeed(now);
    const pablo = hubItems(forOwner(db, 'u-pablo'));
    // Pablo: the inspection with 2 quotes comes first (needs him), then the request still waiting.
    expect(pablo[0]).toMatchObject({ label: '2 presupuestos', pending: true, priority: 2, quick: { screen: 'compare', requiresAction: true } });
    expect(pablo.at(-1)).toMatchObject({ label: 'Esperando respuesta', pending: false, priority: 6, quick: { screen: 'status', requiresAction: false } });
    const state = hubState(pablo);
    expect(state).toMatchObject({ kind: 'multiple', count: pablo.length, pending: 1 });
  });

  it('prioritises incidents, then appointments and completion, never inventing progress', () => {
    let db = createSeed(now);
    // Diego: Javier proposed a date (cita pendiente).
    expect(hubItems(forOwner(db, 'u-diego')).find((i) => i.lead.id === 'r-04')).toMatchObject({ label: 'Confirmar cita', action: 'Confirma la fecha propuesta', quick: { screen: 'appointment', threadId: 'r-04' } });
    // Ana: r-14 finished and waiting for her confirmation; reporting a problem makes it an incident.
    expect(hubItems(forOwner(db, 'u-ana'))[0]).toMatchObject({ label: 'Confirmar servicio', priority: 4, quick: { screen: 'completion' } });
    db = applyRequestAction(db, 'r-14', { type: 'report_problem', text: 'La maneta vuelve a irse al puño.' }, 'owner', now).db;
    expect(hubItems(forOwner(db, 'u-ana'))[0]).toMatchObject({ label: 'Incidencia abierta', priority: 1, quick: { screen: 'incident', threadId: 'r-14' } });
    // Confirming completion removes it from the hub.
    db = applyRequestAction(db, 'r-14', { type: 'confirm_completion' }, 'owner', now).db;
    expect(hubItems(forOwner(db, 'u-ana')).some((i) => i.lead.id === 'r-14')).toBe(false);
  });

  it('one item per request, however many mechanics were invited', () => {
    const db = createSeed(now);
    const ids = hubItems(forOwner(db, 'u-pablo')).map((i) => i.caseId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('test profiles: one cyclist per hub state', () => {
  it('each profile shows its state in the chip and opens the matching screen', () => {
    const db = createSeed(now);
    const expected: Record<string, [string, string]> = {
      'u-test': ['', ''],
      'u-bea': ['Esperando respuesta', 'status'],
      'u-carla': ['2 presupuestos', 'compare'],
      'u-dani': ['Confirmar cita', 'appointment'],
      'u-eva': ['En curso', 'tracking'],
      'u-fran': ['Confirmar servicio', 'completion'],
      'u-gema': ['Incidencia abierta', 'incident'],
    };
    for (const [owner, [label, screen]] of Object.entries(expected)) {
      const state = hubState(hubItems(forOwner(db, owner)));
      if (!label) expect(state.kind, owner).toBe('empty');
      else {
        expect(state.kind, owner).toBe('single');
        if (state.kind === 'single') expect(state.item.quick, owner).toMatchObject({ label, screen });
      }
    }
  });
});
