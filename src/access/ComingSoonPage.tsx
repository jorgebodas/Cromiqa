import { BadgeCheck, ReceiptText, ScanSearch } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';

const POINTS = [
  { icon: ScanSearch, title: 'Empiezas por el problema', text: 'Cuéntanos qué le pasa a tu bici y te mostramos quién puede ayudarte.' },
  { icon: ReceiptText, title: 'Precios claros', text: 'Precios orientativos antes de pedir nada. Sin sorpresas.' },
  { icon: BadgeCheck, title: 'Mecánicos de confianza', text: 'Talleres y mecánicos independientes cerca de ti, a domicilio o en taller.' },
];

/** Public face of cromiqa.com while the product is private. */
export function ComingSoonPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="container-page flex h-20 items-center">
        <Wordmark className="text-2xl" />
      </header>

      <main className="flex flex-1 items-center">
        <div className="container-page py-12 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium">
            <span className="size-2 rounded-full bg-lime ring-2 ring-ink/80" aria-hidden />
            Próximamente · Madrid sureste
          </p>
          <h1 className="mt-6 max-w-3xl text-[2.75rem] font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
            Tu bici, en buenas manos.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Cromiqa conecta a ciclistas con mecánicos de confianza cerca de ti. Reparaciones, mantenimiento e inspecciones antes de
            comprar una bici de segunda mano, sin complicaciones.
          </p>

          <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {POINTS.map((p) => (
              <li key={p.title} className="rounded-3xl bg-sand p-6">
                <p.icon className="size-5" aria-hidden />
                <h2 className="mt-5 font-bold">{p.title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="container-page flex flex-col gap-1 py-6 text-sm text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Cromiqa</p>
          <p>Rivas-Vaciamadrid · Arganda del Rey · Coslada · Madrid</p>
        </div>
      </footer>
    </div>
  );
}
