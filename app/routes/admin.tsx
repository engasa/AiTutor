import { useMemo, useState } from 'react';
import Nav from '~/components/Nav';
import api from '~/lib/api';
import type { AdminUser, EduAiApiKeyStatus } from '~/lib/types';
import type { Route } from './+types/admin';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('ADMIN');
  const [status, users] = await Promise.all([
    api.getEduAiApiKeyStatus(),
    api.listAdminUsers(),
  ]);
  return { status, users };
}

function formatTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [status, setStatus] = useState<EduAiApiKeyStatus>(loaderData.status);
  const [users, setUsers] = useState<AdminUser[]>(loaderData.users);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [promotingUserId, setPromotingUserId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatedLabel = useMemo(() => formatTime(status.updatedAt), [status.updatedAt]);

  const sourceTag = (() => {
    if (!status.configured) return { label: 'Not configured', className: 'tag' };
    if (status.source === 'ADMIN') return { label: 'Admin override', className: 'tag tag-primary' };
    if (status.source === 'ENV') return { label: 'From .env', className: 'tag tag-accent' };
    return { label: 'Configured', className: 'tag' };
  })();

  const promoteUser = async (userId: number, role: 'INSTRUCTOR' | 'ADMIN') => {
    setPromotingUserId(userId);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.promoteUserRole(userId, role);
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
      setMessage(
        role === 'ADMIN'
          ? 'User promoted to admin.'
          : 'User promoted to instructor.',
      );
    } catch (e) {
      setError('Could not update role. Please try again.');
    } finally {
      setPromotingUserId((current) => (current === userId ? null : current));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = await api.setEduAiApiKey(apiKey);
      setStatus(next);
      setApiKey('');
      setMessage('Saved. This overrides EDUAI_API_KEY from the environment.');
    } catch (e) {
      setError('Could not save key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    setError(null);
    setMessage(null);
    try {
      const next = await api.clearEduAiApiKey();
      setStatus(next);
      setMessage('Cleared admin override. The server will fall back to EDUAI_API_KEY from the environment.');
    } catch {
      setError('Could not clear override. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <Nav />

      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 w-[1000px] h-[600px] bg-primary/3 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl translate-y-1/3 translate-x-1/4" />
        <div className="absolute inset-0 grid-lines opacity-30" />
      </div>

      <div className="container mx-auto px-6 py-10 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-up">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Admin</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Settings
            </h1>
          </div>
          <div className={sourceTag.className}>{sourceTag.label}</div>
        </header>

        <div className="flex flex-wrap gap-3 animate-fade-up delay-150">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          >
            User Management
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}
          >
            EduAI Settings
          </button>
        </div>

        {(error || message) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'bg-destructive/10 border-destructive/20 text-destructive'
                : 'bg-accent/10 border-accent/20 text-accent-foreground'
            }`}
          >
            {error ?? message}
          </div>
        )}

        {activeTab === 'users' ? (
          <div className="card-editorial p-6 sm:p-8 space-y-6 animate-fade-up delay-150">
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold text-foreground">User Management</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Admins can promote students to instructors or admins. Demotions are intentionally
                out of scope for this phase.
              </p>
            </div>

            <div className="space-y-3">
              {users.length === 0 ? (
                <div className="rounded-xl border border-border px-4 py-6 text-sm text-muted-foreground">
                  No users found.
                </div>
              ) : (
                users.map((user) => {
                  const canPromote = user.role === 'STUDENT';
                  const isBusy = promotingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{user.name}</h3>
                          <span className="tag">{user.role}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => promoteUser(user.id, 'INSTRUCTOR')}
                          disabled={!canPromote || isBusy}
                          className="btn-secondary text-sm"
                        >
                          Promote to Instructor
                        </button>
                        <button
                          type="button"
                          onClick={() => promoteUser(user.id, 'ADMIN')}
                          disabled={!canPromote || isBusy}
                          className="btn-primary text-sm"
                        >
                          Promote to Admin
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="card-editorial p-6 sm:p-8 space-y-6 animate-fade-up delay-150">
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold text-foreground">EduAI API Key</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {status.envConfigured ? (
                  <>
                    <span className="font-mono">EDUAI_API_KEY</span> is already configured in your server environment
                    (for example via <span className="font-mono">.env</span>). Saving a key here will override it.
                    Clear the override to fall back to the environment value.
                  </>
                ) : (
                  <>
                    No <span className="font-mono">EDUAI_API_KEY</span> is configured in your server environment (for
                    example via <span className="font-mono">.env</span>). You can set one here.
                  </>
                )}
              </p>
              {updatedLabel && status.hasAdminOverride && (
                <p className="text-xs text-muted-foreground">
                  Last updated: <span className="font-mono">{updatedLabel}</span>
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">New key</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? 'text' : 'password'}
                  className="input-field flex-1"
                  placeholder="Paste EDUAI API key"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="btn-secondary text-sm"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !apiKey.trim()}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save key'}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={clearing || !status.hasAdminOverride}
              className="btn-secondary"
              title={!status.hasAdminOverride ? 'No admin override to clear' : undefined}
            >
              {clearing ? 'Clearing…' : 'Clear override'}
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
