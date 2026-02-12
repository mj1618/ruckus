import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

auth.addHttpRoutes(http);

// Helper to extract and validate API key from Authorization header
async function authenticateBot(
  ctx: { runQuery: (query: any, args: any) => Promise<any> },
  request: Request
): Promise<{ userId: Id<"users">; username: string; keyId: Id<"botApiKeys"> } | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = authHeader.slice(7);
  const botInfo = await ctx.runQuery(internal.bots.validateApiKey, { apiKey });

  if (!botInfo) {
    return new Response(
      JSON.stringify({ error: "Invalid API key" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return botInfo;
}

// CORS headers for bot API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// OPTIONS handler for CORS preflight
http.route({
  path: "/api/bots/me",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/mentions",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/webhooks",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/typing",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/messages",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/upload-url",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/api/bots/channels",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// GET /api/bots/me - Get bot info
http.route({
  path: "/api/bots/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    // Update last used timestamp
    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    const botInfo = await ctx.runQuery(internal.bots.getBotInfo, { botId: auth.userId });

    return new Response(JSON.stringify(botInfo), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// GET /api/bots/mentions - Poll for mentions
http.route({
  path: "/api/bots/mentions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    // Update last used timestamp
    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get("since") ?? "0", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    if (isNaN(since)) {
      return new Response(
        JSON.stringify({ error: "Invalid 'since' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const mentions = await ctx.runQuery(internal.bots.getMentions, {
      botId: auth.userId,
      since,
      limit,
    });

    return new Response(JSON.stringify({ mentions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

// POST /api/bots/webhooks - Register webhook
http.route({
  path: "/api/bots/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body.url || typeof body.url !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'url' field" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const result = await ctx.runMutation(internal.bots.registerWebhook, {
        botId: auth.userId,
        url: body.url,
      });

      return new Response(
        JSON.stringify({
          message: "Webhook registered",
          secret: result.secret,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// DELETE /api/bots/webhooks - Remove webhook
http.route({
  path: "/api/bots/webhooks",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });
    await ctx.runMutation(internal.bots.removeWebhook, { botId: auth.userId });

    return new Response(
      JSON.stringify({ message: "Webhook removed" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }),
});

// POST /api/bots/typing - Set typing indicator
http.route({
  path: "/api/bots/typing",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    let body: { channelId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body.channelId) {
      return new Response(
        JSON.stringify({ error: "Missing 'channelId' field" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const { setTyping } = await import("./typing");
      await ctx.runMutation(internal.bots.internalSetTyping, {
        channelId: body.channelId as Id<"channels">,
        userId: auth.userId,
      });

      return new Response(
        JSON.stringify({ message: "Typing indicator set" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// DELETE /api/bots/typing - Clear typing indicator
http.route({
  path: "/api/bots/typing",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    let body: { channelId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body.channelId) {
      return new Response(
        JSON.stringify({ error: "Missing 'channelId' field" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      await ctx.runMutation(internal.bots.internalClearTyping, {
        channelId: body.channelId as Id<"channels">,
        userId: auth.userId,
      });

      return new Response(
        JSON.stringify({ message: "Typing indicator cleared" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// POST /api/bots/messages - Post a message
http.route({
  path: "/api/bots/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    let body: {
      channelId?: string;
      text?: string;
      parentMessageId?: string;
      attachments?: Array<{
        storageId: string;
        filename: string;
        contentType: string;
        size: number;
      }>;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body.channelId) {
      return new Response(
        JSON.stringify({ error: "Missing 'channelId' field" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body.text && (!body.attachments || body.attachments.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Message must have text or attachments" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const messageId = await ctx.runMutation(internal.bots.internalSendMessage, {
        channelId: body.channelId as Id<"channels">,
        userId: auth.userId,
        text: body.text ?? "",
        parentMessageId: body.parentMessageId as Id<"messages"> | undefined,
        attachments: body.attachments?.map((a) => ({
          storageId: a.storageId as Id<"_storage">,
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      });

      return new Response(
        JSON.stringify({ messageId }),
        { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// POST /api/bots/upload-url - Get upload URL for file attachments
http.route({
  path: "/api/bots/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    const uploadUrl = await ctx.storage.generateUploadUrl();

    return new Response(
      JSON.stringify({ uploadUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }),
});

// GET /api/bots/channels - List available channels
http.route({
  path: "/api/bots/channels",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateBot(ctx, request);
    if (auth instanceof Response) return auth;

    await ctx.runMutation(internal.bots.updateApiKeyLastUsed, { keyId: auth.keyId });

    const channels = await ctx.runQuery(internal.bots.listChannels, {});

    return new Response(
      JSON.stringify({ channels }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }),
});

export default http;
