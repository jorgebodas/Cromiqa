import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, RotateCcw, Trash2, UserRound, Wrench } from 'lucide-react';
import { gateEnabled, lockDevice } from '@/access/AccessGate';
import { isEmail, leadsEnabled, requestLeadActivation } from '@/marketing/leads';
import type { ID } from '@/domain/types';
import { STATUS_ORDER, STATUSES, categoryLabel } from '@/domain/catalog';
import { relativeTime } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { StatusBadge } from '@/components/domain/Status';
import { Avatar, Badge, Button, Card, Dialog, Field, Input, cx } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { threadHref } from '@/domain/logic/cases';

const SCENARIOS: { id: string; title: string; steps: string; start: { label: string; user?: ID | null; to: string } }[] = [
  {
    id: 'A',
    title: 'Solicitud de reparación',
    steps: 'Inicio → Reparación → describe que los cambios saltan → MTB → A domicilio en Rivas → elige mecánico → envía → Solicitudes.',
    start: { label: 'Empezar como Ana', user: 'u-ana', to: '/' },
  },
  {
    id: 'B',
    title: 'Respuesta del mecánico',
    steps: 'Cambia al mecánico → abre la solicitud nueva → acepta para valorar → propone precio y cita → vuelve a la propietaria → acepta → “Confirmada”.',
    start: { label: 'Abrir como Carlos', user: 'u-carlos', to: '/pro/solicitudes?estado=nuevas' },
  },
  {
    id: 'C',
    title: 'Trabajo completado',
    steps: 'Como mecánico: “Marcar en curso” → “Marcar como completado”. Como propietaria: ver la solicitud completada y el registro en “Mi garaje”.',
    start: { label: 'Abrir agenda de Carlos', user: 'u-carlos', to: '/pro/solicitudes?estado=agenda' },
  },
  {
    id: 'D',
    title: 'Buscar un mecánico',
    steps: 'Busca “suspensión” → filtra “Domicilio” → revisa resultados → abre un perfil → “Solicitar servicio”.',
    start: { label: 'Ir a la búsqueda', to: '/mecanicos' },
  },
  {
    id: 'E',
    title: 'Inspección antes de comprar',
    steps: 'Inicio → “Inspección antes de comprar” → datos de la bici usada → mecánico que inspeccione → envía y revisa su estado.',
    start: { label: 'Empezar como Pablo', user: 'u-pablo', to: '/' },
  },
];

function storageSizeKb() {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith('cromiqa:')) total += (localStorage.getItem(key)?.length ?? 0) * 2;
    }
    return Math.round(total / 1024);
  } catch {
    return 0;
  }
}

function LeadActivation() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ tone: 'ok' | 'error'; text: string }>();
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!isEmail(email)) return setState({ tone: 'error', text: 'Escribe un email válido.' });
    setSending(true);
    setState(undefined);
    try {
      await requestLeadActivation(email);
      setState({ tone: 'ok', text: 'Enviado. Revisa tu bandeja (y spam): FormSubmit te pedirá confirmar y te dará un alias aleatorio.' });
      setEmail('');
    } catch (e) {
      setState({ tone: 'error', text: `No se pudo enviar (${e instanceof Error ? e.message : 'error'}). Inténtalo de nuevo.` });
    } finally {
      setSending(false);
    }
  };
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-bold">Formularios de la página “Próximamente”</h2>
      <p className="mt-1 text-sm text-muted">
        Estado: {leadsEnabled ? 'activos y visibles para el público.' : 'ocultos hasta configurar el alias de FormSubmit.'} Para
        activarlos sin publicar tu email, envía aquí la activación. El email no se guarda.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Email donde recibir los registros" className="flex-1">
          <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} name="activation-email" />
        </Field>
        <Button variant="dark" className="h-12" loading={sending} onClick={send}>
          Enviar activación
        </Button>
      </div>
      {state && (
        <p role={state.tone === 'error' ? 'alert' : 'status'} className={cx('mt-3 text-sm', state.tone === 'error' ? 'text-danger' : 'text-success')}>
          {state.text}
        </p>
      )}
    </Card>
  );
}

export function DemoPanelPage() {
  const db = useApp((s) => s.db);
  const sessionUserId = useApp((s) => s.sessionUserId);
  const resetDemo = useApp((s) => s.resetDemo);
  const toast = useApp((s) => s.toast);
  const switchAccount = useSwitchAccount();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<'scenarios' | 'full' | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const statusCounts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, db.requests.filter((r) => r.status === s).length])), [db.requests]);
  const requests = [...db.requests]
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const name = (id: ID) => db.users.find((u) => u.id === id)?.name ?? '—';
  const mechanicOf = (id: ID) => db.mechanics.find((m) => m.id === id);

  const doReset = async () => {
    setBusy(true);
    await resetDemo({ keepSession: confirm === 'scenarios' });
    setBusy(false);
    setConfirm(null);
    toast(confirm === 'scenarios' ? 'Escenarios de ejemplo restaurados' : 'Demo restablecida desde cero');
    if (confirm === 'full') navigate('/');
  };

  const owners = db.users.filter((u) => u.role === 'owner');
  const mechanics = db.users.filter((u) => u.role === 'mechanic');

  return (
    <>
      <ScreenHeader
        title="Demo"
        compactTitle="Demo"
        description="Herramienta interna para probar el prototipo: cambia de cuenta, inspecciona solicitudes y restablece los datos. Nada de esto existe en producción."
      />
      <div className="container-page pb-8 sm:pb-10">

      <section aria-labelledby="accounts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[
          { title: 'Propietarios', icon: UserRound, list: owners },
          { title: 'Mecánicos', icon: Wrench, list: mechanics },
        ].map((group) => (
          <Card key={group.title} className="p-5">
            <h2 id={group.title === 'Propietarios' ? 'accounts' : undefined} className="flex items-center gap-2 font-bold">
              <group.icon className="size-4" aria-hidden /> {group.title}
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {group.list.map((u) => {
                const count = db.requests.filter((r) => r.ownerId === u.id || (u.mechanicId && r.mechanicId === u.mechanicId)).length;
                const active = u.id === sessionUserId;
                return (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={u.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {u.name} {active && <Badge tone="ink" className="ml-1">Activa</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.demoBlurb} · {count} solicitudes
                      </p>
                    </div>
                    <Button size="sm" variant={active ? 'ghost' : 'secondary'} disabled={active} onClick={() => switchAccount(u.id, { to: u.role === 'mechanic' ? '/pro' : '/solicitudes' })}>
                      {active ? 'En uso' : 'Usar'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </section>
      <div className="mt-3">
        <Button variant="ghost" size="sm" disabled={sessionUserId === null} onClick={() => switchAccount(null, { to: '/' })}>
          Navegar como invitado
        </Button>
      </div>

      <section aria-labelledby="scenarios" className="mt-12">
        <h2 id="scenarios" className="mb-4 text-lg font-bold">Escenarios de prueba</h2>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((s) => (
            <li key={s.id} className="surface flex flex-col p-5">
              <p className="font-display text-sm font-bold text-muted">Escenario {s.id}</p>
              <h3 className="mt-1 font-bold">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{s.steps}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4 self-start"
                onClick={() => (s.start.user !== undefined && s.start.user !== sessionUserId ? switchAccount(s.start.user, { to: s.start.to }) : navigate(s.start.to))}
              >
                {s.start.label}
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="requests" className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="requests" className="text-lg font-bold">
            Todas las solicitudes ({db.requests.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setStatusFilter('all')} className={cx('h-8 rounded-full border px-3 text-xs font-medium', statusFilter === 'all' ? 'border-ink bg-ink text-paper' : 'border-line-strong')}>
              Todas
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cx('h-8 rounded-full border px-3 text-xs font-medium', statusFilter === s ? 'border-ink bg-ink text-paper' : 'border-line-strong')}
              >
                {STATUSES[s].label} · {statusCounts[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="surface relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="demo-requests-table">
            <thead className="bg-sand text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Servicio</th>
                <th className="px-4 py-3 font-semibold">Propietario</th>
                <th className="px-4 py-3 font-semibold">Mecánico</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Actualizada</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((r) => {
                const m = mechanicOf(r.mechanicId);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.code}</td>
                    <td className="px-4 py-3">{categoryLabel(r.category)}</td>
                    <td className="px-4 py-3">{name(r.ownerId)}</td>
                    <td className="px-4 py-3">{m?.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-muted">{relativeTime(r.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => switchAccount(r.ownerId, { to: threadHref(r) })}>
                          Como cliente
                        </Button>
                        {m && (
                          <Button size="sm" variant="ghost" onClick={() => switchAccount(m.userId, { to: `/pro/solicitudes/${r.id}` })}>
                            Como mecánico
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <LeadActivation />
      </section>

      <section aria-labelledby="reset" className="mt-12">
        <Card className="p-5 sm:p-6">
          <h2 id="reset" className="font-bold">Datos de la demo</h2>
          <p className="mt-1 text-sm text-muted">
            Se guardan en el LocalStorage de este navegador ({storageSizeKb()} KB). {db.mechanics.length} mecánicos, {owners.length} propietarios, {db.bikes.length} bicis,{' '}
            {db.requests.length} solicitudes, {db.reviews.length} reseñas.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button variant="dark" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setConfirm('scenarios')}>
              Restaurar escenarios de ejemplo
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirm('full')} data-testid="reset-demo">
              Reset demo (todo)
            </Button>
            {gateEnabled && (
              <Button variant="secondary" icon={<Lock className="size-4" aria-hidden />} onClick={lockDevice}>
                Bloquear este dispositivo
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            “Restaurar escenarios” recupera los datos originales y mantiene la cuenta activa. “Reset demo” además vuelve a modo invitado y borra borradores.
          </p>
        </Card>
      </section>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'full' ? '¿Restablecer toda la demo?' : '¿Restaurar los escenarios de ejemplo?'}
        description="Se perderán las solicitudes, bicis y cambios de perfil creados durante la prueba."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant={confirm === 'full' ? 'danger' : 'dark'} loading={busy} onClick={doReset} data-testid="confirm-reset">
              {confirm === 'full' ? 'Restablecer todo' : 'Restaurar escenarios'}
            </Button>
          </>
        }
      >
        <p className="text-sm">Esta acción solo afecta a este navegador.</p>
      </Dialog>
      </div>
    </>
  );
}
