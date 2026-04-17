import { Router } from "express";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const router = Router();
const IS_WINDOWS = process.platform === "win32";

// ── Tool detection ────────────────────────────────────────────────────────────

interface ToolResult {
  available: boolean;
  version: string | null;
}

/**
 * Try multiple commands/flags until one works.
 * java -version prints to stderr, so we merge stderr into stdout.
 */
function tryCommands(candidates: Array<{ cmd: string; args: string }>): ToolResult {
  for (const { cmd, args } of candidates) {
    try {
      // Use shell:true so Windows finds .bat/.cmd files automatically
      const output = execSync(`${cmd} ${args}`, {
        timeout: 6000,
        encoding: "utf-8",
        shell: IS_WINDOWS ? "cmd.exe" : "/bin/sh",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const match = output.match(/(\d+\.\d+[\d.]*)/);
      return { available: true, version: match ? match[1] : output.trim().slice(0, 30) };
    } catch (e: unknown) {
      // java writes version to stderr; capture it
      const err = e as { stderr?: string; stdout?: string };
      const combined = [err.stderr, err.stdout].filter(Boolean).join(" ");
      const match = combined.match(/(\d+\.\d+[\d.]*)/);
      if (match) return { available: true, version: match[1] };
    }
  }
  return { available: false, version: null };
}

function checkJava(): ToolResult {
  return tryCommands([
    { cmd: "java", args: "-version 2>&1" },
    { cmd: "java", args: "--version 2>&1" },
  ]);
}

function checkNode(): ToolResult {
  return tryCommands([{ cmd: "node", args: "--version 2>&1" }]);
}

function checkNpm(): ToolResult {
  return tryCommands([{ cmd: "npm", args: "--version 2>&1" }]);
}

function checkGit(): ToolResult {
  return tryCommands([{ cmd: "git", args: "--version 2>&1" }]);
}

function checkGradle(): ToolResult {
  // 1. Check system gradle
  const systemGradle = tryCommands([
    { cmd: "gradle",     args: "--version 2>&1" },
    { cmd: "gradle.bat", args: "--version 2>&1" },
  ]);
  if (systemGradle.available) return systemGradle;

  // 2. Check GRADLE_HOME
  const gradleHome = process.env.GRADLE_HOME;
  if (gradleHome) {
    const bin = join(gradleHome, "bin", IS_WINDOWS ? "gradle.bat" : "gradle");
    if (existsSync(bin)) {
      return tryCommands([{ cmd: `"${bin}"`, args: "--version 2>&1" }]);
    }
  }

  return { available: false, version: null };
}

function checkAndroidSdk(): ToolResult {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!home) return { available: false, version: null };

  // Try to read the platform-tools version
  const ptPath = join(home, "platform-tools");
  if (existsSync(ptPath)) {
    // Check if adb exists as a sanity check
    const adb = join(ptPath, IS_WINDOWS ? "adb.exe" : "adb");
    if (existsSync(adb)) {
      const r = tryCommands([{ cmd: `"${adb}"`, args: "--version 2>&1" }]);
      return { available: true, version: r.version ?? "Configured" };
    }
    return { available: true, version: "Configured (platform-tools found)" };
  }

  return { available: true, version: "Configured (SDK path set)" };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  const [java, node, npm, git, gradle, androidSdk] = await Promise.all([
    Promise.resolve(checkJava()),
    Promise.resolve(checkNode()),
    Promise.resolve(checkNpm()),
    Promise.resolve(checkGit()),
    Promise.resolve(checkGradle()),
    Promise.resolve(checkAndroidSdk()),
  ]);

  const items = [
    {
      name: "Java JDK",
      ...java,
      required: true,
      installHint: java.available
        ? null
        : IS_WINDOWS
          ? "Install JDK 17+: https://adoptium.net  — or run: winget install EclipseAdoptium.Temurin.17.JDK"
          : "Install JDK 17+: https://adoptium.net",
    },
    {
      name: "Node.js",
      ...node,
      required: true,
      installHint: node.available
        ? null
        : IS_WINDOWS
          ? "Install Node.js 18+: https://nodejs.org  — or run: winget install OpenJS.NodeJS"
          : "Install Node.js 18+: https://nodejs.org",
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
      installHint: git.available
        ? null
        : IS_WINDOWS
          ? "Install Git: https://git-scm.com  — or run: winget install Git.Git"
          : "Install Git: https://git-scm.com",
    },
    {
      name: "Android SDK",
      ...androidSdk,
      required: false,
      installHint: androidSdk.available
        ? null
        : IS_WINDOWS
          ? "Install Android Studio (includes SDK): https://developer.android.com/studio  Then set ANDROID_HOME in System Environment Variables."
          : "Install Android Studio: https://developer.android.com/studio  Then set ANDROID_HOME.",
    },
    {
      name: "Gradle",
      ...gradle,
      required: false,
      installHint: gradle.available
        ? null
        : IS_WINDOWS
          ? "Included in Android Studio. Or install manually and add to PATH: https://gradle.org/install"
          : "Included in Android Studio. Or: sdk install gradle (if using SDKMAN)",
    },
  ];

  const allRequired = items.filter((i) => i.required).every((i) => i.available);
  res.json({ allRequired, platform: process.platform, items });
});

export default router;
