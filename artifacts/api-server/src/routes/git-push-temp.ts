import { Router } from "express";
import { execSync } from "child_process";
const router = Router();
router.post("/git-push-temp", async (_req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) { res.status(500).json({ error: "No GITHUB_TOKEN" }); return; }
    const cwd = "/home/runner/workspace";
    execSync('git config user.email "bot@apkbuilder.pro"', { cwd });
    execSync('git config user.name "APK Builder Bot"', { cwd });
    execSync("git add -A", { cwd });
    const status = execSync("git status --short", { cwd }).toString().trim();
    if (!status) { res.json({ message: "Nothing to commit" }); return; }
    execSync('git commit -m "feat: add ECC agent modes, slash commands, specialized AI prompts, rebuilt dist"', { cwd });
    execSync(`git remote set-url origin https://${token}@github.com/xbitoi/builderAPK.git`, { cwd });
    const out = execSync("git push origin main 2>&1", { cwd }).toString();
    res.json({ ok: true, output: out, committed: status });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});
export default router;
