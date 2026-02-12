import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Simple HMAC-SHA256 implementation using Web Crypto API
async function createHmacSignature(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Dispatch webhook notifications for bot mentions
export const dispatchMentionWebhooks = internalAction({
  args: {
    messageId: v.id("messages"),
    channelId: v.id("channels"),
    channelName: v.string(),
    text: v.string(),
    senderId: v.id("users"),
    senderUsername: v.string(),
    parentMessageId: v.optional(v.id("messages")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Get webhooks for mentioned bots
    const webhooks = await ctx.runQuery(internal.bots.getWebhooksForMentionedBots, {
      text: args.text,
      excludeUserId: args.senderId,
    });

    if (webhooks.length === 0) {
      return;
    }

    // Prepare payload
    const payload = {
      event: "mention",
      data: {
        messageId: args.messageId,
        channelId: args.channelId,
        channelName: args.channelName,
        text: args.text,
        senderId: args.senderId,
        senderUsername: args.senderUsername,
        parentMessageId: args.parentMessageId,
        createdAt: args.createdAt,
      },
      timestamp: Date.now(),
    };

    const payloadString = JSON.stringify(payload);

    // Send webhooks to all mentioned bots with registered webhooks
    const results = await Promise.allSettled(
      webhooks.map(async (webhook: { botId: Id<"users">; botUsername: string; url: string; secret: string }) => {
        const signature = await createHmacSignature(webhook.secret, payloadString);

        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Ruckus-Signature": signature,
            "X-Ruckus-Bot": webhook.botUsername,
          },
          body: payloadString,
        });

        if (!response.ok) {
          console.error(
            `Webhook delivery failed for bot ${webhook.botUsername}: ${response.status} ${response.statusText}`
          );
        }

        return {
          botId: webhook.botId,
          status: response.status,
          ok: response.ok,
        };
      })
    );

    // Log results (in production, you might want to track failed deliveries)
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Webhook delivery error:", result.reason);
      }
    }
  },
});
