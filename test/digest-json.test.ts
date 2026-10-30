import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { RigConfig } from '../src/config.js';

const config: RigConfig = { adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns 2026-10-28 as JSON, rows sorted by job', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows).toHaveLength(5);
    expect(body.badLines).toBe(1);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    expect(body).toEqual(JSON.parse(JSON.stringify(readNight('runs', '2026-10-28'))));
  });

  it('404 JSON for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });
});
