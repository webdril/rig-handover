// Plan morning-digest § 1. The contract every part of § 2 starts against: commit this first.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as —
  runs: number; // lines for this job
  retries: number; // lines with status retry
  lastStatus: RunStatus;
  lastError: string | null; // error of the job's last line, if any
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse: counted, never thrown
};

// A night name is a date and nothing else, so it can't walk out of the runs dir.
export const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Returns null when the night has no file (the routes answer 404); an empty file is a Night
// with no rows. Implemented in src/digest/read.ts (#2).
export type ReadNight = (runsDir: string, night: string) => Night | null;
