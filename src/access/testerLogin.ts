// Opens the prototype's access dialog from anywhere on the coming-soon page (the round
// button in the waitlist card). Decoupled with an event to avoid an import cycle.
const EVENT = 'cromiqa:open-tester-login';

export const openTesterLogin = () => window.dispatchEvent(new Event(EVENT));

export function onOpenTesterLogin(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
