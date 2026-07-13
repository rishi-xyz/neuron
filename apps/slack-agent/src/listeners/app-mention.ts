import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

import { streamStubResponse } from "../streaming/responder.js";

type Handler = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

export async function handleAppMentioned({
  client,
  event,
  context,
  logger,
}: Handler): Promise<void> {
  try {
    const channelId = event.channel;
    const text = event.text || "";
    const threadTs = event.thread_ts || event.ts;

    const cleanedText = text.replace(/<@[A-Z0-9]+>/g, "").trim();

    if (!cleanedText) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "Hey there! How can I help you? Ask me anything about your engineering knowledge.",
      });
      return;
    }

    await streamStubResponse(client, channelId, threadTs, cleanedText, {
      recipientTeamId: context.team_id,
      recipientUserId: event.user,
    });
  } catch (e) {
    logger.error(`Failed to handle app_mention: ${e}`);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: ":warning: Something went wrong while processing your request. Please try again.",
    });
  }
}
