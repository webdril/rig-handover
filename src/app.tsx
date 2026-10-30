import { Hono } from 'hono';
import type { Child } from 'hono/jsx';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight } from './digest/read.js';
import { DigestMessage, DigestPage } from './views/digest.js';
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

  app.get('/digest/:night', (c) => {
    const page = (title: string, body: Child) => <Layout title={title} lane={lane()}>{body}</Layout>;
    try {
      const night = readNight(config.runsDir, c.req.param('night'));
      if (night === null) return c.html(page('not found', <DigestMessage title="not found" text="No digest for that night." />), 404);
      return c.html(page(`digest ${night.night}`, <DigestPage night={night} />));
    } catch {
      return c.html(page('error', <DigestMessage title="error" text="Something went wrong." />), 500);
    }
  });

  return app;
}
