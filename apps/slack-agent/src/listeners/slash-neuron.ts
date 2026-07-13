import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from "@slack/bolt";

import { streamStubResponse } from "../streaming/responder.js";

type Handler = SlackCommandMiddlewareArgs & AllMiddlewareArgs;

export async function handleSlashNeuron({
  client,
  command,
  ack,
  respond,
  logger,
}: Handler): Promise<void> {
  await ack();

  try {
    const channelId = command.channel_id;
    const query = command.text.trim();

    if (!query) {
      await respond({
        text: "Please provide a question. Example: `/neuron Explain our architecture`",
      });
      return;
    }

    let result;
    try {
      result = await client.chat.postMessage({
        channel: channelId,
        text: `*Query:* ${query}`,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === "not_in_channel"
      ) {
        await respond({
          text: ":warning: I need to be in this channel to respond. Please invite me first, then try again.",
        });
        return;
      }
      throw e;
    }

    const threadTs = result.ts;
    if (!threadTs) throw new Error("Failed to post initial message");

    await streamStubResponse(client, channelId, threadTs, query, {
      recipientTeamId: command.team_id,
      recipientUserId: command.user_id,
    });
  } catch (e) {
    logger.error(`Failed to handle /neuron: ${e}`);
  }
}
