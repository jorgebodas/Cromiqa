import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import { applyRequestAction } from './requests';
import { hubItems, hubState } from './hub';

const now = new Date('2026-10-17T10:00:00');
const forOwner = (db: ReturnType<typeof createSeed>, id: string) => db.requests.filter((r) => r.ownerId === id);

describe('request hub', () => {
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
    expect(pablo[0]).toMatchObject({ label: '2 presupuestos', pending: true, priority: 2 });
    expect(pablo.at(-1)).toMatchObject({ label: 'Esperando respuesta', pending: false, priority: 6 });
    const state = hubState(pablo);
    expect(state).toMatchObject({ kind: 'multiple', count: pablo.length, pending: 1 });
  });

  it('prioritises incidents, then appointments and completion, never inventing progress', () => {
    let db = createSeed(now);
    // Diego: Javier proposed a date (cita pendiente).
    expect(hubItems(forOwner(db, 'u-diego')).find((i) => i.lead.id === 'r-04')).toMatchObject({ label: 'Cita pendiente', action: 'Confirma la fecha propuesta' });
    // Ana: r-14 finished and waiting for her confirmation; reporting a problem makes it an incident.
    expect(hubItems(forOwner(db, 'u-ana'))[0]).toMatchObject({ label: 'Confirmar trabajo', priority: 4 });
    db = applyRequestAction(db, 'r-14', { type: 'report_problem', text: 'La maneta vuelve a irse al puño.' }, 'owner', now).db;
    expect(hubItems(forOwner(db, 'u-ana'))[0]).toMatchObject({ label: 'Incidencia abierta', priority: 1 });
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
