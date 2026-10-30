// Plan morning-digest § 1: read runs/<night>.jsonl into one DigestRow per job.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NIGHT_PATTERN, type DigestRow, type ReadNight, type RunLine, type RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

// Parse one line at the edge. Returns null for anything that isn't a valid RunLine.
export function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status, owner };
  if (error !== undefined) line.error = error;
  return line;
}

function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if (isRecord(err) && err.code === 'ENOENT') return null;
    throw err;
  }
}

// The one reader of a night's file: parsed lines in file order, bad lines counted. null when the
// night isn't a date or has no file; any other read error is thrown.
export function readLines(runsDir: string, night: string): { lines: RunLine[]; badLines: number } | null {
  if (!NIGHT_PATTERN.test(night)) return null;
  const text = readFileOrNull(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const lines: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) badLines += 1;
    else lines.push(line);
  }
  return { lines, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  const read = readLines(runsDir, night);
  if (read === null) return null;

  const byJob = new Map<string, DigestRow>();
  for (const line of read.lines) {
    const row = byJob.get(line.job);
    const isRetry = line.status === 'retry' ? 1 : 0;
    if (row === undefined) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: isRetry,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
    } else {
      row.owner = line.owner ?? row.owner; // a later line without an owner doesn't erase it
      row.runs += 1;
      row.retries += isRetry;
      row.lastStatus = line.status;
      row.lastError = line.error ?? null;
      row.lastAt = line.at;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines: read.badLines };
};
