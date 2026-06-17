'use client';

import Link from 'next/link';
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from 'convex/react';
import { ArrowRight, Radio } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Wordmark } from '@/components/Wordmark';

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-12 px-6 py-16">
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
        aria-hidden
      />
      <div className="relative flex flex-col items-center text-center">
        <Wordmark size="lg" />
        <h1 className="display mt-8 text-6xl tracking-tight sm:text-7xl">
          Live Auction
          <br />
          <span className="text-accent">Control Room</span>
        </h1>
        <p className="mt-5 max-w-lg text-balance text-muted-foreground">
          Run physical sports auctions in real time. Register every bid from the room and drive a shared live screen on
          the big display.
        </p>
      </div>

      <AuthLoading>
        <Spinner />
      </AuthLoading>

      <Unauthenticated>
        <Card className="flex w-full max-w-sm flex-col gap-3 p-6">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to manage tournaments and run the auction.
          </p>
          <a href="/sign-in">
            <Button className="w-full" size="lg">
              Sign in <ArrowRight className="size-4" />
            </Button>
          </a>
          <a href="/sign-up">
            <Button variant="secondary" className="w-full" size="lg">
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
        <Button size="xl">
          <Radio className="size-5" /> Open admin portal <ArrowRight className="size-5" />
        </Button>
      </Link>
    );
  }

  return (
    <Card className="max-w-sm p-6 text-center text-sm text-muted-foreground">
      You&apos;re signed in as <span className="font-semibold text-foreground">{me?.email}</span>, but you don&apos;t
      have admin access. Ask a tournament organizer to grant your account the admin role.
    </Card>
  );
}
