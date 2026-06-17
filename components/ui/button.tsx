import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]',
        secondary:
          'bg-surface-2 text-foreground border border-border hover:border-accent/60 hover:bg-surface-2/80 active:scale-[0.98]',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25 active:scale-[0.98]',
        outline:
          'border border-border bg-transparent hover:bg-surface-2 hover:border-accent/50 active:scale-[0.98]',
        ghost: 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base',
        xl: 'h-16 rounded-xl px-8 text-lg font-bold',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
