import { Router } from "express";
import { db } from "@workspace/db";
import { buildsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const allProjects = await db.select().from(projectsTable);
  const allBuilds = await db.select().from(buildsTable).orderBy(desc(buildsTable.createdAt));

  const successfulBuilds = allBuilds.filter((b) => b.status === "success").length;
  const failedBuilds = allBuilds.filter((b) => b.status === "failed").length;
  const runningBuilds = allBuilds.filter((b) => b.status === "running" || b.status === "queued").length;

  const totalBytes = allBuilds.reduce((sum, b) => sum + (b.outputSizeBytes ?? 0), 0);
  const totalOutputSizeMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

  const recentBuilds = allBuilds.slice(0, 5).map((b) => ({
    ...b,
    startedAt: b.startedAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    logs: Array.isArray(b.logs) ? b.logs : [],
  }));

  res.json({
    totalProjects: allProjects.length,
    totalBuilds: allBuilds.length,
    successfulBuilds,
    failedBuilds,
    runningBuilds,
    totalOutputSizeMB,
    recentBuilds,
  });
});

export default router;
