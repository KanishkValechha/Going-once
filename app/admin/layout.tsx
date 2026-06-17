'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Gavel, LogOut, ShieldHalf } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Wordmark } from '@/components/Wordmark';

export default function AdminLayout({ children }: { children: ReactNode }) {
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
          body="You need to sign in to access the admin portal."
          action={
            <a href="/sign-in">
              <Button>Sign in</Button>
            </a>
          }
        />
      </Unauthenticated>
      <Authenticated>
        <AdminShell>{children}</AdminShell>
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

function AdminShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.currentUser);
  const { signOut } = useAuth();

  if (me === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );

  if (me === null) {
    return (
      <Gate
        title="Portal access required"
        body="Your account hasn't been granted access to the admin portal. Ask an organizer to add your email."
        action={
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        }
      />
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/admin">
            <Wordmark sub="Admin" />
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {me.role === 'admin' && (
              <Link href="/internal">
                <Button variant="ghost" size="sm">
                  <ShieldHalf className="size-4" /> Internal
                </Button>
              </Link>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline">{me.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
