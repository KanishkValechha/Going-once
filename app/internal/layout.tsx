'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { api } from '@/convex/_generated/api';
import { Button, Card, Spinner } from '@/components/ui';

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AuthLoading>
        <Spinner />
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center">
          <Card className="text-center">
            <p className="mb-3 text-muted">You need to sign in to access the internal dashboard.</p>
            <a href="/sign-in">
              <Button>Sign in</Button>
            </a>
          </Card>
        </div>
      </Unauthenticated>
      <Authenticated>
        <InternalShell>{children}</InternalShell>
      </Authenticated>
    </div>
  );
}

function InternalShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.currentUser);
  const { signOut } = useAuth();

  if (me === undefined) return <Spinner />;

  if (me?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold">Internal access required</h2>
          <p className="mb-4 text-sm text-muted">
            The internal dashboard is restricted to super-admins.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/admin">
              <Button variant="secondary">Go to admin</Button>
            </Link>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <Link href="/internal" className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">Going Once</span>
          <span className="text-xs text-muted">Internal</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin" className="text-muted transition hover:text-foreground">
            Admin
          </Link>
          <span className="text-muted">{me.email}</span>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </>
  );
}
