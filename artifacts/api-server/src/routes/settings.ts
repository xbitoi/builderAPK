import { Router } from "express";
import { db } from "@workspace/db";
import { appSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(appSettings);
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

router.put("/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (value === undefined) { res.status(400).json({ error: "value is required" }); return; }
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  res.json({ key, value });
});

router.delete("/:key", async (req, res) => {
  await db.delete(appSettings).where(eq(appSettings.key, req.params.key));
  res.status(204).end();
});

export default router;
