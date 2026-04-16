import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const DEFAULT_MODEL = "gemini-2.5-flash";

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
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
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

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content,
  });

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

  let fullResponse = "";
  try {
    const chat = ai.chats.create({
      model: model ?? DEFAULT_MODEL,
      history: geminiHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    const stream = await chat.sendMessageStream({ message: content });

    for await (const chunk of stream) {
      const text = chunk.text ?? "";
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
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
