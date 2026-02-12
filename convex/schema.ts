import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    username: v.string(),
    sessionId: v.string(),
    avatarColor: v.string(),
    lastSeen: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_username", ["username"]),

  channels: defineTable({
    name: v.string(),
    topic: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_name", ["name"]),

  messages: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    text: v.string(),
  }).index("by_channelId", ["channelId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_channelId", ["channelId"]),

  channelReads: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    lastReadTime: v.number(),
  })
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_user", ["userId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_messageId_emoji", ["messageId", "emoji"]),
});

export default schema;
