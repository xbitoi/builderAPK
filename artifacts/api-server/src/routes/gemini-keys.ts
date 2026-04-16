import { Router } from "express";
import { db } from "@workspace/db";
import { geminiKeys } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const SLOTS = [1, 2, 3, 4, 5];

async function ensureSlots() {
  for (const slot of SLOTS) {
    await db
      .insert(geminiKeys)
      .values({ slot, keyValue: "", label: `Key ${slot}` })
      .onConflictDoNothing();
  }
}

router.get("/", async (_req, res) => {
  await ensureSlots();
  const keys = await db
    .select({
      slot: geminiKeys.slot,
      label: geminiKeys.label,
      isActive: geminiKeys.isActive,
      hasKey: geminiKeys.keyValue,
      exhaustedUntil: geminiKeys.exhaustedUntil,
      updatedAt: geminiKeys.updatedAt,
    })
    .from(geminiKeys)
    .orderBy(geminiKeys.slot);

  res.json(
    keys.map((k) => ({
      slot: k.slot,
      label: k.label,
      isActive: k.isActive,
      hasKey: k.hasKey !== "",
      exhaustedUntil: k.exhaustedUntil,
      updatedAt: k.updatedAt,
    }))
  );
});

router.put("/:slot", async (req, res) => {
  const slot = Number(req.params.slot);
  if (!SLOTS.includes(slot)) {
    res.status(400).json({ error: "Invalid slot (must be 1–5)" });
    return;
  }
  const { keyValue, label, isActive } = req.body as {
    keyValue?: string;
    label?: string;
    isActive?: boolean;
  };

  await ensureSlots();
  const updates: Partial<typeof geminiKeys.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (keyValue !== undefined) updates.keyValue = keyValue;
  if (label !== undefined) updates.label = label;
  if (isActive !== undefined) updates.isActive = isActive;

  if (isActive) {
    updates.exhaustedUntil = null as unknown as undefined;
  }

  await db.update(geminiKeys).set(updates).where(eq(geminiKeys.slot, slot));

  const [updated] = await db
    .select()
    .from(geminiKeys)
    .where(eq(geminiKeys.slot, slot));

  res.json({
    slot: updated.slot,
    label: updated.label,
    isActive: updated.isActive,
    hasKey: updated.keyValue !== "",
    exhaustedUntil: updated.exhaustedUntil,
    updatedAt: updated.updatedAt,
  });
});

router.post("/:slot/reset-exhausted", async (req, res) => {
  const slot = Number(req.params.slot);
  if (!SLOTS.includes(slot)) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  await db
    .update(geminiKeys)
    .set({ exhaustedUntil: null as unknown as undefined, isActive: true })
    .where(eq(geminiKeys.slot, slot));
  res.json({ ok: true });
});

export default router;
