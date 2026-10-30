import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { NIGHT_PATTERN } from './digest/types.js';
import { countNight, type NightCounts } from './digest/count.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  counts: Record<string, NightCounts | null>; // by night; null = unreadable
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => f.slice(0, -'.jsonl'.length))
      .filter((n) => NIGHT_PATTERN.test(n))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    counts: Object.fromEntries(nights.map((n) => [n, countNight(config.runsDir, n)])),
  };
}
