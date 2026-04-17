import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import buildsRouter from "./builds";
import keystoreRouter from "./keystore";
import statsRouter from "./stats";
import systemRouter from "./system";
import geminiRouter from "./gemini";
import geminiKeysRouter from "./gemini-keys";
import settingsRouter from "./settings";
import gitPushRouter from "./git-push-temp";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/builds", buildsRouter);
router.use("/projects", buildsRouter);
router.use("/keystore", keystoreRouter);
router.use("/stats", statsRouter);
router.use("/system/check", systemRouter);
router.use("/gemini", geminiRouter);
router.use("/gemini-keys", geminiKeysRouter);
router.use("/settings", settingsRouter);
router.use("/internal", gitPushRouter);

export default router;
