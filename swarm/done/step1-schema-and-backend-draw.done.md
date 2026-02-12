# Task: Schema + Backend for Draw Strokes

## Requirements
1. Add `drawStrokes` table to `convex/schema.ts` with fields: channelId, userId, points (array of {x, y}), color, width, createdAt, and index by_channelId
2. Create `convex/drawing.ts` with:
   - `addStroke` mutation: accepts channelId, points, color, width; inserts stroke; limits to ~500 strokes per channel (delete oldest when exceeded)
   - `getStrokes` query: returns all strokes for a channel ordered by creation time
   - `clearCanvas` mutation: deletes all strokes for a channel
3. Add "draw" to seed defaults in `convex/channels.ts`
4. Run `pnpm -s convex codegen`

## Dependencies
None
