export type Plan = 'free' | 'premium';

export type TopicsKey =
  | 'top' | 'markets' | 'tech' | 'sports' | 'world'
  | 'us' | 'local' | 'business' | 'science' | 'health';

export type Topics = TopicsKey[];

export interface Preferences {
  user_id: string;
  location?: string;
  topics?: Topics;
  tickers?: string[];
  delivery_hour?: number; // 0–23
  timezone?: string;      // e.g., "America/Chicago"
}
