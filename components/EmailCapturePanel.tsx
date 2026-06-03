'use client';

import { useCallback, useEffect, useState } from 'react';
import { isValidEmail, maskEmail } from '@/lib/email-utils';

type SessionFieldsView = {
  status: string;
  emailMasked?: string;
  emailConfirmed?: boolean;
  awaitingEmailCapture?: boolean;
};

type EmailCapturePanelProps = {
  channel: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export function EmailCapturePanel({
  channel,
  open,
  onClose,
  onSubmitted,
}: EmailCapturePanelProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<SessionFieldsView | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/session-fields?channel=${encodeURIComponent(channel)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as SessionFieldsView;
      setView(data);
    } catch {
      // ignore
    }
  }, [channel]);

  useEffect(() => {
    if (!open || !channel) return;
    void refresh();
  }, [open, channel, refresh]);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/session-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, email: trimmed, action: 'submit' }),
      });
      const data = (await res.json()) as { error?: string; readBackLine?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save email.');
        return;
      }
      setEmail('');
      await refresh();
      onSubmitted();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/session-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, action: 'confirm' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not confirm.');
        return;
      }
      await refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const pending = view?.status === 'pending_confirmation';
  const confirmed = view?.status === 'confirmed';
  const masked = view?.emailMasked ?? (email ? maskEmail(email) : undefined);

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:px-4 sm:pb-6"
      role="dialog"
      aria-labelledby="email-capture-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Secure input
            </p>
            <h2
              id="email-capture-title"
              className="text-base font-semibold text-foreground"
            >
              Email address
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Type your email here. The assistant will read it back for
              confirmation — no need to spell it aloud.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Minimize email form"
          >
            Hide
          </button>
        </div>

        {confirmed ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Email confirmed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {view?.emailMasked ?? masked}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tell the assistant to send the email when you are ready.
            </p>
          </div>
        ) : pending ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">Saved as</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">
                {view?.emailMasked ?? masked}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Say &ldquo;I&apos;ve entered my email&rdquo; so the assistant can
                read it back, or confirm below if it already matches.
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Yes, that&apos;s correct
            </button>
            <button
              type="button"
              onClick={() => {
                void fetch('/api/session-fields', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ channel, action: 'reset' }),
                }).then(() => refresh());
              }}
              className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Change email
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit();
                }}
                className="w-full rounded-xl border border-border bg-background/80 px-4 py-3 text-base text-foreground outline-none ring-primary/30 transition-shadow placeholder:text-muted-foreground/60 focus:ring-2"
              />
            </label>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={submitting || !email.trim()}
              onClick={() => void handleSubmit()}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
