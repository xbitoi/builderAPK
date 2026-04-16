import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const keystoresTable = pgTable("keystores", {
  id: serial("id").primaryKey(),
  alias: text("alias").notNull(),
  password: text("password").notNull(),
  commonName: text("common_name").notNull(),
  organization: text("organization"),
  country: text("country").default("US"),
  validityYears: integer("validity_years").notNull().default(25),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertKeystoreSchema = createInsertSchema(keystoresTable).omit({ id: true, createdAt: true });
export type InsertKeystore = z.infer<typeof insertKeystoreSchema>;
export type Keystore = typeof keystoresTable.$inferSelect;
