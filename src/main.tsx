import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { AccessGate } from './access/AccessGate';
import { useApp } from './state/store';

const root = createRoot(document.getElementById('root')!);

// Hydrate demo data before the first render so screens never flash empty states.
useApp
  .getState()
  .init()
  .finally(() => {
    root.render(
      <StrictMode>
        <AccessGate>
          <App />
        </AccessGate>
      </StrictMode>,
    );
  });
