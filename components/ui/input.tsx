import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-lg border border-input bg-surface-2 px-3 py-2 text-sm transition-colors outline-none',
        'placeholder:text-muted-foreground/70',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40',
        'file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-border',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
