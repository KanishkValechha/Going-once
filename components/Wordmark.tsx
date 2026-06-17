import { Gavel } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The "Going Once" broadcast wordmark — gavel mark + condensed logotype. */
export function Wordmark({
  sub,
  size = 'sm',
  className,
}: {
  sub?: string;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-[0_0_24px_-6px_color-mix(in_oklch,var(--accent)_70%,transparent)]',
          size === 'sm' ? 'size-7' : 'size-10',
        )}
      >
        <Gavel className={size === 'sm' ? 'size-4' : 'size-5'} />
      </span>
      <div className="leading-none">
        <span
          className={cn(
            'display block tracking-wide',
            size === 'sm' ? 'text-lg' : 'text-2xl',
          )}
        >
          Going Once
        </span>
        {sub && (
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
