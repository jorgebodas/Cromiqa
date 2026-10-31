// The shared test world stored in Supabase (table public.demo_world, see supabase/shared-demo.sql).
import type { DemoDatabase, LocationId } from '@/domain/types';
import { getAppSupabase } from './supabase';
import { WorldConflict, type WorldRow, type WorldStore } from './sharedBackend';

const WORLD_ID = 'main';

async function client() {
  const c = await getAppSupabase();
  if (!c) throw new Error('El entorno compartido no está configurado.');
  return c;
}

const explain = (message: string) =>
  /relation .*demo_world.* does not exist|schema cache/i.test(message)
    ? 'Falta crear la tabla del entorno de prueba en Supabase (supabase/shared-demo.sql).'
    : 'No se pudo conectar con el entorno de prueba. Revisa la conexión.';

export const supabaseWorld: WorldStore = {
  async load(): Promise<WorldRow | null> {
    const { data, error } = await (await client()).from('demo_world').select('data, version').eq('id', WORLD_ID).maybeSingle();
    if (error) throw new Error(explain(error.message));
    return data ? { data: data.data as DemoDatabase, version: Number(data.version) } : null;
  },
  async create(data) {
    const { error } = await (await client()).from('demo_world').insert({ id: WORLD_ID, data, version: 1 });
    // 23505: someone else created it first, which is fine.
    if (error && error.code !== '23505') throw new Error(explain(error.message));
  },
  async commit(expected, data) {
    const { data: version, error } = await (await client()).rpc('demo_world_commit', { p_id: WORLD_ID, p_expected: expected, p_data: data });
    if (error) {
      if (error.code === '40001' || /demo_world_conflict/.test(error.message)) throw new WorldConflict();
      throw new Error(explain(error.message));
    }
    return Number(version);
  },
  subscribe(onChange) {
    let off = () => {};
    void getAppSupabase().then((c) => {
      if (!c) return;
      const channel = c
        .channel('demo-world')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_world' }, () => onChange())
        .subscribe();
      off = () => void c.removeChannel(channel);
    });
    return () => off();
  },
};

/** Testers' accounts: email and password (Supabase Auth). */
export const testerAuth = {
  async session() {
    const { data } = await (await client()).auth.getSession();
    return data.session;
  },
  async signIn(email: string, password: string) {
    const { data, error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? 'Email o contraseña incorrectos.' : /not confirmed/i.test(error.message) ? 'Confirma tu email antes de entrar (revisa tu correo).' : error.message);
    return data.session!;
  },
  /** Returns null when the account still needs email confirmation. */
  async signUp(email: string, password: string, profile: { name: string; location: LocationId }) {
    const { data, error } = await (await client()).auth.signUp({ email: email.trim(), password, options: { data: profile } });
    if (error) {
      if (/signups not allowed|signup is disabled/i.test(error.message)) throw new Error('El registro de cuentas está desactivado. Pide al equipo que te cree una cuenta.');
      if (/already registered/i.test(error.message)) throw new Error('Ya existe una cuenta con ese email. Entra con tu contraseña.');
      if (/password/i.test(error.message)) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      throw new Error(error.message);
    }
    return data.session;
  },
  async signOut() {
    await (await client()).auth.signOut();
  },
};
