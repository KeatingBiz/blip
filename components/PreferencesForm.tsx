'use client';

import * as React from 'react';

// Simple local "preview premium" toggle so you can test the UI without Stripe.
// Persists in localStorage for *your* browser only.
function usePremiumPreview() {
  const [isPremium, setIsPremium] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Default false; remember last setting
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('blip_premium_preview') : null;
    if (saved === '1') setIsPremium(true);
  }, []);

  const toggle = React.useCallback(() => {
    setIsPremium((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        if (next) window.localStorage.setItem('blip_premium_preview', '1');
        else window.localStorage.removeItem('blip_premium_preview');
      }
      return next;
    });
  }, []);

  return { isPremium, toggle, setIsPremium };
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export default function PreferencesPage() {
  const { isPremium, toggle } = usePremiumPreview();

  // Form state (only used when premium preview is ON)
  const [topics, setTopics] = React.useState<string>('markets, tech, world');
  const [sendTime, setSendTime] = React.useState<string>('08:00');
  const tz = React.useMemo(getLocalTimezone, []);

  // Fake save (wire to API later)
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isPremium) return; // guard
    setSaving(true);
    try {
      // TODO: call your future API: /api/preferences (upsert { topics, send_time_local, timezone })
      await new Promise((r) => setTimeout(r, 500));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Preferences</h1>

        {/* Premium preview toggle: only affects this browser for testing */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Premium preview</span>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={isPremium}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              isPremium ? 'bg-emerald-600' : 'bg-gray-300',
            ].join(' ')}
            title={isPremium ? 'Turn off Premium preview' : 'Turn on Premium preview'}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                isPremium ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
      </header>

      {/* FREE VIEW (default): just the one line */}
      {!isPremium ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-800">
            <strong>Customize topics and schedule blips with Premium</strong>
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Upgrade to pick your topics and get your blip delivered at your exact local time.
          </p>

          {/* Optional: a disabled-looking form preview */}
          <div className="pointer-events-none mt-6 space-y-4 opacity-50">
            <div>
              <label className="block text-sm font-medium text-gray-700">Topics</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                placeholder="markets, tech, world"
                defaultValue="markets, tech, world"
                disabled
              />
              <p className="mt-1 text-xs text-gray-500">Comma-separated. Example: markets, tech, world</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Daily send time</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  defaultValue="08:00"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
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
        </div>
      ) : (
        // PREMIUM VIEW (when toggled): fields become editable
        <form onSubmit={onSave} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-800">
            <strong>Premium settings</strong>
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Choose your topics and schedule your blip. These will power the per-user 8am scheduler later.
          </p>

          <div className="mt-6 space-y-4">
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
              <p className="mt-1 text-xs text-gray-500">Comma-separated. Example: markets, tech, world</p>
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
                  Detected from your browser. We&apos;ll map this to your region bucket automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
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
                Saved {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
