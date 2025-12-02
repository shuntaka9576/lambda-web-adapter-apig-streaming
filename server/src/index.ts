import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.get('/stream', (c) => {
  return streamSSE(c, async (stream) => {
    for (let i = 1; i <= 900; i++) {
      await stream.writeSSE({ data: `Message ${i}` });
      await stream.sleep(1000);
    }
    await stream.writeSSE({ data: '[DONE]' });
  });
});

const port = Number(process.env.PORT) || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
