import { cn } from '@/lib/utils';

/**
 * Square media tile for player photos / team logos, with a monogram fallback
 * built from the entity's name. Used across the console, managers and live screen.
 */
function AvatarImage({
  src,
  name,
  className,
  monogramClassName,
}: {
  src?: string | null;
  name: string;
  className?: string;
  monogramClassName?: string;
}) {
  const base = 'shrink-0 overflow-hidden rounded-xl bg-surface-2 object-cover';
  if (src) {
    return <img src={src} alt="" className={cn(base, className)} />;
  }
  return (
    <div
      className={cn(
        base,
        'flex items-center justify-center font-bold uppercase text-muted-foreground',
        className,
        monogramClassName,
      )}
    >
      {name.charAt(0)}
    </div>
  );
}

export { AvatarImage };
