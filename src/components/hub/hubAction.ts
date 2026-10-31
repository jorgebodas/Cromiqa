import { createContext, useContext, type MutableRefObject } from 'react';

/** What the hub's primary button (the + stretched) shows while a view is open. */
export interface HubPrimaryMeta {
  label: string;
  icon: 'arrow' | 'send' | 'plus';
  loading?: boolean;
  /** Whether the header shows a back button that calls `backRef`. */
  canBack: boolean;
  /** Required fields still empty: the button looks disabled (but still says what's missing). */
  disabled?: boolean;
  /** Shown above the button after a try with something missing. */
  missing?: string;
}

/**
 * Lets the view inside the hub (the request form) drive the hub's own bottom row: the label of
 * the primary button and what it does, and the back button. Handlers live in refs so they're
 * always current without re-rendering the hub on every keystroke.
 */
export interface HubActionApi {
  runRef: MutableRefObject<() => void>;
  backRef: MutableRefObject<() => void>;
  setMeta(meta: HubPrimaryMeta | null): void;
}

export const HubActionContext = createContext<HubActionApi | null>(null);
export const useHubAction = () => useContext(HubActionContext);
