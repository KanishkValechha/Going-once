import { cn } from '@/lib/utils';

/** The "Going Once" broadcast wordmark — mono "GO" mark + condensed logotype. */
export function Wordmark({
  sub = 'AUCTION · LEAGUES · LIVE',
  size = 'sm',
  className,
}: {
  sub?: string | null;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const lg = size === 'lg';
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <span
        className={cn(
          'mono flex items-center justify-center rounded-[9px] bg-foreground font-black text-background',
          lg ? 'size-11 text-base' : 'size-[34px] text-[13px]',
        )}
      >
        GO
      </span>
      <div className="leading-none">
        <span
          className={cn(
            'block font-black tracking-[0.14em]',
            lg ? 'text-2xl' : 'text-base',
          )}
        >
          GOING ONCE
        </span>
        {sub && (
          <span
            className={cn(
              'mt-[3px] block font-semibold uppercase text-muted-foreground',
              lg ? 'text-[11px] tracking-[0.34em]' : 'text-[9.5px] tracking-[0.32em]',
            )}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
