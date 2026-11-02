// A clean cyclist (the default account) and three "clean" test workshops for live tests: real-looking profiles with no requests, quotes
// or reviews yet, so a tester can follow one request end to end from both sides (switching
// account) without the demo scenarios getting in the way.
import type { Mechanic, Proposal, RequestEvent, ServiceRequest, User, WeeklyAvailability } from '@/domain/types';
import { toISODate } from '@/domain/utils';

const week = (slots: WeeklyAvailability['slots'], days: number[]): WeeklyAvailability[] => days.map((d) => ({ day: d as WeeklyAvailability['day'], slots }));

/** A fresh demo starts signed in as this clean cyclist (no requests, no bikes). */
export const DEFAULT_TEST_USER = 'u-test';

export function testWorkshops(): { users: User[]; mechanics: Mechanic[] } {
  const users: User[] = [
    // The default account of a fresh demo: a cyclist with nothing yet, so the Request Hub starts as a +.
    { id: DEFAULT_TEST_USER, name: 'Álex Moreno', role: 'owner', email: 'alex@demo.cromiqa.com', location: 'rivas', demoBlurb: 'Ciclista de prueba · sin solicitudes' },
    { id: 'u-t1', name: 'Rafa Gómez', role: 'mechanic', mechanicId: 'm-t1', email: 'taller1@demo.cromiqa.com', location: 'madrid-centro', demoBlurb: 'Mecánico de prueba · sin solicitudes · Madrid' },
    { id: 'u-t2', name: 'Laura Prieto', role: 'mechanic', mechanicId: 'm-t2', email: 'taller2@demo.cromiqa.com', location: 'rivas', demoBlurb: 'Mecánica de prueba · sin solicitudes · a domicilio' },
    { id: 'u-t3', name: 'Sergio Lara', role: 'mechanic', mechanicId: 'm-t3', email: 'taller3@demo.cromiqa.com', location: 'coslada', demoBlurb: 'Mecánico de prueba · sin solicitudes · Coslada' },
  ];
  const base = {
    yearsExperience: 8,
    avatarTone: '#E4E1D8',
    responseTime: 'Responde en 24 h o menos',
    languages: ['Español'],
    demoVerified: false,
    listing: 'active' as const,
    portfolio: [],
  };
  const mechanics: Mechanic[] = [
    {
      ...base,
      id: 'm-t1',
      userId: 'u-t1',
      name: 'Rafa Gómez',
      businessName: 'Taller Centro (prueba)',
      headline: 'Carretera, urbana y puesta a punto',
      bio: 'Taller de prueba de Cromiqa, sin solicitudes previas. Trabaja en el centro de Madrid y se desplaza al este de la ciudad.',
      baseLocation: 'madrid-centro',
      workshopArea: 'Madrid Centro (zona aproximada)',
      workshop: true,
      homeService: true,
      homeServiceFee: 12,
      serviceAreas: ['madrid-centro', 'madrid-vallecas', 'madrid-moratalaz'],
      bikeTypes: ['road', 'urban', 'folding', 'gravel', 'mtb'],
      specializations: ['road', 'transmission', 'wheels', 'urban'],
      services: [
        { id: 's-t1a', category: 'repair', name: 'Reparación general', description: 'Cambios, frenos, ruedas y pinchazos.', priceFrom: 20 },
        { id: 's-t1b', category: 'maintenance', name: 'Puesta a punto', description: 'Revisión completa con ajuste de transmisión y frenos.', priceFrom: 50 },
        { id: 's-t1c', category: 'diagnosis', name: 'Diagnóstico', description: 'Revisión y presupuesto cerrado.', priceFrom: 15 },
        { id: 's-t1d', category: 'inspection', name: 'Inspección pre-compra', description: 'Revisión de una bici usada antes de comprarla.', priceFrom: 35 },
      ],
      weeklyAvailability: week(['morning', 'afternoon'], [0, 1, 2, 3, 4]),
      availabilityNote: 'De lunes a viernes, mañana y tarde.',
    },
    {
      ...base,
      id: 'm-t2',
      userId: 'u-t2',
      name: 'Laura Prieto',
      businessName: 'Bici a Domicilio (prueba)',
      headline: 'Mecánica a domicilio: MTB, gravel y eléctricas',
      bio: 'Taller de prueba de Cromiqa, sin solicitudes previas. Solo a domicilio, por el sureste de Madrid.',
      baseLocation: 'rivas',
      workshop: false,
      homeService: true,
      homeServiceFee: 10,
      serviceAreas: ['rivas', 'arganda', 'coslada', 'san-fernando', 'mejorada', 'velilla', 'madrid-vallecas'],
      bikeTypes: ['mtb', 'gravel', 'road', 'ebike', 'urban'],
      specializations: ['brakes', 'ebike', 'wheels'],
      services: [
        { id: 's-t2a', category: 'repair', name: 'Reparación a domicilio', description: 'Frenos, cambios, pinchazos y ajustes.', priceFrom: 25 },
        { id: 's-t2b', category: 'maintenance', name: 'Mantenimiento', description: 'Puesta a punto completa.', priceFrom: 55 },
        { id: 's-t2c', category: 'diagnosis', name: 'Diagnóstico', description: 'Te digo qué le pasa y cuánto cuesta.', priceFrom: 15 },
      ],
      weeklyAvailability: [...week(['afternoon', 'evening'], [0, 1, 2, 3, 4]), { day: 5, slots: ['morning'] }],
      availabilityNote: 'Tardes entre semana y sábados por la mañana.',
    },
    {
      ...base,
      id: 'm-t3',
      userId: 'u-t3',
      name: 'Sergio Lara',
      businessName: 'Taller Este (prueba)',
      headline: 'Todo tipo de bicis, también eléctricas',
      bio: 'Taller de prueba de Cromiqa, sin solicitudes previas. Taller en Coslada; a domicilio por la zona.',
      baseLocation: 'coslada',
      workshopArea: 'Coslada (zona aproximada)',
      workshop: true,
      homeService: true,
      homeServiceFee: 8,
      serviceAreas: ['coslada', 'san-fernando', 'madrid-moratalaz', 'rivas'],
      bikeTypes: ['mtb', 'road', 'gravel', 'urban', 'ebike', 'folding'],
      specializations: ['ebike', 'transmission', 'restoration'],
      services: [
        { id: 's-t3a', category: 'repair', name: 'Reparación', description: 'Cualquier avería, también eléctricas.', priceFrom: 20 },
        { id: 's-t3b', category: 'maintenance', name: 'Revisión completa', description: 'Puesta a punto con informe.', priceFrom: 45 },
        { id: 's-t3c', category: 'inspection', name: 'Inspección pre-compra', description: 'Antes de comprar una bici usada.', priceFrom: 30 },
        { id: 's-t3d', category: 'diagnosis', name: 'Diagnóstico', description: 'Si no sabes qué le pasa.', priceFrom: 10 },
      ],
      weeklyAvailability: week(['morning', 'afternoon', 'evening'], [0, 1, 2, 3, 4, 5]),
      availabilityNote: 'De lunes a sábado.',
    },
  ];
  return { users, mechanics };
}

/**
 * One cyclist per Request Hub state, each with a single request handled by the clean workshops,
 * so switching account shows that state in the chip (and the mechanic's side of it).
 */
export function stateProfiles(now: Date): { users: User[]; requests: ServiceRequest[] } {
  const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600_000).toISOString();
  const day = (offset: number) => toISODate(new Date(now.getTime() + offset * 86_400_000));
  const ev = (id: string, type: RequestEvent['type'], by: RequestEvent['by'], hoursAgo: number, text?: string): RequestEvent => ({ id, type, by, at: iso(hoursAgo), text });
  const quote = (id: string, price: number, dateOffset: number, time: string, message: string, status: Proposal['status'], hoursAgo: number): Proposal => ({
    id,
    price,
    date: day(dateOffset),
    time,
    message,
    status,
    createdAt: iso(hoursAgo),
  });
  const base = (id: string, code: number, ownerId: string, mechanicId: string) => ({
    id,
    code: `CRQ-${code}`,
    ownerId,
    mechanicId,
    location: 'rivas' as const,
    mode: 'home' as const,
    availability: { timeSlots: ['afternoon' as const], flexible: true },
  });
  const done = (r: Omit<ServiceRequest, 'updatedAt'>): ServiceRequest => ({ ...r, updatedAt: r.events[r.events.length - 1]!.at });

  const person = (id: string, name: string, state: string): User => ({ id, name, role: 'owner', email: `${id.slice(2)}@demo.cromiqa.com`, location: 'rivas', demoBlurb: `Prueba · ${state}` });
  const users: User[] = [
    person('u-bea', 'Bea Ortiz', 'esperando respuesta (2 solicitudes)'),
    person('u-carla', 'Carla Núñez', '2 presupuestos (2 solicitudes)'),
    person('u-dani', 'Dani Ríos', 'confirmar cita'),
    person('u-eva', 'Eva Soler', 'en curso'),
    person('u-fran', 'Fran Gil', 'confirmar servicio'),
    person('u-gema', 'Gema Vidal', 'incidencia abierta'),
  ];

  const requests: ServiceRequest[] = [
    // Bea: sent to Laura and Sergio, no answers yet.
    ...(['m-t2', 'm-t3'] as const).map((m, i) =>
      done({
        ...base(`r-bea-${i}`, 2001 + i, 'u-bea', m),
        category: 'repair',
        description: 'Los cambios saltan en los piñones grandes.',
        bike: { type: 'mtb', brand: 'Orbea', model: 'Onna' },
        status: 'sent',
        proposals: [],
        events: [ev(`e-bea-${i}`, 'created', 'owner', 3)],
        createdAt: iso(3),
      }),
    ),
    // Carla: two closed quotes to compare.
    ...(
      [
        ['m-t2', 45, 'Purgo los frenos y reviso pastillas en tu casa.'],
        ['m-t3', 55, 'Purgado, pastillas nuevas y ajuste. En taller o a domicilio.'],
      ] as const
    ).map(([m, price, msg], i) =>
      done({
        ...base(`r-carla-${i}`, 2003 + i, 'u-carla', m),
        category: 'repair',
        description: 'El freno trasero apenas frena y chirría.',
        bike: { type: 'gravel', brand: 'Canyon', model: 'Grail' },
        status: 'proposal_received',
        proposals: [quote(`pr-carla-${i}`, price, 2, '18:00', msg, 'pending', 2)],
        events: [ev(`e-carla-${i}a`, 'created', 'owner', 26), ev(`e-carla-${i}b`, 'proposal_sent', 'mechanic', 2, msg)],
        createdAt: iso(26),
      }),
    ),
    // Dani: hired Laura; she proposed a date he hasn't confirmed.
    done({
      ...base('r-dani', 2005, 'u-dani', 'm-t2'),
      category: 'maintenance',
      description: 'Puesta a punto antes de una ruta larga.',
      bike: { type: 'road', brand: 'Specialized', model: 'Tarmac' },
      status: 'confirmed',
      proposals: [{ ...quote('pr-dani', 60, 3, '17:30', 'Puesta a punto completa en tu casa.', 'accepted', 20), respondedAt: iso(18) }],
      appointment: { pending: { date: day(3), time: '17:30', by: 'mechanic', at: iso(18) } },
      events: [ev('e-dani-a', 'created', 'owner', 30), ev('e-dani-b', 'proposal_sent', 'mechanic', 20), ev('e-dani-c', 'proposal_accepted', 'owner', 18)],
      createdAt: iso(30),
    }),
    // Eva: Sergio is working on it now.
    done({
      ...base('r-eva', 2006, 'u-eva', 'm-t3'),
      category: 'repair',
      description: 'La eléctrica pierde asistencia en las cuestas.',
      bike: { type: 'ebike', brand: 'Haibike', model: 'Trekking 6' },
      status: 'in_progress',
      proposals: [{ ...quote('pr-eva', 40, 0, '10:00', 'Diagnóstico con software y revisión del conector.', 'accepted', 50), respondedAt: iso(48) }],
      appointment: { confirmed: { date: day(0), time: '10:00', confirmedAt: iso(47) } },
      events: [
        ev('e-eva-a', 'created', 'owner', 52),
        ev('e-eva-b', 'proposal_sent', 'mechanic', 50),
        ev('e-eva-c', 'proposal_accepted', 'owner', 48),
        ev('e-eva-d', 'appointment_confirmed', 'owner', 47, `${day(0)} 10:00`),
        ev('e-eva-e', 'started', 'mechanic', 1),
      ],
      createdAt: iso(52),
    }),
    // Fran: Laura finished; waiting for his confirmation.
    done({
      ...base('r-fran', 2007, 'u-fran', 'm-t2'),
      category: 'repair',
      description: 'Pinchazo y cubierta gastada.',
      bike: { type: 'urban', brand: 'Brompton', model: 'C Line' },
      status: 'awaiting_completion',
      proposals: [{ ...quote('pr-fran', 25, -1, '12:00', 'Cámara y cubierta nuevas.', 'accepted', 40), respondedAt: iso(38) }],
      appointment: { confirmed: { date: day(-1), time: '12:00', confirmedAt: iso(37) } },
      completionSummary: 'Cámara y cubierta trasera nuevas. Presiones ajustadas.',
      finishedAt: iso(5),
      events: [
        ev('e-fran-a', 'created', 'owner', 44),
        ev('e-fran-b', 'proposal_sent', 'mechanic', 40),
        ev('e-fran-c', 'proposal_accepted', 'owner', 38),
        ev('e-fran-d', 'appointment_confirmed', 'owner', 37, `${day(-1)} 12:00`),
        ev('e-fran-e', 'started', 'mechanic', 8),
        ev('e-fran-f', 'work_finished', 'mechanic', 5, 'Cámara y cubierta trasera nuevas. Presiones ajustadas.'),
      ],
      createdAt: iso(44),
    }),
    // Gema: Sergio finished, she reported a problem (incident open) and Sergio answered.
    done({
      ...base('r-gema', 2008, 'u-gema', 'm-t3'),
      category: 'repair',
      description: 'Ruido en el pedalier al apretar.',
      bike: { type: 'mtb', brand: 'Trek', model: 'Marlin 7' },
      status: 'awaiting_completion',
      proposals: [{ ...quote('pr-gema', 35, -2, '18:00', 'Limpieza y engrase del pedalier.', 'accepted', 70), respondedAt: iso(68) }],
      appointment: { confirmed: { date: day(-2), time: '18:00', confirmedAt: iso(67) } },
      completionSummary: 'Pedalier desmontado, limpio y engrasado.',
      finishedAt: iso(30),
      incidents: [{ text: 'El ruido ha vuelto a los dos días.', openedAt: iso(4) }],
      events: [
        ev('e-gema-a', 'created', 'owner', 72),
        ev('e-gema-b', 'proposal_sent', 'mechanic', 70),
        ev('e-gema-c', 'proposal_accepted', 'owner', 68),
        ev('e-gema-d', 'appointment_confirmed', 'owner', 67, `${day(-2)} 18:00`),
        ev('e-gema-e', 'started', 'mechanic', 32),
        ev('e-gema-f', 'work_finished', 'mechanic', 30, 'Pedalier desmontado, limpio y engrasado.'),
        ev('e-gema-g', 'incident_opened', 'owner', 4, 'El ruido ha vuelto a los dos días.'),
        // Sergio answered: now it's Gema's turn (check it and close the incident when it's fixed).
        ev('e-gema-h', 'message', 'mechanic', 3, 'Lo siento. Paso mañana a revisarlo sin coste: ¿te va bien a las 18:00?'),
      ],
      createdAt: iso(72),
    }),
  ];
  return { users, requests };
}
