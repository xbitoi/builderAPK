import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, geminiKeys } from "@workspace/db/schema";
import { eq, asc, and, or, isNull, lt } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const DEFAULT_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an expert Android development assistant integrated into APK Builder Pro.
You help developers:
- Convert web projects (React, Vue, Next.js, Angular, HTML) to Android APK/AAB files
- Diagnose and auto-fix build errors from logs
- Configure Capacitor, Gradle, Android SDK settings
- Prepare apps for Google Play Store submission
- Analyze keystores, signing configurations, and manifest files

When analyzing build logs, identify the exact error, explain the root cause clearly, and provide specific fix steps.
Format code examples with proper markdown code blocks.
Be concise, technical, and actionable.`;

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
  onChunk: (text: string) => void
): Promise<void> {
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
        config: { systemInstruction: SYSTEM_PROMPT },
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
  const { content, model } = req.body as { content: string; model?: string };

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
      }
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
