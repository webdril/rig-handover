// Plan morning-digest § 2c: one count per parsed line, by status, across a night.
import { readLines } from './read.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Built on the digest's own reader, so the board and the digest agree on what a night holds.
// Returns null when the night can't be read; lines that don't parse are not counted.
export function countNight(runsDir: string, night: string): NightCounts | null {
  let read;
  try {
    read = readLines(runsDir, night);
  } catch {
    return null;
  }
  if (read === null) return null;
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of read.lines) counts[line.status] += 1;
  return counts;
}
