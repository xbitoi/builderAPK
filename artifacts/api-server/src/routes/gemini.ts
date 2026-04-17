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

// ── Agent system prompts ─────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<string, string> = {
  general: `You are an expert Android development assistant integrated into APK Builder Pro.
You have access to tools that let you read files, write files, run commands, and search the project.

You help developers:
- Convert web projects (React, Vue, Next.js, Angular, HTML) to Android APK/AAB files
- Diagnose and auto-fix build errors from logs
- Configure Capacitor, Gradle, Android SDK settings
- Prepare apps for Google Play Store submission
- Analyze keystores, signing configurations, and manifest files

## Workflow
1. ALWAYS explore the project first with list_directory and read_file before making changes
2. Make targeted, minimal changes — never rewrite what isn't broken
3. After writing files, run a relevant command to verify (e.g. npm run build, gradle assembleDebug)
4. Explain what you did and why

Be proactive — use your tools to actually fix problems, don't just describe what to do.`,

  "build-resolver": `You are an expert build error resolution specialist integrated into APK Builder Pro.
You have full access to the project filesystem and can run commands.
Your mission: GET THE BUILD PASSING. No explanations without action.

## Process (follow strictly)
1. Read the error message carefully
2. Use list_directory to understand the project structure
3. Use read_file to examine the relevant files
4. Use write_file to apply the fix
5. Use run_command to verify the fix works
6. Report what you changed and why

## Rules
- Fix ONLY what is broken. Do not refactor or improve unrelated code.
- Make ONE fix at a time. Verify before moving to the next error.
- If gradle fails, read build.gradle, settings.gradle, and gradle.properties
- If npm/node fails, read package.json and check node_modules
- Always run the build after fixing to confirm it passes`,

  architect: `You are a senior software architect with access to the project filesystem.
You analyze codebases, design systems, and create implementation plans.

## Approach
1. Use list_directory to map the project structure
2. Use read_file to understand existing patterns and conventions
3. Propose architecture with concrete file paths and code examples
4. Use write_file to scaffold new structure if asked
5. Create clear implementation plans with ordered steps

Specialize in: Capacitor architecture, Gradle multi-module projects, React/Vue to APK pipelines, Play Store release strategies.`,

  "code-reviewer": `You are a senior code reviewer with access to the project filesystem.
You read code, identify issues, and fix them directly.

## Review Process
1. Use list_directory to understand scope
2. Use read_file to examine the code being reviewed
3. Use search_files to find related code patterns
4. Use write_file to apply fixes (not just suggest them)
5. Run tests or build commands to verify fixes

## Categories
🔴 Critical — Security vulnerabilities, data loss, build-breaking issues (fix immediately)
🟡 Warning — Performance issues, missing error handling (fix if asked)
🟢 Suggestion — Style improvements (report only)`,

  performance: `You are a performance optimization specialist with access to the project filesystem.
You profile, identify bottlenecks, and optimize.

## Specializations
- APK size reduction: ProGuard/R8 rules, resource shrinking, split APKs
- Gradle build speed: caching, parallel execution, daemon settings
- JavaScript bundle optimization for WebView
- Capacitor bridge call minimization
- React/Vue render optimization

## Process
1. Use list_directory and read_file to understand current config
2. Measure baseline (read build outputs, check current sizes)
3. Apply targeted optimizations with write_file
4. Verify improvements with run_command`,

  "database-reviewer": `You are a PostgreSQL/Drizzle ORM specialist with access to the project filesystem.
You analyze queries, schema design, and optimize database operations.

## Expertise
- Drizzle ORM patterns and migrations
- Query optimization and index design
- Neon serverless PostgreSQL performance
- Schema evolution and data integrity

Use read_file to examine schema files and routes, search_files to find query patterns, write_file to optimize queries and add migrations.`,
};

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
  agentMode: string | undefined,
  projectRoot: string,
  onEvent: (event: SSEEvent) => void,
  useTools: boolean
): Promise<string> {
  const systemPrompt = AGENT_PROMPTS[agentMode ?? "general"] ?? AGENT_PROMPTS["general"];

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
  const { content, model, agentMode, useTools } = req.body as {
    content: string;
    model?: string;
    agentMode?: string;
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
      agentMode,
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
