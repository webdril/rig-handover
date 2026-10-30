import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

type Body = { night: string; rows: { job: string }[]; badLines: number };

const line = (job: string, status: string, at = '2026-10-28T01:00:00+01:00') =>
  JSON.stringify({ at, job, status, owner: 'emeka' });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  const config: RigConfig = { adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: dir };
  writeFileSync(join(dir, '2026-02-01.jsonl'), [line('zeta', 'ok'), line('alpha', 'fail'), line('mid', 'retry'), line('alpha', 'ok')].join('\n') + '\n');
  writeFileSync(join(dir, '2026-02-02.jsonl'), '');
  writeFileSync(join(dir, '2026-02-03.jsonl'), [line('good-one', 'ok'), 'not json {', line('good-two', 'ok')].join('\n') + '\n');
  app = createApp(config);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const page = (n: string) => app.request(`/digest/${n}`);
const api = (n: string) => app.request(`/api/digest/${n}`);

describe('digest routes with a temp runs dir', () => {
  it('200 for a normal night, page and JSON', async () => {
    const p = await page('2026-02-01');
    expect(p.status).toBe(200);
    expect(await p.text()).toContain('digest · 2026-02-01');
    const j = await api('2026-02-01');
    expect(j.status).toBe(200);
    const body = (await j.json()) as Body;
    expect(body.night).toBe('2026-02-01');
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file, page and JSON', async () => {
    expect((await page('2026-02-09')).status).toBe(404);
    const j = await api('2026-02-09');
    expect(j.status).toBe(404);
    expect(await j.json()).toEqual({ error: 'no such night' });
  });

  it('empty night: page says nothing ran, JSON has no rows', async () => {
    const p = await page('2026-02-02');
    expect(p.status).toBe(200);
    const html = await p.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toMatch(/parse/);
    const j = await api('2026-02-02');
    expect(j.status).toBe(200);
    expect(await j.json()).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('bad line: page shows the notice and good rows, JSON counts it', async () => {
    const p = await page('2026-02-03');
    expect(p.status).toBe(200);
    const html = await p.text();
    expect(html).toMatch(/1 line didn(&#39;|')t parse/);
    expect(html).toContain('good-one');
    expect(html).toContain('good-two');
    const body = (await (await api('2026-02-03')).json()) as Body;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good-one', 'good-two']);
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const html = await (await page('2026-02-01')).text();
    const body = (await (await api('2026-02-01')).json()) as Body;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha', 'mid', 'zeta']);
    const positions = jobs.map((j) => html.indexOf(`<td>${j}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('non-date nights 404 without touching files', async () => {
    for (const n of ['..%2F..%2Fetc', '..%2F..%2Fetc%2Fpasswd', 'abc', '2026-2-1']) {
      expect((await page(n)).status).toBe(404);
      expect((await api(n)).status).toBe(404);
    }
  });
});
