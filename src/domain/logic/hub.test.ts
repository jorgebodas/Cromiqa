import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { DemoDatabase, Role } from '../types';
import { applyRequestAction, type RequestAction } from './requests';
import { cyclistAttention } from './home';
import { compareRanked, hubItems, hubState, type HubSituation } from './hub';

const now = new Date('2026-10-17T10:00:00');
const forOwner = (db: DemoDatabase, id: string) => db.requests.filter((r) => r.ownerId === id);
const quote = (price: number) => ({ price, date: '2026-10-20', time: '10:00', message: 'Ajuste completo.' });

describe('request hub: one message per request, from the stored lifecycle', () => {
  it('follows one request through its whole lifecycle with the right message and destination', () => {
    let db = createSeed(now);
    // One request = one mechanic: Bea's first request (to one mechanic) from start to finish.
    const a = forOwner(db, 'u-bea')[0]!.id;
    const top = (when = now) => hubItems(forOwner(db, 'u-bea'), when).find((i) => i.caseId === a)!;
    const act = (id: string, action: RequestAction, by: Role, at = now) => {
      db = applyRequestAction(db, id, action, by, at).db;
    };
    const expectTop = (situation: HubSituation, label: string, pending: boolean) => expect(top(), situation).toMatchObject({ label, pending, quick: { situation } });

    expectTop('searching', 'Buscando mecánicos', false);
    act(a, { type: 'accept_for_review' }, 'mechanic');
    expectTop('waiting_quotes', 'Esperando presupuestos', false);
    act(a, { type: 'send_open_proposal', message: '¿Es Shimano o SRAM?' }, 'mechanic');
    expectTop('message', 'Nuevo mensaje del mecánico', true);
    expect(top().quick.href).toBe(`/solicitudes/${a}/mecanico/${a}`);
    act(a, { type: 'send_proposal', proposal: quote(40) }, 'mechanic');
    expectTop('quote', 'Nuevo presupuesto recibido', true);
    expect(top().quick.screen).toBe('compare');
    // Hired: the date is agreed afterwards.
    // Hiring turns the quote's date into the mechanic's first proposal.
    act(a, { type: 'accept_proposal' }, 'owner');
    expectTop('confirm_appointment', 'Confirma tu cita', true);
    // Without any date (stored state allows it): the cyclist proposes one.
    const saved = db;
    db = { ...db, requests: db.requests.map((r) => (r.id === a ? { ...r, appointment: undefined } : r)) };
    expectTop('propose_date', 'Elige fecha para la reparación', true);
    db = saved;
    act(a, { type: 'propose_appointment', slot: { date: '2026-10-21', time: '18:00' } }, 'owner');
    expectTop('waiting_confirmation', 'Esperando confirmación', false);
    act(a, { type: 'propose_appointment', slot: { date: '2026-10-22', time: '10:00' } }, 'mechanic');
    expectTop('new_date', 'Nueva fecha propuesta', true);
    act(a, { type: 'confirm_appointment' }, 'owner');
    expectTop('appointment_confirmed', 'Cita confirmada', false);
    act(a, { type: 'start' }, 'mechanic');
    expectTop('in_progress', 'Reparación en curso', false);
    act(a, { type: 'finish_work' }, 'mechanic');
    expectTop('work_finished', 'Reparación terminada', true);
    // Less than a day before the 72 h closure: a real deadline.
    const later = new Date(now.getTime() + 50 * 3600_000);
    expect(top(later)).toMatchObject({ label: 'Confirma la entrega', deadline: true, quick: { situation: 'confirm_delivery', screen: 'completion' } });
    act(a, { type: 'report_problem', text: 'Sigue saltando.' }, 'owner');
    expectTop('incident', 'Incidencia pendiente', true);
    // Nothing above executed anything on the cyclist's behalf: every change was an explicit action.
    act(a, { type: 'resolve_incident' }, 'owner');
    act(a, { type: 'confirm_completion' }, 'owner');
    expect(hubItems(forOwner(db, 'u-bea'), now).some((i) => i.caseId === a)).toBe(false);
  });

  it('first date from the mechanic asks to confirm; every mechanic declining asks to choose another', () => {
    let db = createSeed(now);
    expect(hubItems(forOwner(db, 'u-dani'), now)[0]).toMatchObject({ label: 'Confirma tu cita', quick: { situation: 'confirm_appointment', screen: 'appointment' } });
    for (const r of forOwner(db, 'u-bea')) db = applyRequestAction(db, r.id, { type: 'reject_request', reason: 'Sin hueco' }, 'mechanic', now).db;
    const item = hubItems(forOwner(db, 'u-bea'), now)[0]!;
    expect(item).toMatchObject({ label: 'Elige un mecánico', pending: true, priority: 3, quick: { situation: 'choose_mechanic', href: `/solicitudes/${item.caseId}` } });
    // A week later it is no longer active.
    expect(hubItems(forOwner(db, 'u-bea'), new Date(now.getTime() + 8 * 24 * 3600_000))).toEqual([]);
  });

  it('is a + with nothing active, one message for one request, and a counter for the others', () => {
    const db = createSeed(now);
    expect(hubState(hubItems([], now))).toEqual({ kind: 'empty' });
    expect(hubState(hubItems(forOwner(db, 'u-dani'), now))).toMatchObject({ kind: 'single' });
    const diego = hubItems(forOwner(db, 'u-diego'), now);
    expect(diego.length).toBeGreaterThan(1);
    expect(hubState(diego)).toMatchObject({ kind: 'multiple', count: diego.length, top: diego[0] });
  });

  it('never puts a waiting state above one that needs the cyclist', () => {
    const db = createSeed(now);
    for (const u of db.users.filter((x) => x.role === 'owner')) {
      const items = hubItems(forOwner(db, u.id), now);
      const firstWaiting = items.findIndex((i) => !i.pending);
      if (firstWaiting >= 0) expect(items.slice(firstWaiting).every((i) => !i.pending), u.id).toBe(true);
      // Sorted by the shared ranking.
      expect([...items].sort(compareRanked).map((i) => i.caseId)).toEqual(items.map((i) => i.caseId));
    }
  });

  it('breaks ties by a real deadline, then by the oldest pending action', () => {
    const base = { priority: 2, order: 0 };
    expect(compareRanked({ ...base, at: '2026-10-10' }, { ...base, at: '2026-10-12' })).toBeLessThan(0);
    expect(compareRanked({ ...base, at: '2026-10-12', deadline: true }, { ...base, at: '2026-10-10' })).toBeLessThan(0);
    expect(compareRanked({ priority: 1, at: '2026-10-12' }, { priority: 2, at: '2026-10-01', deadline: true })).toBeLessThan(0);
  });

  it('agrees with Home ("Requiere tu atención") on what matters most', () => {
    const db = createSeed(now);
    const kindOf: Partial<Record<HubSituation, string>> = {
      incident: 'incident',
      confirm_delivery: 'confirm',
      work_finished: 'confirm',
      new_date: 'appointment',
      confirm_appointment: 'appointment',
      propose_date: 'appointment',
      quotes: 'proposal',
      quote: 'proposal',
      choose_mechanic: 'declined',
      message: 'clarify',
    };
    for (const u of db.users.filter((x) => x.role === 'owner')) {
      const top = hubItems(forOwner(db, u.id), now)[0];
      const home = cyclistAttention(forOwner(db, u.id), db.reviews, now)[0];
      if (!top?.pending) continue;
      expect(home, u.id).toBeTruthy();
      expect(home!.kind, u.id).toBe(kindOf[top.quick.situation]);
      expect(home!.request.caseId, u.id).toBe(top.caseId);
    }
  });
});

describe('test profiles: one cyclist per hub state', () => {
  it('each profile shows its state in the chip and opens the matching screen', () => {
    const db = createSeed(now);
    const expected: Record<string, [string, string]> = {
      'u-test': ['', ''],
      'u-bea': ['Buscando mecánicos', 'status'], // two requests (one per mechanic)
      'u-carla': ['Nuevo presupuesto recibido', 'compare'], // two requests, one quote each
      'u-dani': ['Confirma tu cita', 'appointment'],
      'u-eva': ['Reparación en curso', 'tracking'],
      'u-fran': ['Reparación terminada', 'completion'],
      'u-gema': ['Incidencia pendiente', 'incident'],
    };
    for (const [owner, [label, screen]] of Object.entries(expected)) {
      const state = hubState(hubItems(forOwner(db, owner), now));
      if (!label) expect(state.kind, owner).toBe('empty');
      else {
        const top = state.kind === 'single' ? state.item : state.kind === 'multiple' ? state.top : undefined;
        expect(top?.quick, owner).toMatchObject({ label, screen });
      }
    }
  });
});
