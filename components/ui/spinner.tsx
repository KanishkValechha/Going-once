import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2Icon className="size-5 animate-spin text-accent" />
      {label && <span>{label}</span>}
    </div>
  );
}

export { Spinner };
