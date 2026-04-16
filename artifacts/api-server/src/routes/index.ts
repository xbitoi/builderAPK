import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import buildsRouter from "./builds";
import keystoreRouter from "./keystore";
import statsRouter from "./stats";
import systemRouter from "./system";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/builds", buildsRouter);
router.use("/projects", buildsRouter);
router.use("/keystore", keystoreRouter);
router.use("/stats", statsRouter);
router.use("/system/check", systemRouter);
router.use("/gemini", geminiRouter);

export default router;
