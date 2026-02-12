import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_STROKES_PER_CHANNEL = 500;

export const addStroke = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    points: v.array(v.object({
      x: v.number(),
      y: v.number(),
    })),
    color: v.string(),
    width: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("drawStrokes", {
      channelId: args.channelId,
      userId: args.userId,
      points: args.points,
      color: args.color,
      width: args.width,
      createdAt: Date.now(),
    });

    // Prune oldest strokes if over limit
    const strokes = await ctx.db
      .query("drawStrokes")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();

    if (strokes.length > MAX_STROKES_PER_CHANNEL) {
      const sorted = strokes.sort((a, b) => a.createdAt - b.createdAt);
      const toDelete = sorted.slice(0, strokes.length - MAX_STROKES_PER_CHANNEL);
      await Promise.all(
        toDelete.map((stroke) => ctx.db.delete("drawStrokes", stroke._id))
      );
    }
  },
});

export const getStrokes = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const strokes = await ctx.db
      .query("drawStrokes")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();
    return strokes.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const clearCanvas = mutation({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const strokes = await ctx.db
      .query("drawStrokes")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();
    await Promise.all(
      strokes.map((stroke) => ctx.db.delete("drawStrokes", stroke._id))
    );
  },
});
