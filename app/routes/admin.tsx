import { useMemo, useState } from 'react';
import Nav from '~/components/Nav';
import api from '~/lib/api';
import type { EduAiApiKeyStatus } from '~/lib/types';
import type { Route } from './+types/admin';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('ADMIN');
  const status = await api.getEduAiApiKeyStatus();
  return { status };
}

function formatTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  const [status, setStatus] = useState<EduAiApiKeyStatus>(loaderData.status);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatedLabel = useMemo(() => formatTime(status.updatedAt), [status.updatedAt]);

  const sourceTag = (() => {
    if (!status.configured) return { label: 'Not configured', className: 'tag' };
    if (status.source === 'ADMIN') return { label: 'Admin override', className: 'tag tag-primary' };
    if (status.source === 'ENV') return { label: 'From .env', className: 'tag tag-accent' };
    return { label: 'Configured', className: 'tag' };
  })();

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
      </div>
    </div>
  );
}
