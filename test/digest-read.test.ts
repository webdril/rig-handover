import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows).toHaveLength(5);
    expect(night?.badLines).toBe(1);
  });

  it('sorts rows by job', () => {
    const jobs = night?.rows.map((r) => r.job) ?? [];
    expect(jobs).toEqual([...jobs].sort());
  });

  it('fixtures/refresh: 4 runs, 3 retries, last ok, offsets kept', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      owner: 'rook',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup: last fail with its error', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('digest/render: owner null keeps the row', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
  });
});

describe('readNight in a temp runs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('an empty file is a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('returns null for a night that is not a date', () => {
    writeFileSync(join(dir, 'x.jsonl'), '{}\n');
    expect(readNight(dir, '../etc')).toBeNull();
    expect(readNight(join(dir, 'sub'), '../x')).toBeNull();
    expect(readNight(dir, '2026-01-02\n')).toBeNull();
  });

  it('counts invalid lines, skips blank lines, never throws', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '[]',
      'null',
      '{"at":"t","job":"a","status":"done","owner":"x"}',
      '{"at":"t","job":"a","status":"ok","owner":3}',
      '{"at":"t","job":"a","status":"ok"}',
      '{"at":"t","job":"a","status":"ok","owner":null,"error":5}',
      '{"at":"2026-01-03T02:00:00+01:00","job":"a","status":"fail","owner":"y","error":"boom"}',
      '   ',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(6);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'y',
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-01-03T01:00:00+01:00',
        lastAt: '2026-01-03T02:00:00+01:00',
      },
    ]);
  });
});

describe('readNight owner', () => {
  it('keeps the last known owner when a later line has none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-owner-'));
    try {
      writeFileSync(
        join(dir, '2026-02-01.jsonl'),
        '{"at":"2026-02-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n' +
          '{"at":"2026-02-01T02:00:00+01:00","job":"a","status":"ok","owner":null}\n',
      );
      expect(readNight(dir, '2026-02-01')?.rows[0]?.owner).toBe('rook');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
