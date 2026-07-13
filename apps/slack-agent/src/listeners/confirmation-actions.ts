import type { AllMiddlewareArgs, SlackActionMiddlewareArgs } from "@slack/bolt";
import { executeConfirmedAction } from "../tools/github-tools.js";
import { prisma } from "@neuron/database";

type ActionHandler = SlackActionMiddlewareArgs<"block_actions"> &
  AllMiddlewareArgs;

export async function handleConfirmationAction({
  ack,
  body,
  client,
  logger,
}: ActionHandler): Promise<void> {
  await ack();

  try {
    const action = body.actions?.[0];
    if (!action || action.type !== "button") {
      logger.error("[confirmation] Invalid action type");
      return;
    }

    const buttonAction = action as { value: string; action_id: string };
    const value = JSON.parse(buttonAction.value);

    if (buttonAction.action_id === "cancel_action") {
      await client.chat.update({
        channel: body.container.channel_id,
        ts: body.container.message_ts,
        text: "❌ Action cancelled",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "❌ Action cancelled",
            },
          },
        ],
      });
      return;
    }

    if (buttonAction.action_id === "confirm_action") {
      const { action, params, confirmationId } = value;
      const channel = body.container.channel_id;
      const threadTs = body.container.message_ts;

      // Get workspace from team_id
      const teamId = body.team?.id;
      if (!teamId) {
        await client.chat.update({
          channel,
          ts: threadTs,
          text: "❌ Failed to identify workspace",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Failed to identify workspace",
              },
            },
          ],
        });
        return;
      }

      const workspace = await prisma.workspace.findUnique({
        where: { slackWorkspaceId: teamId },
      });

      if (!workspace) {
        await client.chat.update({
          channel,
          ts: threadTs,
          text: "❌ Workspace not found",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Workspace not found",
              },
            },
          ],
        });
        return;
      }

      // Execute the confirmed action
      const result = await executeConfirmedAction(action, params, {
        workspaceId: workspace.id,
        channel,
        threadTs,
        client,
      });

      if (result.success) {
        const data = result.data as { text: string };
        await client.chat.update({
          channel,
          ts: threadTs,
          text: data.text,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: data.text,
              },
            },
          ],
        });
      } else {
        await client.chat.update({
          channel,
          ts: threadTs,
          text: `❌ ${result.error}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `❌ ${result.error}`,
              },
            },
          ],
        });
      }
    }
  } catch (e) {
    logger.error(`[confirmation] Failed to handle action: ${e}`);
    await client.chat.update({
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      text: "❌ Something went wrong while processing the action",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❌ Something went wrong while processing the action",
          },
        },
      ],
    });
  }
}
