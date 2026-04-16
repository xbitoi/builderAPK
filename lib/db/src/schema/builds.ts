import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const buildsTable = pgTable("builds", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  buildType: text("build_type").notNull().default("release"),
  outputFormat: text("output_format").notNull().default("apk"),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  logs: jsonb("logs").$type<string[]>().default([]).notNull(),
  outputPath: text("output_path"),
  outputSizeBytes: integer("output_size_bytes"),
  errorMessage: text("error_message"),
  playStoreMode: boolean("play_store_mode").notNull().default(false),
  storeTitle: text("store_title"),
  storeDescription: text("store_description"),
  storeCategory: text("store_category"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBuildSchema = createInsertSchema(buildsTable).omit({ id: true, createdAt: true });
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Build = typeof buildsTable.$inferSelect;
