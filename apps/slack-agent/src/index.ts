import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "neuron-slack-agent" });
});

const port = Number(process.env.PORT) || 3000;

console.log(`Neuron Slack Agent starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
