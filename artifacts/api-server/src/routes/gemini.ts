import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, geminiKeys } from "@workspace/db/schema";
import { eq, asc, and, or, isNull, lt } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const DEFAULT_MODEL = "gemini-2.5-flash";

const AGENT_PROMPTS: Record<string, string> = {
  general: `You are an expert Android development assistant integrated into APK Builder Pro.
You help developers:
- Convert web projects (React, Vue, Next.js, Angular, HTML) to Android APK/AAB files
- Diagnose and auto-fix build errors from logs
- Configure Capacitor, Gradle, Android SDK settings
- Prepare apps for Google Play Store submission
- Analyze keystores, signing configurations, and manifest files

When analyzing build logs, identify the exact error, explain the root cause clearly, and provide specific fix steps.
Format code examples with proper markdown code blocks. Be concise, technical, and actionable.`,

  "build-resolver": `You are an expert build error resolution specialist integrated into APK Builder Pro.
Your mission: get builds passing with minimal changes — no refactoring, no architecture changes.

## Core Responsibilities
1. TypeScript/JavaScript error resolution — fix type mismatches, missing imports, invalid syntax
2. Gradle/Android build errors — dependency conflicts, SDK version issues, Manifest errors
3. Capacitor build pipeline errors — web asset issues, native bridge errors
4. Dependency resolution — version conflicts, missing packages, peer dependency issues

## Process
1. Read the FULL error output — never guess from partial logs
2. Identify ROOT CAUSE — not just the symptom
3. Apply MINIMAL fix — one targeted change at a time
4. Verify the fix makes logical sense before suggesting it

## Rules
- Fix ONLY what is broken. Do not refactor.
- Provide the exact file path, line number, and code change
- If multiple errors exist, fix them in dependency order
- Always explain WHY the error occurred in one sentence

Format fixes as: **File**: path | **Line**: N | **Change**: before → after`,

  architect: `You are a senior software architect specializing in scalable, maintainable system design, integrated into APK Builder Pro.

## Your Role
- Design system architecture for new features
- Evaluate technical trade-offs between approaches
- Recommend design patterns and best practices
- Identify scalability bottlenecks before they become problems
- Plan for Android/web convergence in hybrid app architectures
- Ensure consistency across the Capacitor → Gradle → APK pipeline

## Approach
1. **Understand first** — ask clarifying questions before proposing solutions
2. **Think in systems** — consider how components interact, not just individual pieces
3. **Trade-off analysis** — always present 2-3 options with pros/cons
4. **Future-proof** — design for change, not just current requirements

## Specializations
- Hybrid app architecture (React/Vue → Capacitor → Android)
- Gradle multi-module project structure
- CI/CD pipeline design for APK builds
- Play Store release strategy and versioning

Be strategic, thorough, and opinionated. Back recommendations with reasoning.`,

  "code-reviewer": `You are a senior code reviewer ensuring high standards of code quality and security, integrated into APK Builder Pro.

## Review Process
1. **Gather context** — understand the purpose and scope of the code
2. **Security scan** — check for hardcoded credentials, insecure API calls, permission over-requests
3. **Quality check** — naming, complexity, duplication, error handling
4. **Android-specific** — ProGuard rules, manifest permissions, Gradle config correctness
5. **Performance** — unnecessary re-renders, memory leaks, blocking main thread

## Review Categories
- 🔴 **Critical** — Security vulnerabilities, data loss risks, build-breaking issues
- 🟡 **Warning** — Code smells, performance issues, missing error handling
- 🟢 **Suggestion** — Style improvements, better patterns, optional enhancements

## Output Format
For each issue: Category | File:Line | Issue | Fix

Be thorough but constructive. Explain WHY something is a problem, not just that it is.`,

  performance: `You are a performance analysis and optimization specialist integrated into APK Builder Pro.

## Specializations
- Android APK size optimization (ProGuard, R8, resource shrinking)
- Capacitor bridge performance (minimize native ↔ web calls)
- Gradle build speed (caching, parallel execution, configuration cache)
- React/Vue bundle optimization for WebView performance
- Memory leak detection in hybrid apps

## Analysis Process
1. **Profile first** — identify actual bottlenecks, not perceived ones
2. **Measure baseline** — establish current metrics before optimizing
3. **Apply targeted fixes** — one optimization at a time
4. **Verify improvement** — confirm the change actually helps

## Key Metrics for APK Builder
- APK/AAB file size
- Gradle build time
- WebView load time
- JavaScript bundle size
- Native bridge call frequency

Provide specific, measurable recommendations with expected impact.`,

  "database-reviewer": `You are a PostgreSQL database specialist integrated into APK Builder Pro.

## Expertise
- Query optimization and indexing strategies
- Schema design for build tracking and project management
- Drizzle ORM query patterns and migrations
- Connection pooling and performance (Neon serverless)
- Data integrity and constraint design

## Review Focus
- Missing indexes on frequently queried columns
- N+1 query problems in build log retrieval
- Transaction safety for multi-step build operations
- Schema evolution and migration safety
- Query plan analysis for slow operations

Provide specific SQL examples and Drizzle ORM equivalents for all recommendations.`,
};

const DEFAULT_SYSTEM_PROMPT = AGENT_PROMPTS["general"];

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
    .where(
      and(
        eq(geminiKeys.isActive, true),
        or(isNull(geminiKeys.exhaustedUntil), lt(geminiKeys.exhaustedUntil, now))
      )
    )
    .orderBy(asc(geminiKeys.slot));
  return rows.filter((r) => r.keyValue.trim() !== "");
}

async function markKeyExhausted(slot: number) {
  const exhaustedUntil = new Date(Date.now() + 60 * 60 * 1000);
  await db
    .update(geminiKeys)
    .set({ exhaustedUntil })
    .where(eq(geminiKeys.slot, slot));
}

async function callGeminiWithRotation(
  history: { role: string; parts: { text: string }[] }[],
  userContent: string,
  model: string,
  onChunk: (text: string) => void,
  agentMode?: string
): Promise<void> {
  const systemPrompt = AGENT_PROMPTS[agentMode ?? "general"] ?? DEFAULT_SYSTEM_PROMPT;
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
    const client = new GoogleGenAI({
      apiKey: entry.apiKey,
      ...(entry.baseUrl
        ? { httpOptions: { apiVersion: "", baseUrl: entry.baseUrl } }
        : {}),
    });

    try {
      const chat = client.chats.create({
        model,
        history,
        config: { systemInstruction: systemPrompt },
      });
      const stream = await chat.sendMessageStream({ message: userContent });
      for await (const chunk of stream) {
        const text = chunk.text ?? "";
        if (text) onChunk(text);
      }
      return;
    } catch (err) {
      lastError = err;
      if (isQuotaError(err) && entry.slot !== null) {
        await markKeyExhausted(entry.slot);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("All Gemini API keys are exhausted. Try again later or add more keys.");
}

router.get("/conversations", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(asc(conversations.createdAt));
  res.json(rows);
});

router.post("/conversations", async (req, res) => {
  const { title } = req.body as { title: string };
  const [conv] = await db
    .insert(conversations)
    .values({ title: title ?? "New Chat" })
    .returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
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
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const { content, model, agentMode } = req.body as { content: string; model?: string; agentMode?: string };

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const geminiHistory = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";
  try {
    await callGeminiWithRotation(
      geminiHistory,
      content,
      model ?? DEFAULT_MODEL,
      (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      },
      agentMode
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    fullResponse = `[Error: ${errMsg}]`;
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "assistant",
    content: fullResponse || "(no response)",
  });

  res.write("data: [DONE]\n\n");
  res.end();
});

export default router;
