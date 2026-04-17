import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, resolve, dirname } from "path";

const MAX_FILE_SIZE = 150 * 1024;
const MAX_STEPS = 12;
const COMMAND_TIMEOUT = 45_000;

export { MAX_STEPS };

export function sanitizePath(userPath: string, projectRoot: string): string {
  const abs = resolve(projectRoot, userPath.replace(/^\//, ""));
  const root = resolve(projectRoot);
  if (!abs.startsWith(root)) throw new Error(`Access denied: path outside project root. Root: ${root}`);
  return abs;
}

export function toolReadFile(path: string, projectRoot: string): string {
  const abs = sanitizePath(path, projectRoot);
  if (!existsSync(abs)) return `Error: File not found: ${path}`;
  const stat = statSync(abs);
  if (stat.isDirectory()) return `Error: ${path} is a directory, use list_directory instead`;
  const content = readFileSync(abs, "utf-8");
  if (content.length > MAX_FILE_SIZE)
    return content.slice(0, MAX_FILE_SIZE) + `\n\n[...truncated, file is ${Math.round(stat.size / 1024)}KB]`;
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
      env: { ...process.env, TERM: "dumb" },
    });
    return output.trim() || "(command completed with no output)";
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    return out || err.message || String(e);
  }
}

export function toolListDirectory(path: string | undefined, projectRoot: string): string {
  const abs = path ? sanitizePath(path, projectRoot) : projectRoot;
  if (!existsSync(abs)) return `Error: Directory not found: ${path ?? "."}`;
  if (!statSync(abs).isDirectory()) return `Error: ${path} is not a directory`;

  function walk(dir: string, depth = 0, maxDepth = 4): string[] {
    if (depth > maxDepth) return [`${" ".repeat(depth * 2)}...`];
    const items = readdirSync(dir).filter(
      (n) => !["node_modules", ".git", "dist", "build", ".gradle", "__pycache__", ".next", "coverage"].includes(n)
    );
    const results: string[] = [];
    for (const item of items) {
      const full = join(dir, item);
      const rel = full.replace(projectRoot, "").replace(/^\//, "");
      const stat = statSync(full);
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

export function toolSearchFiles(query: string, directory: string | undefined, projectRoot: string): string {
  const abs = directory ? sanitizePath(directory, projectRoot) : projectRoot;
  if (!existsSync(abs)) return `Error: Directory not found: ${directory ?? "."}`;
  try {
    const result = execSync(
      `grep -rn "${query.replace(/"/g, '\\"')}" "${abs}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.gradle" --include="*.xml" --include="*.kt" --include="*.java" --include="*.html" --include="*.css" --include="*.vue" --include="*.svelte" -l --max-count=3 2>/dev/null || true`,
      { encoding: "utf-8", timeout: 10_000 }
    ).trim();
    if (!result) return "No matches found";
    const files = result.split("\n").slice(0, 10);
    const details = files.map((f) => {
      const matches = execSync(
        `grep -n "${query.replace(/"/g, '\\"')}" "${f}" --max-count=3 2>/dev/null || true`,
        { encoding: "utf-8" }
      ).trim();
      return `${f.replace(projectRoot + "/", "")}:\n${matches}`;
    });
    return details.join("\n\n");
  } catch {
    return "Search failed";
  }
}

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
        return toolRunCommand(String(call.args.command), call.args.cwd ? String(call.args.cwd) : undefined, projectRoot);
      case "list_directory":
        return toolListDirectory(call.args.path ? String(call.args.path) : undefined, projectRoot);
      case "search_files":
        return toolSearchFiles(String(call.args.query), call.args.directory ? String(call.args.directory) : undefined, projectRoot);
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
    description: "Read the content of a file in the project. Use this to understand existing code before modifying it.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file from the project root" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write or overwrite a file in the project. Creates parent directories automatically. Use this to create or modify code files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file from the project root" },
        content: { type: "string", description: "Complete file content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the project directory. Use for npm install, build commands, git operations, gradle builds, etc.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        cwd: { type: "string", description: "Working directory relative to project root (optional, defaults to project root)" },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories in the project. Use to explore the project structure before reading or writing files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the directory (optional, defaults to project root)" },
      },
      required: [],
    },
  },
  {
    name: "search_files",
    description: "Search for text/code patterns across project files. Useful for finding where a function is defined or where a config key is used.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text or code pattern to search for" },
        directory: { type: "string", description: "Directory to search in (optional, defaults to project root)" },
      },
      required: ["query"],
    },
  },
];
