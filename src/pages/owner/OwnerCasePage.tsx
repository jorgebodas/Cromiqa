import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, CircleCheckBig, Lightbulb, UserPlus, X } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { categoryLabel } from '@/domain/catalog';
import { currentProposal, isHired, MAX_RECIPIENTS_PER_SEND } from '@/domain/logic/requests';
import { CASE_STATUS_LABEL, caseStatus, leadThread, recoveryHint, threadHref } from '@/domain/logic/cases';
import { matchProviders } from '@/domain/logic/matching';
import { formatDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { RequestSummary } from '@/components/domain/RequestParts';
import { StatusBadge } from '@/components/domain/Status';
import { Avatar, Button, Dialog, EmptyState, Field, LinkButton, Textarea, cx } from '@/components/ui';
import { StepProviders } from './request/StepProviders';

/** One provider's answer, as a row of the comparison. */
function responseOf(r: ServiceRequest): { label: string; detail?: string; rank: number } {
  const p = currentProposal(r);
  if (r.status === 'proposal_received' && p?.status === 'pending')
    return { label: formatPrice(p.price), detail: `${formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${p.time}${r.proposals.length > 1 ? ` · versión ${r.proposals.length}` : ''}`, rank: 0 };
  if (r.openProposal && r.status === 'awaiting_proposal') return { label: 'Necesita aclarar algo', detail: 'Propuesta abierta · chat abierto', rank: 1 };
  if (r.status === 'sent' || r.status === 'awaiting_proposal') return { label: 'Pendiente de respuesta', rank: 2 };
  if (r.status === 'not_selected') return { label: 'No seleccionado', rank: 4 };
  if (r.status === 'cancelled') return { label: r.events.some((e) => e.type === 'rejected_by_mechanic') ? 'No puede atenderte' : 'Cancelada', rank: 3 };
  return { label: 'Contratado', rank: -1 };
}

const HINT_TEXT = {
  all_declined: 'Ninguno de los mecánicos invitados puede atenderte. Invita a otros o revisa la zona o la modalidad.',
  no_response: 'Aún no hay respuestas. Puedes invitar a más mecánicos sin perder las invitaciones enviadas.',
  no_quote: 'Todavía no tienes un presupuesto. Puedes invitar a más mecánicos o aclarar tu solicitud.',
} as const;

function InviteMoreDialog({ open, onClose, threads }: { open: boolean; onClose: () => void; threads: ServiceRequest[] }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const user = useCurrentUser();
  const inviteToCase = useApp((s) => s.inviteToCase);
  const toast = useApp((s) => s.toast);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const base = threads[0]!;
  const matches = useMemo(
    () =>
      matchProviders(mechanics, reviews, { category: base.category, bikeType: base.bike.type, mode: base.mode, location: base.location, description: base.description, excludeMechanicId: user?.mechanicId }).filter(
        (m) => !threads.some((r) => r.mechanicId === m.mechanic.id),
      ),
    [mechanics, reviews, base, threads, user?.mechanicId],
  );
  const send = async () => {
    if (!selected.length) return setError('Elige al menos un mecánico.');
    setBusy(true);
    try {
      const sent = await inviteToCase(base.caseId, selected);
      toast(sent.length === 1 ? 'Invitación enviada' : `${sent.length} invitaciones enviadas`);
      setSelected([]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invitar a más mecánicos"
      description={`Las invitaciones y presupuestos que ya tienes se mantienen. Hasta ${MAX_RECIPIENTS_PER_SEND} cada vez.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={send} loading={busy} disabled={matches.length === 0}>
            {selected.length > 1 ? `Invitar a ${selected.length}` : 'Invitar'}
          </Button>
        </>
      }
    >
      <StepProviders matches={matches} selected={selected} onChange={(ids) => (setSelected(ids), setError(undefined))} error={error} />
    </Dialog>
  );
}

function Inner() {
  const { id } = useParams();
  const user = useCurrentUser()!;
  const requests = useApp((s) => s.db.requests);
  const mechanics = useApp((s) => s.db.mechanics);
  const withdrawCase = useApp((s) => s.withdrawCase);
  const toast = useApp((s) => s.toast);
  const navigate = useNavigate();
  const [invite, setInvite] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Accept a case id, or any of its invitation ids (older links).
  const caseId = requests.find((r) => r.caseId === id)?.caseId ?? requests.find((r) => r.id === id)?.caseId;
  const threads = useMemo(() => requests.filter((r) => r.caseId === caseId && r.ownerId === user.id), [requests, caseId, user.id]);
  if (!threads.length) {
    return (
      <div className="container-page py-12">
        <EmptyState
          as="h1"
          icon={<X className="size-6" />}
          title="No encontramos esta solicitud"
          description="Puede que pertenezca a otra cuenta de la demo o que los datos se hayan restablecido."
          action={<LinkButton to="/solicitudes" variant="dark">Ver solicitudes</LinkButton>}
        />
      </div>
    );
  }
  if (id !== caseId) return <Navigate to={`/solicitudes/${caseId}`} replace />;

  const status = caseStatus(threads);
  const hired = threads.find(isHired);
  const lead = leadThread(threads);
  const hint = recoveryHint(threads);
  const open = status === 'searching' || status === 'proposals_received';
  const name = (r: ServiceRequest) => mechanics.find((m) => m.id === r.mechanicId)?.name ?? 'Mecánico';
  const rows = [...threads].sort((a, b) => {
    const ra = responseOf(a);
    const rb = responseOf(b);
    return ra.rank - rb.rank || (currentProposal(a)?.price ?? 0) - (currentProposal(b)?.price ?? 0);
  });
  const quotes = threads.filter((r) => r.status === 'proposal_received').length;

  const doWithdraw = async () => {
    setBusy(true);
    try {
      await withdrawCase(caseId!, reason.trim() || undefined);
      toast('Solicitud retirada');
      setWithdraw(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo retirar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Solicitud" back="/solicitudes" />
      <div className="container-page pb-8 sm:pb-10">
        <header className="mb-6">
          <p className="text-sm text-muted">
            {categoryLabel(lead.category)} · {threads.length === 1 ? '1 mecánico invitado' : `${threads.length} mecánicos invitados`}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl" data-testid="case-status">
            {CASE_STATUS_LABEL[status]}
          </h2>
          {status === 'proposals_received' && quotes > 1 && <p className="mt-1 text-muted">Compara los presupuestos y contrata a uno. Los demás se cerrarán.</p>}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {hired && (
              <Link to={threadHref(hired)} className="surface flex items-center gap-4 !bg-ink p-5 text-paper" data-testid="hired-card">
                <CircleCheckBig className="size-6 shrink-0 text-lime" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-paper/70">Servicio contratado</span>
                  <span className="block text-lg font-bold">{name(hired)}</span>
                  <span className="mt-1 inline-block">
                    <StatusBadge status={hired.status} />
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            )}

            {hint && open && (
              <div className="surface flex items-start gap-3 p-4" data-testid="recovery-hint">
                <Lightbulb className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p className="flex-1 text-[15px]">{HINT_TEXT[hint]}</p>
              </div>
            )}

            <section aria-labelledby="responses-title">
              <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                <h2 id="responses-title" className="font-display text-[19px] font-bold tracking-tight">
                  {hired ? 'Otros mecánicos' : 'Respuestas'}
                </h2>
                {open && !hired && (
                  <button type="button" onClick={() => setInvite(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                    <UserPlus className="size-4" aria-hidden /> Invitar a más
                  </button>
                )}
              </div>
              <ul className="surface divide-y divide-line overflow-hidden" data-testid="responses">
                {rows
                  .filter((r) => r.id !== hired?.id)
                  .map((r) => {
                    const res = responseOf(r);
                    const actionable = res.rank <= 1;
                    return (
                      <li key={r.id}>
                        <Link to={threadHref(r)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60" data-testid="response-row">
                          <Avatar name={name(r)} size="sm" className="size-10" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{name(r)}</span>
                            {res.detail && <span className="block truncate text-sm text-muted">{res.detail}</span>}
                          </span>
                          <span className={cx('shrink-0 text-right text-[15px]', actionable ? 'font-bold' : 'text-muted', res.rank === 0 && 'font-display text-lg')}>{res.label}</span>
                          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <RequestSummary request={lead} />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            {open && !hired && (
              <>
                <Button block onClick={() => setInvite(true)} icon={<UserPlus className="size-4" aria-hidden />}>
                  Invitar a más mecánicos
                </Button>
                <Button block variant="secondary" onClick={() => setWithdraw(true)}>
                  Retirar solicitud
                </Button>
              </>
            )}
            <p className="px-1 text-xs text-muted">Nada se contrata hasta que aceptas un presupuesto. Aceptar no supone ningún pago en la demo.</p>
          </aside>
        </div>

        {open && <InviteMoreDialog open={invite} onClose={() => setInvite(false)} threads={threads} />}
        <Dialog
          open={withdraw}
          onClose={() => setWithdraw(false)}
          title="Retirar solicitud"
          description="Se cerrarán todas las invitaciones y no podrás contratar desde esta solicitud. Sin penalización."
          footer={
            <>
              <Button variant="ghost" onClick={() => setWithdraw(false)}>
                Volver
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={async () => {
                  await doWithdraw();
                  navigate(`/solicitudes/${caseId}`, { replace: true });
                }}
              >
                Retirar solicitud
              </Button>
            </>
          }
        >
          <Field label="Motivo" optional hint="Se lo haremos saber a los mecánicos.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Dialog>
      </div>
    </>
  );
}

/**
 * The cyclist's request hub: every invited provider and their answer (quotes side by side,
 * open proposals, pending, declined), the hired service once there is one, recovery
 * suggestions, inviting more providers and withdrawing.
 */
export function OwnerCasePage() {
  return (
    <RoleGate role="owner">
      <Inner />
    </RoleGate>
  );
}
