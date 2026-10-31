import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/state/store';
import { Button, EmptyState } from '@/components/ui';

class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // Integration point: report to an error tracker in production.
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container-page py-12" role="alert">
        <EmptyState
          as="h1"
          icon={<TriangleAlert className="size-6" />}
          title="Algo ha fallado en esta pantalla"
          description="No has perdido nada: tus datos siguen guardados. Prueba a recargar; si se repite, restablece los datos de la demo."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()}>Recargar</Button>
              <Button variant="secondary" onClick={this.props.onReset}>
                Restablecer demo
              </Button>
            </div>
          }
        />
      </div>
    );
  }
}

/** Keeps a crash in one screen from blanking the app; navigating elsewhere clears it. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const resetDemo = useApp((s) => s.resetDemo);
  return (
    <Boundary key={loc.pathname} onReset={() => void resetDemo({ keepSession: true }).then(() => window.location.reload())}>
      {children}
    </Boundary>
  );
}
