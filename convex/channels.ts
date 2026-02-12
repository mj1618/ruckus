import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createChannel = mutation({
  args: {
    name: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const name = args.name.toLowerCase();
    if (!/^[a-z0-9-]{1,50}$/.test(name)) {
      throw new Error(
        "Channel name must be lowercase alphanumeric with hyphens, 1-50 characters"
      );
    }

    const existing = await ctx.db
      .query("channels")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    if (existing) {
      throw new Error(`Channel #${name} already exists`);
    }

    return await ctx.db.insert("channels", {
      name,
      createdBy: args.userId,
    });
  },
});

export const updateTopic = mutation({
  args: {
    channelId: v.id("channels"),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("channels", args.channelId, {
      topic: args.topic,
    });
  },
});

export const listChannels = query({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.db.query("channels").collect();
    return channels.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const seedDefaultChannels = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const defaults = ["general", "random", "introductions"];
    await Promise.all(
      defaults.map(async (name) => {
        const existing = await ctx.db
          .query("channels")
          .withIndex("by_name", (q) => q.eq("name", name))
          .unique();

        if (!existing) {
          await ctx.db.insert("channels", {
            name,
            createdBy: args.userId,
          });
        }
      })
    );
  },
});
