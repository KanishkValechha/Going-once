'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id, UserRole } from '@/types';
import { Badge, Button, Card, Input, Label, Select, Spinner } from '@/components/ui';

export default function InternalHome() {
  const users = useQuery(api.users.listUsers);
  const me = useQuery(api.users.currentUser);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Portal access</h1>
        <p className="text-sm text-muted">
          Invite people into the admin portal and manage their roles. Admins can reach this internal
          dashboard and every tournament; members only see the tournaments they&apos;re added to.
        </p>
      </div>

      <InviteUser />

      {users === undefined ? (
        <Spinner />
      ) : (
        <Card className="flex flex-col gap-1 p-0">
          {users.map((u) => (
            <UserRow key={u._id} user={u} isSelf={me?._id === u._id} />
          ))}
        </Card>
      )}
    </div>
  );
}

function InviteUser() {
  const invite = useMutation(api.users.invite);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await invite({ email: trimmed, role });
      setEmail('');
      setRole('member');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold">Invite by email</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Button onClick={() => void submit()} disabled={busy || !email.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        The person can sign in immediately; the invite links to their account on first login.
      </p>
    </Card>
  );
}

function UserRow({
  user,
  isSelf,
}: {
  user: { _id: Id<'users'>; email: string; name?: string; role: UserRole; tokenIdentifier?: string };
  isSelf: boolean;
}) {
  const setUserRole = useMutation(api.users.setUserRole);
  const remove = useMutation(api.users.remove);
  const pending = !user.tokenIdentifier;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{user.email}</span>
          {isSelf && <Badge tone="accent">You</Badge>}
          {pending && <Badge tone="neutral">Pending</Badge>}
        </div>
        {user.name && <span className="text-xs text-muted">{user.name}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Select
          className="w-28"
          value={user.role}
          disabled={isSelf}
          onChange={(e) => void setUserRole({ userId: user._id, role: e.target.value as UserRole })}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
        <Button
          variant="danger"
          disabled={isSelf}
          onClick={() => {
            if (confirm(`Remove ${user.email}? This revokes all their access.`)) {
              void remove({ userId: user._id });
            }
          }}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
