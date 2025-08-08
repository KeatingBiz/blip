'use client';

import * as React from 'react';

type Plan = 'free' | 'premium';
type Props = { userId: string; plan: Plan };

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

  // Form state (premium only)
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([
    'Markets',
    'Tech',
    'World',
  ]);
  const [sendTime, setSendTime] = React.useState('08:00');
  const [tz, setTz] = React.useState(getLocalTimezone());

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  // --- FREE: match the Voice tab’s card exactly-style ---
  if (!isPremium) {
    return (
      <div className="card">
        <div className="small">Customize topics and schedule blips with Premium.</div>
      </div>
    );
  }

  // --- PREMIUM: topic bubbles + schedule (clean, minimal) ---
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: wire to /api/preferences when ready
      }}
      className="space-y-6"
    >
      {/* Topics */}
      <section className="card">
        <div className="small">Topics</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPIC_CHOICES.map((topic) => {
            const active = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                aria-pressed={active}
                className={[
                  'rounded-full border px-3 py-1 text-sm transition',
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                ].join(' ')}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </section>

      {/* Schedule blip */}
      <section className="card">
        <div className="small">Schedule blip</div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Hidden submit until you wire it */}
      <button type="submit" className="hidden">
        Save
      </button>
    </form>
  );
}

