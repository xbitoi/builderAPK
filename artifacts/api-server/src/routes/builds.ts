import { Router } from "express";
import { db } from "@workspace/db";
import { buildsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function serializeBuild(b: typeof buildsTable.$inferSelect) {
  return {
    ...b,
    startedAt: b.startedAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    logs: Array.isArray(b.logs) ? b.logs : [],
  };
}

const BUILD_STAGES = [
  "Initializing build environment...",
  "Cloning / extracting source files...",
  "Installing Node.js dependencies...",
  "Detecting project type and framework...",
  "Wrapping project with Capacitor / Cordova...",
  "Generating Android project files...",
  "Running Gradle build...",
  "Signing APK with keystore...",
  "Optimizing and aligning APK...",
  "Build complete!",
];

async function simulateBuild(buildId: number) {
  const totalSteps = BUILD_STAGES.length;
  for (let i = 0; i < totalSteps; i++) {
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    const progress = Math.round(((i + 1) / totalSteps) * 100);
    const logLine = `[${new Date().toISOString()}] ${BUILD_STAGES[i]}`;

    const [current] = await db.select().from(buildsTable).where(eq(buildsTable.id, buildId));
    if (!current || current.status === "cancelled") return;

    const newLogs = [...(Array.isArray(current.logs) ? current.logs : []), logLine];
    await db
      .update(buildsTable)
      .set({
        progress,
        logs: newLogs,
        status: i === totalSteps - 1 ? "success" : "running",
        startedAt: i === 0 ? new Date() : current.startedAt,
        completedAt: i === totalSteps - 1 ? new Date() : null,
        outputPath: i === totalSteps - 1 ? `/builds/${buildId}/output.apk` : null,
        outputSizeBytes: i === totalSteps - 1 ? Math.floor(4 * 1024 * 1024 + Math.random() * 20 * 1024 * 1024) : null,
      })
      .where(eq(buildsTable.id, buildId));
  }
}

router.get("/", async (req, res) => {
  const builds = await db.select().from(buildsTable).orderBy(desc(buildsTable.createdAt));
  res.json(builds.map(serializeBuild));
});

router.post("/projects/:id/build", async (req, res) => {
  const projectId = parseInt(req.params.id);
  const schema = z.object({
    buildType: z.enum(["debug", "release"]),
    outputFormat: z.enum(["apk", "aab"]),
    minSdkVersion: z.number().int().optional().nullable(),
    targetSdkVersion: z.number().int().optional().nullable(),
    useKeystore: z.boolean(),
    playStoreMode: z.boolean().optional(),
    storeTitle: z.string().optional().nullable(),
    storeDescription: z.string().optional().nullable(),
    storeCategory: z.string().optional().nullable(),
  });
  const body = schema.parse(req.body);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [build] = await db
    .insert(buildsTable)
    .values({
      projectId,
      buildType: body.buildType,
      outputFormat: body.outputFormat,
      status: "queued",
      progress: 0,
      logs: [`[${new Date().toISOString()}] Build queued for project: ${project.name}`],
      playStoreMode: body.playStoreMode ?? false,
      storeTitle: body.storeTitle ?? null,
      storeDescription: body.storeDescription ?? null,
      storeCategory: body.storeCategory ?? null,
    })
    .returning();

  await db
    .update(projectsTable)
    .set({ status: "building", updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  simulateBuild(build.id).catch(() => {});

  res.status(202).json(serializeBuild(build));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [build] = await db.select().from(buildsTable).where(eq(buildsTable.id, id));
  if (!build) return res.status(404).json({ error: "Not found" });
  res.json(serializeBuild(build));
});

router.post("/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  const [build] = await db.select().from(buildsTable).where(eq(buildsTable.id, id));
  if (!build) return res.status(404).json({ error: "Not found" });
  const [updated] = await db
    .update(buildsTable)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(buildsTable.id, id))
    .returning();
  res.json(serializeBuild(updated));
});

export default router;
