import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide w-fit whitespace-nowrap shrink-0 [&>svg]:size-3',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-2 text-muted-foreground border-border',
        accent: 'bg-accent/15 text-accent border-accent/40',
        positive: 'bg-positive/15 text-positive border-positive/40',
        destructive: 'bg-destructive/15 text-destructive border-destructive/40',
        warning: 'bg-warning/15 text-warning border-warning/40',
        live: 'bg-live/15 text-live border-live/50',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
