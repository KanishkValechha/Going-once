'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Gavel, LayoutGrid, LogOut } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Wordmark } from '@/components/Wordmark';

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner label="Authenticating…" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <Gate
          title="Sign in to continue"
          body="You need to sign in to access the internal dashboard."
          action={
            <a href="/sign-in">
              <Button>Sign in</Button>
            </a>
          }
        />
      </Unauthenticated>
      <Authenticated>
        <InternalShell>{children}</InternalShell>
      </Authenticated>
    </div>
  );
}

function Gate({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Gavel className="size-6" />
        </div>
        <div>
          <h2 className="display text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        {action}
      </Card>
    </div>
  );
}

function InternalShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.currentUser);
  const { signOut } = useAuth();

  if (me === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );

  if (me?.role !== 'admin') {
    return (
      <Gate
        title="Internal access required"
        body="The internal dashboard is restricted to super-admins."
        action={
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="secondary">Go to admin</Button>
            </Link>
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/internal">
            <Wordmark sub="Internal" />
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <LayoutGrid className="size-4" /> Admin
              </Button>
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">{me.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </>
  );
}
