'use client';

import * as React from 'react';

type Plan = 'free' | 'premium';

type Props = {
  userId: string;
  plan: Plan;
};

// Simple local "Premium preview" so you can test the UI on free.
// Premium users see fields by default; free users can flip preview on.
function usePremiumPreview(plan: Plan) {
  const [isPremiumUI, setIsPremiumUI] = React.useState(plan === 'premium');

  React.useEffect(() => {
    if (plan === 'premium') {
      setIsPremiumUI(true);
      return;
    }
    const saved =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('blip_premium_preview')
        : null;
    if (saved === '1') setIsPremiumUI(true);
  }, [plan]);

  const toggle = React.useCallback(() => {
    setIsPremiumUI((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        if (next) window.localStorage.setItem('blip_premium_preview', '1');
        else window.localStorage.removeItem('blip_premium_preview');
      }
      return next;
    });
  }, []);

  return { isPremiumUI, toggle };
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export default function PreferencesForm({ userId, plan }: Props) {
  const { isPremiumUI, toggle } = usePremiumPreview(plan);

  // Form state (only saved when premium UI is on)
  const [topics, setTopics] = React.useState('markets, tech, world');
  const [sendTime, setSendTime] = React.useState('08:00');
  const tz = React.useMemo(getLocalTimezone, []);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isPremiumUI) return; // guard
    setSaving(true);
    try {
      // TODO: wire real API later (e.g., /api/preferences)
      // await fetch('/api/preferences', { method: 'POST', body: JSON.stringify({ userId, topics, sendTime, tz }) })
      await new Promise((r) => setTimeout(r, 500));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Preferences</h2>
          {plan === 'free' && (
            <p className="mt-1 text-sm text-gray-500">
              <strong>Customize topics and schedule blips with Premium.</strong>
            </p>
          )}
        </div>

        {/* Premium preview toggle (no-op for actual billing; local-only) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {plan === 'premium' ? 'Premium active' : 'Premium preview'}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={isPremiumUI}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              isPremiumUI ? 'bg-emerald-600' : 'bg-gray-300',
            ].join(' ')}
            title={isPremiumUI ? 'Hide premium fields' : 'Show premium fields'}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                isPremiumUI ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
      </div>

      {/* FREE view (fields disabled) */}
      {!isPremiumUI ? (
        <div className="pointer-events-none space-y-4 opacity-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">Topics</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="markets, tech, world"
              defaultValue="markets, tech, world"
              disabled
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated. Example: markets, tech, world
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Daily send time
              </label>
              <input
                type="time"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                defaultValue="08:00"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2"
                value={tz}
                disabled
              />
            </div>
          </div>

          <button
            className="mt-2 inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
            disabled
          >
            Save
          </button>
        </div>
      ) : (
        // PREMIUM view (editable)
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label htmlFor="topics" className="block text-sm font-medium text-gray-700">
              Topics
            </label>
            <input
              id="topics"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="markets, tech, world"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated. Example: markets, tech, world
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="send-time" className="block text-sm font-medium text-gray-700">
                Daily send time
              </label>
              <input
                id="send-time"
                type="time"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tz" className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <input
                id="tz"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2"
                value={tz}
                disabled
              />
              <p className="mt-1 text-xs text-gray-500">
                Detected from your browser. We’ll map this to your region bucket automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={[
                'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white',
                saving ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700',
              ].join(' ')}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {savedAt && (
              <span className="text-xs text-gray-500">
                Saved{' '}
                {new Date(savedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </form>
      )}

      {/* Subtle note tying the toggle to billing status */}
      {plan === 'free' && (
        <p className="mt-4 text-xs text-gray-400">
          You’re viewing Premium fields in preview only. Actual scheduling requires Premium.
        </p>
      )}
    </div>
  );
}

