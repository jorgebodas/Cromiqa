import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cx } from '@/components/ui';

/**
 * "Back" that respects where the user came from: steps back in history when they arrived
 * from inside the app, and goes to `fallback` when the page was opened directly by URL.
 */
export function BackLink({ fallback, children, className }: { fallback: string; children: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromApp = location.key !== 'default';
  return (
    <Link
      to={fallback}
      onClick={(e) => {
        if (!cameFromApp) return;
        e.preventDefault();
        navigate(-1);
      }}
      className={cx('inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink', className)}
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}
