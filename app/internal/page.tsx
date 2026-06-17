'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, UserRole } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

export default function InternalHome() {
  const users = useQuery(api.users.listUsers);
  const me = useQuery(api.users.currentUser);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Super-admin</p>
        <h1 className="display mt-1 text-4xl">Portal access</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Invite people into the admin portal and manage their roles. Admins can reach this internal dashboard and
          every tournament; members only see the tournaments they&apos;re added to.
        </p>
      </div>

      <InviteUser />

      {users === undefined ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden p-0">
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
      toast.success(`${trimmed} invited`);
      setEmail('');
      setRole('member');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4 text-accent" /> Invite by email
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void submit()} disabled={busy || !email.trim()}>
            <UserPlus className="size-4" /> {busy ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The person can sign in immediately; the invite links to their account on first login.
        </p>
      </CardContent>
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
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{user.email}</span>
          {isSelf && <Badge variant="accent">You</Badge>}
          {pending && <Badge>Pending</Badge>}
        </div>
        {user.name && <span className="text-xs text-muted-foreground">{user.name}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={user.role}
          disabled={isSelf}
          onValueChange={(v) => void setUserRole({ userId: user._id, role: v as UserRole })}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive disabled:opacity-30"
          disabled={isSelf}
          onClick={() => {
            if (confirm(`Remove ${user.email}? This revokes all their access.`)) {
              void remove({ userId: user._id });
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
