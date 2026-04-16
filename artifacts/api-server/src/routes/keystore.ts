import { Router } from "express";
import { db } from "@workspace/db";
import { keystoresTable } from "@workspace/db";
import { z } from "zod";

const router = Router();

router.get("/", async (req, res) => {
  const [keystore] = await db.select().from(keystoresTable).limit(1);
  if (!keystore) return res.status(404).json({ error: "No keystore found" });
  res.json({
    ...keystore,
    password: undefined,
    createdAt: keystore.createdAt.toISOString(),
    expiresAt: keystore.expiresAt.toISOString(),
  });
});

router.post("/", async (req, res) => {
  const schema = z.object({
    alias: z.string().min(1),
    password: z.string().min(6),
    commonName: z.string().min(1),
    organization: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    validityYears: z.number().int().min(1).max(100),
  });
  const body = schema.parse(req.body);

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + body.validityYears);

  const [keystore] = await db
    .insert(keystoresTable)
    .values({
      alias: body.alias,
      password: body.password,
      commonName: body.commonName,
      organization: body.organization ?? null,
      country: body.country ?? "US",
      validityYears: body.validityYears,
      expiresAt,
    })
    .returning();

  res.status(201).json({
    ...keystore,
    password: undefined,
    createdAt: keystore.createdAt.toISOString(),
    expiresAt: keystore.expiresAt.toISOString(),
  });
});

export default router;
