// A clean cyclist (the default account) and three "clean" test workshops for live tests: real-looking profiles with no requests, quotes
// or reviews yet, so a tester can follow one request end to end from both sides (switching
// account) without the demo scenarios getting in the way.
import type { Mechanic, User, WeeklyAvailability } from '@/domain/types';

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
