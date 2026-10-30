import { Hono } from 'hono';
import { readNight } from './digest/read.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    try {
      const night = readNight(config.runsDir, c.req.param('night'));
      if (night === null) return c.json({ error: 'no such night' }, 404);
      return c.json({ night: night.night, rows: night.rows, badLines: night.badLines });
    } catch (err) {
      console.error('digest json: read failed', err instanceof Error ? err.name : 'unknown');
      return c.json({ error: 'could not read night' }, 500);
    }
  });

  return app;
}
