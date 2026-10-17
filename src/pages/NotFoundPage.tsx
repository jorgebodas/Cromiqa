import { Compass } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="container-page py-16">
      <EmptyState
        as="h1"
        icon={<Compass className="size-6" />}
        title="Esta página no existe"
        description="Puede que el enlace esté mal escrito o que la página se haya movido."
        action={<LinkButton to="/">Volver al inicio</LinkButton>}
      />
    </div>
  );
}
