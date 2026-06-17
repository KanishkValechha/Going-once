'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl',
          description: 'text-muted-foreground',
          actionButton: 'bg-accent text-accent-foreground',
          cancelButton: 'bg-surface-2 text-muted-foreground',
          error: 'border-destructive/50',
          success: 'border-positive/50',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
