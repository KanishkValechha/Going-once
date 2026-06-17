'use client';

import Link from 'next/link';
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Spinner } from '@/components/ui';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Going Once</p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight">Live Auction Control</h1>
        <p className="mt-4 text-muted">
          Run physical sports auctions in real time. Track every bid from the room and drive a shared live screen.
        </p>
      </div>

      <AuthLoading>
        <Spinner />
      </AuthLoading>

      <Unauthenticated>
        <Card className="flex w-full max-w-sm flex-col gap-3">
          <p className="text-center text-sm text-muted">Sign in to manage tournaments and run the auction.</p>
          <a href="/sign-in">
            <Button className="w-full">Sign in</Button>
          </a>
          <a href="/sign-up">
            <Button variant="secondary" className="w-full">
              Create an account
            </Button>
          </a>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <AdminGate />
      </Authenticated>
    </main>
  );
}

function AdminGate() {
  const me = useQuery(api.users.currentUser);

  if (me === undefined) return <Spinner />;

  if (me?.role === 'admin') {
    return (
      <Link href="/admin">
        <Button>Open Admin Portal →</Button>
      </Link>
    );
  }

  return (
    <Card className="max-w-sm text-center text-sm text-muted">
      You&apos;re signed in as <span className="text-foreground">{me?.email}</span>, but you don&apos;t have admin
      access. Ask a tournament organizer to grant your account the admin role.
    </Card>
  );
}
