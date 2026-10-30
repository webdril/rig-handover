// Plan morning-digest § 2c: one count per parsed line, by status, across a night.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import { NIGHT_PATTERN, type RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Returns null when the night's file can't be read. Lines that don't parse are not counted.
export function countNight(runsDir: string, night: string): NightCounts | null {
  if (!NIGHT_PATTERN.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line !== null) counts[line.status] += 1;
  }
  return counts;
}
