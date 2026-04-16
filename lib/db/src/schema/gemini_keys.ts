import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const geminiKeys = pgTable("gemini_keys", {
  slot: integer("slot").primaryKey(),
  keyValue: text("key_value").notNull().default(""),
  label: text("label").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  exhaustedUntil: timestamp("exhausted_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type GeminiKey = typeof geminiKeys.$inferSelect;
