import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, geminiKeys, appSettings } from "@workspace/db/schema";
import { eq, asc, and, or, isNull, lt } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import {
  TOOL_DECLARATIONS,
  executeTool,
  MAX_STEPS,
  type ToolCall,
  type ToolName,
} from "../services/agent-tools";

const router = Router();
const DEFAULT_MODEL = "gemini-2.5-flash";

// ── Master system prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior software engineer embedded in APK Builder Pro — a platform that converts web apps (React, Vue, Next.js, Angular, HTML) into Android APK/AAB files.

## Decision Framework
For every request, choose the right action automatically:
| Request type | Action |
|---|---|
| Question / explanation | Answer from knowledge — do NOT call tools |
| Need to understand code | list_directory → read_file |
| Fix a bug or error | read_file → write_file → run_command to verify |
| Create new file | read nearby files first for conventions → write_file |
| Find something | search_files |
| Run a build / command | run_command, stream output |

## Tool Rules (when tools are available)
1. Never write a file without reading it first
2. write_file always contains the COMPLETE file — no partial edits, no "..." placeholders  
3. After any change, run a build or lint command to confirm it works
4. Be surgical — fix only what is broken, leave the rest untouched
5. If a task needs multiple steps, complete ALL of them before stopping

## Expertise
- Android: Gradle, Android SDK, Manifest, ProGuard/R8, signing, APK/AAB, Play Store
- Hybrid: Capacitor, Cordova, WebView performance, native bridge
- Frontend: React, Vue, Next.js, Angular, TypeScript, Vite, Webpack
- Backend: Node.js, Express, PostgreSQL, Drizzle ORM
- Tooling: npm, pnpm, git, CI/CD pipelines

## Response Rules
- No filler phrases ("Great question!", "Certainly!") — get straight to the point
- No repeating what the user just said
- Code in properly-labeled markdown blocks
- After making changes: one concise summary of what changed and why
- If something cannot be done: one sentence explaining why
- Default language: match the user's language (Arabic → Arabic, English → English)`;


// ── Key rotation ─────────────────────────────────────────────────────────────

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.toLowerCase().includes("too many requests")
  );
}

async function getActiveKeys(): Promise<Array<{ slot: number; keyValue: string }>> {
  const now = new Date();
  const rows = await db
    .select({ slot: geminiKeys.slot, keyValue: geminiKeys.keyValue })
    .from(geminiKeys)
    .where(and(eq(geminiKeys.isActive, true), or(isNull(geminiKeys.exhaustedUntil), lt(geminiKeys.exhaustedUntil, now))))
    .orderBy(asc(geminiKeys.slot));
  return rows.filter((r) => r.keyValue.trim() !== "");
}

async function markKeyExhausted(slot: number) {
  await db.update(geminiKeys).set({ exhaustedUntil: new Date(Date.now() + 60 * 60 * 1000) }).where(eq(geminiKeys.slot, slot));
}

async function getProjectRoot(): Promise<string> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "project_path"));
  return row?.value || process.cwd();
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

type SSEEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; output: string; isError: boolean }
  | { type: "agent_step"; step: number; total: number }
  | { type: "error"; message: string };

function sendSSE(res: import("express").Response, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function runAgenticLoop(
  apiKey: string,
  baseUrl: string | undefined,
  history: { role: string; parts: { text: string }[] }[],
  userContent: string,
  model: string,
  systemPrompt: string,
  projectRoot: string,
  onEvent: (event: SSEEvent) => void,
  useTools: boolean
): Promise<string> {
  const client = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
  });

  const toolConfig = useTools
    ? { tools: [{ functionDeclarations: TOOL_DECLARATIONS }] }
    : {};

  const chat = client.chats.create({
    model,
    history,
    config: {
      systemInstruction: systemPrompt,
      ...toolConfig,
    },
  });

  let currentMessage: unknown = userContent;
  let fullTextResponse = "";
  let stepCount = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    stepCount = step + 1;
    if (useTools && step > 0) {
      onEvent({ type: "agent_step", step: stepCount, total: MAX_STEPS });
    }

    // Send message (streaming)
    const stream = await chat.sendMessageStream({ message: currentMessage as string });

    let stepText = "";
    const pendingFunctionCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

    for await (const chunk of stream) {
      // Stream text chunks
      if (chunk.text) {
        stepText += chunk.text;
        fullTextResponse += chunk.text;
        onEvent({ type: "text", text: chunk.text });
      }

      // Collect function calls from chunks
      const candidates = (chunk as Record<string, unknown>).candidates as Array<{
        content?: { parts?: Array<{ functionCall?: { name: string; args: Record<string, unknown> } }> };
      }> | undefined;

      if (candidates) {
        for (const candidate of candidates) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.functionCall) {
              const id = `${part.functionCall.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              pendingFunctionCalls.push({ id, name: part.functionCall.name, args: part.functionCall.args ?? {} });
            }
          }
        }
      }
    }

    // No function calls → we're done
    if (pendingFunctionCalls.length === 0) break;

    // Execute tools and collect results
    const functionResponses: Array<{ functionResponse: { name: string; response: { result: string } } }> = [];

    for (const fc of pendingFunctionCalls) {
      onEvent({ type: "tool_call", id: fc.id, name: fc.name, args: fc.args });

      const output = executeTool({ name: fc.name as ToolName, args: fc.args }, projectRoot);
      const isError = output.startsWith("Error:");

      onEvent({ type: "tool_result", id: fc.id, name: fc.name, output, isError });

      functionResponses.push({
        functionResponse: { name: fc.name, response: { result: output } },
      });
    }

    // Next iteration: send tool results back
    currentMessage = functionResponses as unknown as string;
  }

  return fullTextResponse || "(no response)";
}

// ── Key-rotating entry point ──────────────────────────────────────────────────

async function callWithRotation(
  history: { role: string; parts: { text: string }[] }[],
  userContent: string,
  model: string,
  projectRoot: string,
  onEvent: (event: SSEEvent) => void,
  useTools: boolean
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPT;

  const dbKeys = await getActiveKeys();
  const fallbackKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "";
  const fallbackBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  const keyPool: Array<{ slot: number | null; apiKey: string; baseUrl?: string }> = [
    ...dbKeys.map((k) => ({ slot: k.slot, apiKey: k.keyValue })),
  ];
  if (fallbackKey && keyPool.length === 0) {
    keyPool.push({ slot: null, apiKey: fallbackKey, baseUrl: fallbackBase });
  }
  if (keyPool.length === 0) {
    throw new Error("No Gemini API keys configured. Add keys in Settings → AI Keys.");
  }

  let lastError: unknown;
  for (const entry of keyPool) {
    try {
      return await runAgenticLoop(
        entry.apiKey,
        entry.baseUrl,
        history,
        userContent,
        model,
        systemPrompt,
        projectRoot,
        onEvent,
        useTools
      );
    } catch (err) {
      lastError = err;
      if (isQuotaError(err) && entry.slot !== null) {
        await markKeyExhausted(entry.slot);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("All Gemini API keys are exhausted.");
}

// ── CRUD routes ───────────────────────────────────────────────────────────────

router.get("/conversations", async (_req, res) => {
  const rows = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  res.json(rows);
});

router.post("/conversations", async (req, res) => {
  const { title } = req.body as { title: string };
  const [conv] = await db.insert(conversations).values({ title: title ?? "New Chat" }).returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).end();
});

router.get("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  res.json(msgs);
});

// ── Main message endpoint ─────────────────────────────────────────────────────

router.post("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const { content, model, useTools } = req.body as {
    content: string;
    model?: string;
    useTools?: boolean;
  };

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  const history = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  const geminiHistory = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const projectRoot = await getProjectRoot();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";
  try {
    fullResponse = await callWithRotation(
      geminiHistory,
      content,
      model ?? DEFAULT_MODEL,
      projectRoot,
      (event) => sendSSE(res, event),
      useTools ?? false
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    sendSSE(res, { type: "error", message: errMsg });
    fullResponse = `[Error: ${errMsg}]`;
  }

  await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
  res.write("data: [DONE]\n\n");
  res.end();
});

export default router;
