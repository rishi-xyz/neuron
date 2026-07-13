import { App, LogLevel } from "@slack/bolt";

import { handleAppHomeOpened } from "./listeners/home.js";
import { handleAppMentioned } from "./listeners/app-mention.js";
import { handleSlashNeuron } from "./listeners/slash-neuron.js";
import { handleMessage } from "./listeners/message-im.js";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
  ignoreSelf: false,
});

app.event("app_home_opened", handleAppHomeOpened);
app.event("app_mention", handleAppMentioned);
app.event("message", handleMessage);
app.command("/neuron", handleSlashNeuron);

app.action("feedback", async ({ ack }) => {
  await ack();
});

(async () => {
  await app.start();
  app.logger.info(":brain: Neuron Slack Agent is running!");
})();
