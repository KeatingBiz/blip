// lib/tzbuckets.ts
export type Bucket =
  | 'us_atlantic'   // Puerto Rico, USVI (AST, no DST)
  | 'us_east'       // Eastern (EDT/EST)
  | 'us_central'    // Central (CDT/CST)
  | 'us_mountain'   // Mountain (MDT/MST w/ DST)
  | 'us_arizona'    // Arizona (MST year-round, no DST)
  | 'us_pacific'    // Pacific (PDT/PST)
  | 'us_alaska'     // Alaska (AKDT/AKST)
  | 'us_aleutian'   // Aleutian (HDT/HAST via America/Adak)
  | 'us_hawaii'     // Hawaii (HST, no DST; Honolulu)
  | 'europe'        // Keep non-US buckets you already had
  | 'apac';

const ANCHORS: Record<Bucket, string> = {
  us_atlantic: 'America/Puerto_Rico',
  us_east: 'America/New_York',
  us_central: 'America/Chicago',
  us_mountain: 'America/Denver',
  us_arizona: 'America/Phoenix',
  us_pacific: 'America/Los_Angeles',
  us_alaska: 'America/Anchorage',
  us_aleutian: 'America/Adak',
  us_hawaii: 'Pacific/Honolulu',
  europe: 'Europe/London',
  apac: 'Asia/Singapore',
};

export function bucketAnchorTz(bucket: Bucket): string {
  return ANCHORS[bucket];
}

export function allBuckets(): Bucket[] {
  return [
    'us_atlantic',
    'us_east',
    'us_central',
    'us_mountain',
    'us_arizona',
    'us_pacific',
    'us_alaska',
    'us_aleutian',
    'us_hawaii',
    'europe',
    'apac',
  ];
}

/**
 * Map a browser-reported IANA tz (or saved user tz) to a regional bucket.
 * Covers all U.S. time zones + coarse EU/APAC fallbacks.
 */
export function tzBucket(tz?: string): Bucket {
  const z = (tz || '').trim();

  // Exact matches first (special U.S. cases)
  if (z.includes('Puerto_Rico')) return 'us_atlantic';
  if (z.includes('Phoenix')) return 'us_arizona';
  if (z.includes('Anchorage')) return 'us_alaska';
  if (z.includes('Adak')) return 'us_aleutian';
  if (z.includes('Honolulu')) return 'us_hawaii';

  // U.S. regions by major cities
  if (z.startsWith('America/')) {
    if (
      /New_York|Detroit|Toronto|Montreal|Nassau|Indiana\/|Kentucky\//.test(z)
    ) return 'us_east';

    if (
      /Chicago|Winnipeg|Regina|Mexico_City|Belize|Costa_Rica|Guatemala|El_Salvador/.test(z)
    ) return 'us_central';

    if (/Denver|Boise|Edmonton|Yellowknife/.test(z)) return 'us_mountain';
    if (/Los_Angeles|Vancouver|Tijuana|San_Francisco|Seattle|Portland/.test(z)) return 'us_pacific';

    // Default for other Americas: bias to Eastern
    return 'us_east';
  }

  // Europe/APAC broad buckets
  if (z.startsWith('Europe/')) return 'europe';
  if (z.startsWith('Asia/') || z.startsWith('Australia/') || z.startsWith('Pacific/')) return 'apac';

  // Fallback
  return 'us_east';
}
