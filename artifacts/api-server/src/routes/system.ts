import { Router } from "express";
import { execSync } from "child_process";

const router = Router();

function checkTool(cmd: string, versionFlag = "--version"): { available: boolean; version: string | null } {
  try {
    const output = execSync(`${cmd} ${versionFlag} 2>&1`, { timeout: 5000 }).toString().trim();
    const match = output.match(/[\d]+\.[\d]+\.?[\d]*/);
    return { available: true, version: match ? match[0] : output.slice(0, 20) };
  } catch {
    return { available: false, version: null };
  }
}

router.get("/", async (req, res) => {
  const java = checkTool("java", "-version");
  const node = checkTool("node");
  const npm = checkTool("npm");
  const git = checkTool("git");

  const items = [
    {
      name: "Java JDK",
      ...java,
      required: true,
      installHint: java.available ? null : "Install JDK 17+: https://adoptium.net",
    },
    {
      name: "Node.js",
      ...node,
      required: true,
      installHint: node.available ? null : "Install Node.js 18+: https://nodejs.org",
    },
    {
      name: "npm",
      ...npm,
      required: true,
      installHint: npm.available ? null : "Comes with Node.js installation",
    },
    {
      name: "Git",
      ...git,
      required: true,
      installHint: git.available ? null : "Install Git: https://git-scm.com",
    },
    {
      name: "Android SDK",
      available: !!process.env.ANDROID_HOME || !!process.env.ANDROID_SDK_ROOT,
      version: process.env.ANDROID_HOME ? "Configured" : null,
      required: false,
      installHint: "Set ANDROID_HOME. Install via Android Studio.",
    },
    {
      name: "Gradle",
      available: false,
      version: null,
      required: false,
      installHint: "Included in Android Studio or install manually.",
    },
  ];

  const allRequired = items.filter((i) => i.required).every((i) => i.available);
  res.json({ allRequired, items });
});

export default router;
