'use client';

import * as React from 'react';

type Plan = 'free' | 'premium';

type Props = {
  userId: string;
  plan: Plan;
};

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export default function PreferencesForm({ userId, plan }: Props) {
  const isPremium = plan === 'premium';

  // For FREE: user can flip this to preview the fields
  const [previewPremium, setPreviewPremium] = React.useState(false);

  // Form state (used when premium OR preview is on)
  const [topics, setTopics] = React.useState('markets, tech, world');
  const [sendTime, setSendTime] = React.useState('08:00');
  const tz = React.useMemo(getLocalTimezone, []);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const showForm = isPremium || previewPremium;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!showForm) return;
    setSaving(true);
    try {
      // TODO: wire to your API later (e.g., /api/preferences)
      await new Promise((r) => setTimeout(r, 500));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Preferences</h2>

        {/* Only show the toggle on FREE plans */}
        {!isPremium && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Premium preview</span>
            <button
              type="button"
              onClick={() => setPreviewPremium((v) => !v)}
              aria-pressed={previewPremium}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                previewPremium ? 'bg-emerald-600' : 'bg-gray-300',
              ].join(' ')}
              title={previewPremium ? 'Hide premium fields' : 'Show premium fields'}
            >
              <span
                className={[
                  'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                  previewPremium ? 'translate-x-5' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
        )}
      </div>

      {/* FREE (default) — show ONLY the header line until toggled */}
      {!showForm ? (
        <div>
          <p className="text-gray-800">
            <strong>Customize topics and schedule blips with Premium</strong>
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Toggle “Premium preview” above to see what you’ll be able to configure.
          </p>
        </div>
      ) : (
        // PREMIUM (or FREE with preview toggled) — show editable fields
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
                {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {!isPremium && (
            <p className="pt-2 text-xs text-gray-400">
              You’re previewing Premium fields. Actual scheduling will require Premium.
            </p>
          )}
        </form>
      )}
    </div>
  );
}


