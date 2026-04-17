import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, resolve, dirname, relative, extname } from "path";

const MAX_FILE_SIZE = 150 * 1024;
const MAX_STEPS = 12;
const COMMAND_TIMEOUT = 60_000;
const IS_WINDOWS = process.platform === "win32";

export { MAX_STEPS };

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Normalize user-supplied path: handle backslashes, strip leading slash/backslash */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[/\\]/, "");
}

export function sanitizePath(userPath: string, projectRoot: string): string {
  const abs = resolve(projectRoot, normalizePath(userPath));
  const root = resolve(projectRoot);
  // On Windows resolve() produces paths like C:\foo; startsWith still works if
  // both sides are resolved through the same function.
  if (!abs.startsWith(root)) {
    throw new Error(`Access denied: path is outside the project root.\nRoot: ${root}\nRequested: ${abs}`);
  }
  return abs;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export function toolReadFile(path: string, projectRoot: string): string {
  const abs = sanitizePath(path, projectRoot);
  if (!existsSync(abs)) return `Error: File not found: ${path}`;
  const stat = statSync(abs);
  if (stat.isDirectory()) return `Error: ${path} is a directory — use list_directory instead`;
  const content = readFileSync(abs, "utf-8");
  if (content.length > MAX_FILE_SIZE)
    return content.slice(0, MAX_FILE_SIZE) + `\n\n[...truncated — file is ${Math.round(stat.size / 1024)} KB]`;
  return content;
}

export function toolWriteFile(path: string, content: string, projectRoot: string): string {
  const abs = sanitizePath(path, projectRoot);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf-8");
  return `✓ Written: ${path} (${content.length} chars)`;
}

export function toolRunCommand(command: string, cwd: string | undefined, projectRoot: string): string {
  const workDir = cwd ? sanitizePath(cwd, projectRoot) : projectRoot;
  if (!existsSync(workDir)) return `Error: Directory not found: ${cwd}`;
  try {
    const output = execSync(command, {
      cwd: workDir,
      timeout: COMMAND_TIMEOUT,
      encoding: "utf-8",
      // On Windows use cmd.exe; on Unix use /bin/sh
      shell: IS_WINDOWS ? "cmd.exe" : "/bin/sh",
      env: {
        ...process.env,
        TERM: "dumb",
        // Make sure common tool paths are included on Windows
        ...(IS_WINDOWS ? {} : { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin" }),
      },
    });
    return output.trim() || "(command completed with no output)";
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    return out || err.message || String(e);
  }
}

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".gradle", "__pycache__",
  ".next", "coverage", ".turbo", ".cache", "out",
]);

export function toolListDirectory(path: string | undefined, projectRoot: string): string {
  const abs = path ? sanitizePath(path, projectRoot) : projectRoot;
  if (!existsSync(abs)) return `Error: Directory not found: ${path ?? "."}`;
  if (!statSync(abs).isDirectory()) return `Error: ${path} is not a directory`;

  function walk(dir: string, depth = 0, maxDepth = 4): string[] {
    if (depth > maxDepth) return [`${"  ".repeat(depth)}...`];
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return []; }
    const filtered = entries.filter((n) => !EXCLUDED_DIRS.has(n));
    const results: string[] = [];
    for (const item of filtered) {
      const full = join(dir, item);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      // Use path.relative for cross-platform compatibility, then normalize to forward slashes
      const rel = relative(projectRoot, full).replace(/\\/g, "/");
      const prefix = "  ".repeat(depth);
      if (stat.isDirectory()) {
        results.push(`${prefix}📁 ${item}/`);
        results.push(...walk(full, depth + 1, maxDepth));
      } else {
        const size = stat.size > 1024 ? `${Math.round(stat.size / 1024)}KB` : `${stat.size}B`;
        results.push(`${prefix}📄 ${rel} (${size})`);
      }
    }
    return results;
  }

  const lines = walk(abs);
  return lines.length === 0 ? "(empty directory)" : lines.join("\n");
}

const SEARCH_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json",
  ".gradle", ".xml", ".kt", ".java",
  ".html", ".css", ".vue", ".svelte",
  ".md", ".txt", ".yaml", ".yml", ".toml", ".env",
]);

/**
 * Pure Node.js recursive search — works on Windows AND Linux/macOS.
 * No reliance on grep/findstr/external commands.
 */
export function toolSearchFiles(query: string, directory: string | undefined, projectRoot: string): string {
  const abs = directory ? sanitizePath(directory, projectRoot) : projectRoot;
  if (!existsSync(abs)) return `Error: Directory not found: ${directory ?? "."}`;

  const results: string[] = [];
  const MAX_RESULTS = 10;
  const lowerQuery = query.toLowerCase();

  function searchDir(dir: string) {
    if (results.length >= MAX_RESULTS) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try { stat = statSync(full); } catch { continue; }

      if (stat.isDirectory()) {
        searchDir(full);
      } else if (SEARCH_EXTENSIONS.has(extname(entry).toLowerCase())) {
        try {
          const content = readFileSync(full, "utf-8");
          const lines = content.split("\n");
          const matches: string[] = [];
          for (let i = 0; i < lines.length && matches.length < 3; i++) {
            if (lines[i].toLowerCase().includes(lowerQuery)) {
              matches.push(`  ${i + 1}: ${lines[i].trim().slice(0, 120)}`);
            }
          }
          if (matches.length > 0) {
            const rel = relative(projectRoot, full).replace(/\\/g, "/");
            results.push(`${rel}:\n${matches.join("\n")}`);
          }
        } catch {
          // Skip binary or unreadable files
        }
      }
    }
  }

  searchDir(abs);
  return results.length === 0
    ? `No matches found for "${query}"`
    : results.join("\n\n");
}

// ── Tool declarations & dispatcher ────────────────────────────────────────────

export type ToolName = "read_file" | "write_file" | "run_command" | "list_directory" | "search_files";

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
}

export function executeTool(call: ToolCall, projectRoot: string): string {
  try {
    switch (call.name) {
      case "read_file":
        return toolReadFile(String(call.args.path), projectRoot);
      case "write_file":
        return toolWriteFile(String(call.args.path), String(call.args.content), projectRoot);
      case "run_command":
        return toolRunCommand(
          String(call.args.command),
          call.args.cwd ? String(call.args.cwd) : undefined,
          projectRoot
        );
      case "list_directory":
        return toolListDirectory(
          call.args.path ? String(call.args.path) : undefined,
          projectRoot
        );
      case "search_files":
        return toolSearchFiles(
          String(call.args.query),
          call.args.directory ? String(call.args.directory) : undefined,
          projectRoot
        );
      default:
        return `Unknown tool: ${call.name}`;
    }
  } catch (e: unknown) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export const TOOL_DECLARATIONS = [
  {
    name: "read_file",
    description: "Read the content of a file. Always read a file before modifying it.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file, relative to the project root. Use forward slashes (works on all platforms)." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file. Parent directories are created automatically. Always write the COMPLETE file content — no partial edits.",
    parameters: {
      type: "object",
      properties: {
        path:    { type: "string", description: "Relative path to the file (use forward slashes)." },
        content: { type: "string", description: "Complete file content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "Execute a shell command in the project (or a subdirectory). On Windows this runs via cmd.exe; on Linux/macOS via /bin/sh. Use platform-appropriate commands when possible (e.g. gradlew.bat on Windows, ./gradlew on Linux).",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run." },
        cwd:     { type: "string", description: "Working directory relative to project root (optional)." },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories. Use to explore project structure before reading or writing files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to list, relative to project root (optional — defaults to root)." },
      },
      required: [],
    },
  },
  {
    name: "search_files",
    description: "Search for text or code patterns across all project files. Returns file paths and matching lines. Works on all platforms (no grep required).",
    parameters: {
      type: "object",
      properties: {
        query:     { type: "string", description: "Text or code pattern to search for (case-insensitive)." },
        directory: { type: "string", description: "Directory to search in, relative to project root (optional)." },
      },
      required: ["query"],
    },
  },
];
