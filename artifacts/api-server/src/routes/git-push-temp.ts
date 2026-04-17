import { Router } from "express";
import { execSync } from "child_process";
const r = Router();
r.post("/git-push-now", (_req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const remote = `https://${token}@github.com/xbitoi/builderAPK.git`;
    execSync(`git config user.email "agent@replit.com"`, { cwd: "/home/runner/workspace" });
    execSync(`git config user.name "Replit Agent"`, { cwd: "/home/runner/workspace" });
    execSync(`git add -A`, { cwd: "/home/runner/workspace" });
    execSync(`git commit -m "fix: run-local.bat Windows 11 compatibility — errorlevel, SESSION_SECRET, pause on crash" || true`, { cwd: "/home/runner/workspace" });
    execSync(`git push ${remote} HEAD:main --force`, { cwd: "/home/runner/workspace" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
export default r;
