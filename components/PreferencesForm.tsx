'use client';

import * as React from 'react';

type Plan = 'free' | 'premium';

type Props = {
  userId: string;
  plan: Plan;
};

// Topic chips you want to expose
const TOPIC_CHOICES = [
  'Markets',
  'Tech',
  'World',
  'US',
  'Business',
  'Sports',
  'Entertainment',
  'Science',
  'Health',
  'Weather',
];

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export default function PreferencesForm({ userId, plan }: Props) {
  const isPremium = plan === 'premium';

  // On FREE, user can flip preview to see the form.
  const [previewPremium, setPreviewPremium] = React.useState(false);

  // Form state (used only when form is visible)
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([
    'Markets',
    'Tech',
    'World',
  ]);
  const [sendTime, setSendTime] = React.useState('08:00');
  const [tz, setTz] = React.useState(getLocalTimezone());

  const showForm = isPremium || previewPremium;

  // Toggle a topic chip
  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  // (Optional) save handler — wire later if you want. No extra UI shown.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showForm) return;
    // TODO: POST to your API when ready
    // await fetch('/api/preferences', { method: 'POST', body: JSON.stringify({ userId, topics: selectedTopics, sendTime, tz }) })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Preferences</h2>

        {/* Toggle stays top-right on FREE only */}
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

      {/* FREE (toggle OFF): only the single line */}
      {!showForm ? (
        <p className="text-gray-800">
          <strong>Customize topics and schedule blips with Premium.</strong>
        </p>
      ) : (
        // PREMIUM (or FREE with preview ON): chips + schedule, nothing extra
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Topics (chips) */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Topics</h3>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CHOICES.map((topic) => {
                const active = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={[
                      'rounded-full border px-3 py-1 text-sm transition',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Schedule blip</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="send-time" className="mb-1 block text-xs text-gray-500">
                  Daily send time
                </label>
                <input
                  id="send-time"
                  type="time"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="tz" className="mb-1 block text-xs text-gray-500">
                  Timezone
                </label>
                <input
                  id="tz"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  placeholder="e.g., America/Chicago"
                />
              </div>
            </div>
          </section>

          {/* Hidden submit for future wiring; no visible button needed now */}
          <button type="submit" className="hidden">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
