import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const FRAMEWORK_DETECT_MAP: Record<string, string> = {
  react: "react",
  vue: "vue",
  next: "nextjs",
  angular: "angular",
  svelte: "svelte",
  nuxt: "nuxt",
};

router.get("/", async (req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  res.json(
    projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    sourceType: z.enum(["github", "zip", "local"]),
    sourceUrl: z.string().optional().nullable(),
    packageId: z.string().optional().nullable(),
    appName: z.string().optional().nullable(),
    versionName: z.string().optional().nullable(),
    versionCode: z.number().int().optional().nullable(),
  });
  const body = schema.parse(req.body);
  const [project] = await db
    .insert(projectsTable)
    .values({
      name: body.name,
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl ?? null,
      packageId: body.packageId ?? `com.app.${body.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      appName: body.appName ?? body.name,
      versionName: body.versionName ?? "1.0.0",
      versionCode: body.versionCode ?? 1,
      status: "pending",
    })
    .returning();
  res.status(201).json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).end();
});

router.post("/:id/detect", async (req, res) => {
  const id = parseInt(req.params.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) return res.status(404).json({ error: "Not found" });

  let detectedType = "html";
  let framework: string | null = null;
  let buildTool: string | null = null;
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (project.sourceUrl) {
    const url = project.sourceUrl.toLowerCase();
    for (const [key, val] of Object.entries(FRAMEWORK_DETECT_MAP)) {
      if (url.includes(key)) {
        detectedType = val;
        framework = val;
        break;
      }
    }
  }

  if (detectedType === "react" || detectedType === "nextjs") {
    buildTool = "npm";
    recommendations.push("Use Capacitor for best React integration");
  } else if (detectedType === "vue" || detectedType === "nuxt") {
    buildTool = "npm";
    recommendations.push("Use Capacitor for best Vue integration");
  } else {
    buildTool = "cordova";
    recommendations.push("HTML/JS projects work best with Cordova wrapper");
  }

  recommendations.push("Ensure minSdkVersion is 22 or higher for best compatibility");

  if (!project.packageId) {
    warnings.push("No package ID set — using default. Change before release.");
  }

  await db
    .update(projectsTable)
    .set({ projectType: detectedType, status: "ready", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));

  res.json({
    projectType: detectedType,
    framework,
    buildTool,
    nodeVersion: "20",
    hasPackageJson: detectedType !== "html",
    warnings,
    recommendations,
  });
});

export default router;
