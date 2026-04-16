import { Router } from "express";
import { execSync } from "child_process";

const router = Router();

router.post("/git-push", (_req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not set" });
  const cwd = "/home/runner/workspace";
  try {
    execSync('git config user.email "agent@replit.com"', { cwd });
    execSync('git config user.name "Replit Agent"', { cwd });
    execSync("git add -A", { cwd });
    try { execSync('git commit -m "Fix: ASCII-only bat file + CRLF gitattributes for Windows"', { cwd }); } catch {}
    try { execSync("git remote remove _gh_tmp", { cwd }); } catch {}
    execSync(`git remote add _gh_tmp "https://${token}@github.com/xbitoi/builderAPK.git"`, { cwd });
    const out = execSync("git push _gh_tmp main --force 2>&1", { cwd, timeout: 60000 }).toString();
    try { execSync("git remote remove _gh_tmp", { cwd }); } catch {}
    return res.json({ ok: true, output: out });
  } catch (e: unknown) {
    try { execSync("git remote remove _gh_tmp", { cwd }); } catch {}
    return res.status(500).json({ error: (e instanceof Error ? e.message : String(e)).replace(token, "[TOKEN]") });
  }
});

export default router;
