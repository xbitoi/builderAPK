import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, X, Send, Trash2, Plus, ChevronDown, ChevronRight,
  MessageSquare, Loader2, AlertCircle, Copy, Check,
  FileSearch, Sparkles, FileCode, Terminal, FolderOpen,
  Search, FileEdit, Command, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useAIChat } from "@/contexts/AIChatContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const MODELS = [
  { value: "gemini-2.5-flash", label: "2.5 Flash" },
  { value: "gemini-2.5-pro",   label: "2.5 Pro" },
  { value: "gemini-2.0-flash", label: "2.0 Flash" },
  { value: "gemini-1.5-pro",   label: "1.5 Pro" },
];

const SLASH_COMMANDS = [
  { cmd: "/fix",       label: "Fix build or code error",       template: "Fix the following error:\n\n```\n\n```" },
  { cmd: "/review",    label: "Review code quality/security",  template: "Review this code:\n\n```\n\n```" },
  { cmd: "/gradle",    label: "Fix Gradle issue",              template: "Fix this Gradle error:\n\n```\n\n```" },
  { cmd: "/plan",      label: "Plan implementation",           template: "Create an implementation plan for:\n\n" },
  { cmd: "/analyze",   label: "Analyze build logs",            template: "Analyze these build logs:\n\n```\n\n```" },
  { cmd: "/optimize",  label: "Optimize APK or performance",   template: "Optimize my Android APK for:\n\n" },
  { cmd: "/write",     label: "Write code to a file",          template: "Write the following to my project:\n\n" },
  { cmd: "/run",       label: "Run a command",                 template: "Run this in my project:\n\n" },
  { cmd: "/explain",   label: "Explain code or concept",       template: "Explain:\n\n" },
  { cmd: "/keystore",  label: "Keystore & signing help",       template: "Help with Android keystore:\n\n" },
  { cmd: "/playstore", label: "Play Store preparation",        template: "Help prepare for Play Store:\n\n" },
];

const TOOL_ICONS: Record<string, typeof FileCode> = {
  read_file:      FileCode,
  write_file:     FileEdit,
  run_command:    Terminal,
  list_directory: FolderOpen,
  search_files:   Search,
};

const TOOL_LABELS: Record<string, string> = {
  read_file:      "Reading",
  write_file:     "Writing",
  run_command:    "Running",
  list_directory: "Listing",
  search_files:   "Searching",
};

const QUICK_PROMPTS = [
  "Fix my build error",
  "How do I configure Capacitor for my app?",
  "Help me set up a release keystore for Play Store",
  "Reduce my APK size",
  "Analyze my Gradle build failure",
];

type Role = "user" | "assistant";

interface ToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  collapsed: boolean;
}

interface Message {
  id: number;
  role: Role;
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
}

interface Conversation { id: number; title: string; createdAt: string; }

// ── Markdown renderer ─────────────────────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const parts: React.ReactNode[] = [];
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0; let match: RegExpExecArray | null; let idx = 0;

  const copyCode = (code: string, i: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000);
  };

  const inline = (str: string) =>
    str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((c, i) => {
      if (c.startsWith("**") && c.endsWith("**"))
        return <strong key={i} className="text-foreground font-semibold">{c.slice(2, -2)}</strong>;
      if (c.startsWith("`") && c.endsWith("`"))
        return <code key={i} className="bg-slate-800 text-green-300 px-1.5 py-0.5 rounded text-xs font-mono">{c.slice(1, -1)}</code>;
      return c;
    });

  const para = (block: string, key: number) => {
    if (block.startsWith("# "))  return <h3 key={key} className="text-base font-bold text-foreground mt-3 mb-1">{block.slice(2)}</h3>;
    if (block.startsWith("## ")) return <h4 key={key} className="text-sm font-bold text-foreground mt-2 mb-1">{block.slice(3)}</h4>;
    if (block.startsWith("### ")) return <h5 key={key} className="text-sm font-semibold text-primary mt-2 mb-1">{block.slice(4)}</h5>;
    const lines = block.split("\n");
    if (lines.every((l) => l.match(/^[-*•]\s/) || l === ""))
      return (
        <ul key={key} className="list-none space-y-0.5 my-1">
          {lines.filter(Boolean).map((l, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">▸</span>
              <span>{inline(l.replace(/^[-*•]\s/, ""))}</span>
            </li>
          ))}
        </ul>
      );
    return <p key={key} className="text-sm text-muted-foreground leading-relaxed my-1">{inline(block)}</p>;
  };

  while ((match = codeRe.exec(text)) !== null) {
    const before = text.slice(last, match.index);
    if (before.trim()) before.split("\n\n").forEach((b, i) => { if (b.trim()) parts.push(para(b.trim(), idx++ * 100 + i)); });
    const lang = match[1] || "text"; const code = match[2].trim(); const ci = idx++;
    parts.push(
      <div key={ci} className="my-2 rounded-lg overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700">
          <span className="text-xs text-slate-400 font-mono">{lang}</span>
          <button onClick={() => copyCode(code, ci)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            {copiedIdx === ci ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedIdx === ci ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="text-xs text-green-300 font-mono p-3 overflow-x-auto bg-slate-900 leading-relaxed"><code>{code}</code></pre>
      </div>
    );
    last = match.index + match[0].length;
  }
  const rem = text.slice(last);
  if (rem.trim()) rem.split("\n\n").forEach((b, i) => { if (b.trim()) parts.push(para(b.trim(), idx++ * 100 + i)); });
  return <div className="space-y-0.5">{parts}</div>;
}

// ── Tool call card ────────────────────────────────────────────────────────────
function ToolCard({ ev, onToggle }: { ev: ToolEvent; onToggle: () => void }) {
  const Icon = TOOL_ICONS[ev.name] ?? Terminal;
  const label = TOOL_LABELS[ev.name] ?? ev.name;
  const done = ev.output !== undefined;

  const argHint = ev.args.path ? String(ev.args.path)
    : ev.args.command ? String(ev.args.command)
    : ev.args.query ? `"${String(ev.args.query)}"`
    : "";

  return (
    <div className={cn(
      "rounded-lg border text-xs overflow-hidden my-1.5",
      !done         ? "border-blue-500/20 bg-blue-500/5"  :
      ev.isError    ? "border-red-500/20 bg-red-500/5"    :
                      "border-border bg-background/40"
    )}>
      <button onClick={onToggle} className="flex items-center gap-2 w-full px-2.5 py-2 text-left hover:bg-white/5 transition-colors">
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0",
          !done ? "text-blue-400 animate-pulse" : ev.isError ? "text-red-400" : "text-green-400"
        )} />
        <span className={cn("font-mono flex-shrink-0 font-medium",
          !done ? "text-blue-300" : ev.isError ? "text-red-300" : "text-muted-foreground"
        )}>{label}</span>
        {argHint && <span className="text-muted-foreground/60 truncate flex-1 font-mono">{argHint}</span>}
        <span className="ml-auto flex-shrink-0">
          {!done
            ? <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            : ev.collapsed
              ? <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
          }
        </span>
      </button>
      {!ev.collapsed && ev.output && (
        <div className="border-t border-border/50 px-2.5 py-2 max-h-56 overflow-y-auto">
          <pre className={cn("text-xs font-mono whitespace-pre-wrap break-words leading-relaxed",
            ev.isError ? "text-red-300" : "text-slate-300"
          )}>{ev.output.slice(0, 3000)}{ev.output.length > 3000 ? "\n[truncated]" : ""}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIChatPanel({ onClose }: { onClose?: () => void }) {
  const { isOpen, setIsOpen, contextLogs, setContextLogs } = useAIChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [useTools, setUseTools] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [slashCmds, setSlashCmds] = useState<typeof SLASH_COMMANDS>([]);
  const [slashIdx, setSlashIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try { const r = await fetch(`${API}/gemini/conversations`); setConversations(await r.json()); }
    finally { setLoadingConvs(false); }
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    const r = await fetch(`${API}/gemini/conversations/${convId}`);
    const data = await r.json();
    setMessages((data.messages || []).map((m: { id: number; role: string; content: string }) => ({
      id: m.id, role: m.role as Role, content: m.content,
    })));
  }, []);

  useEffect(() => { if (isOpen) loadConversations(); }, [isOpen, loadConversations]);
  useEffect(() => { if (activeConvId !== null) loadMessages(activeConvId); }, [activeConvId, loadMessages]);

  useEffect(() => {
    if (input.startsWith("/") && !input.includes(" ") && !input.includes("\n")) {
      setSlashCmds(SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase())));
      setSlashIdx(0);
    } else {
      setSlashCmds([]);
    }
  }, [input]);

  const applyCmd = (cmd: typeof SLASH_COMMANDS[0]) => {
    setInput(cmd.template); setSlashCmds([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const createConv = async (msg?: string) => {
    const title = msg ? msg.slice(0, 40) + (msg.length > 40 ? "…" : "") : "New Chat";
    const r = await fetch(`${API}/gemini/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const conv = await r.json();
    setConversations((p) => [...p, conv]);
    setActiveConvId(conv.id);
    setMessages([]);
    return conv.id as number;
  };

  const deleteConv = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${API}/gemini/conversations/${id}`, { method: "DELETE" });
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const toggleTool = (msgId: number, evId: string) =>
    setMessages((p) => p.map((m) => m.id === msgId
      ? { ...m, toolEvents: m.toolEvents?.map((e) => e.id === evId ? { ...e, collapsed: !e.collapsed } : e) }
      : m
    ));

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    let convId = activeConvId ?? await createConv(content);

    const uid = Date.now();
    const aid = uid + 1;
    setMessages((p) => [...p,
      { id: uid, role: "user", content },
      { id: aid, role: "assistant", content: "", streaming: true, toolEvents: [] },
    ]);
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const r = await fetch(`${API}/gemini/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model, useTools }),
        signal: abortRef.current.signal,
      });

      const reader = r.body?.getReader();
      const dec = new TextDecoder();
      let buf = ""; let full = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            if (raw === "[DONE]") break;
            try {
              const ev = JSON.parse(raw) as {
                type?: string; text?: string; id?: string; name?: string;
                args?: Record<string, unknown>; output?: string; isError?: boolean; message?: string;
              };
              if (ev.type === "text" || ev.text) {
                full += ev.text ?? "";
                setMessages((p) => p.map((m) => m.id === aid ? { ...m, content: full } : m));
              } else if (ev.type === "tool_call") {
                setMessages((p) => p.map((m) => m.id === aid ? {
                  ...m, toolEvents: [...(m.toolEvents ?? []), { id: ev.id!, name: ev.name!, args: ev.args ?? {}, collapsed: false }],
                } : m));
              } else if (ev.type === "tool_result") {
                setMessages((p) => p.map((m) => m.id === aid ? {
                  ...m, toolEvents: m.toolEvents?.map((e) => e.id === ev.id
                    ? { ...e, output: ev.output, isError: ev.isError ?? false, collapsed: true } : e),
                } : m));
              } else if (ev.type === "error") {
                full += `\n\n**Error:** ${ev.message}`;
                setMessages((p) => p.map((m) => m.id === aid ? { ...m, content: full } : m));
              }
            } catch { /* ignore */ }
          }
        }
      }
      setMessages((p) => p.map((m) => m.id === aid ? { ...m, streaming: false, content: full || "(no response)" } : m));
      setConversations((p) => p.map((c) => c.id === convId ? { ...c, title: content.slice(0, 40) } : c));
    } catch (err) {
      if ((err as Error).name !== "AbortError")
        setMessages((p) => p.map((m) => m.id === aid ? { ...m, streaming: false, content: "Failed to get a response." } : m));
    } finally { setStreaming(false); abortRef.current = null; }
  };

  const handleAnalyzeLogs = () => {
    if (!contextLogs) return;
    const prompt = `Analyze these Android build logs and fix all errors:\n\n\`\`\`\n${contextLogs.slice(0, 3000)}\n\`\`\``;
    setContextLogs(null); sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashCmds.length > 0) {
      if (e.key === "ArrowDown")                    { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, slashCmds.length - 1)); return; }
      if (e.key === "ArrowUp")                      { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || e.key === "Enter")     { e.preventDefault(); applyCmd(slashCmds[slashIdx]); return; }
      if (e.key === "Escape")                       { setSlashCmds([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const stopStreaming = () => {
    abortRef.current?.abort(); setStreaming(false);
    setMessages((p) => p.map((m) => m.streaming ? { ...m, streaming: false } : m));
  };

  const panel = (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-sidebar/95 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">AI Assistant</div>
            <div className="text-xs text-muted-foreground">
              {useTools ? <span className="text-primary">Agent — reads &amp; writes your project</span> : "Chat mode"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 text-xs w-28 border-border bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => { setIsOpen(false); onClose?.(); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Agent toggle ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Bot className={cn("w-3.5 h-3.5", useTools ? "text-primary" : "text-muted-foreground")} />
          <span className="text-xs text-muted-foreground">Agent Mode</span>
        </div>
        <button onClick={() => setUseTools((v) => !v)} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" title={useTools ? "Disable agent (chat only)" : "Enable agent (can read/write files)"}>
          <span className="text-xs text-muted-foreground/60">{useTools ? "ON" : "OFF"}</span>
          {useTools ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
        </button>
      </div>

      {/* ── Conversation bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/20 flex-shrink-0">
        <button onClick={() => setShowConvList((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left group">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
            {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title ?? "Chat" : "No conversation"}
          </span>
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform", showConvList && "rotate-180")} />
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary flex-shrink-0"
          onClick={() => { setActiveConvId(null); setMessages([]); setShowConvList(false); }}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── Conversation list ── */}
      <AnimatePresence>
        {showConvList && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0 border-b border-border">
            <div className="max-h-44 overflow-y-auto bg-background/50">
              {loadingConvs
                ? <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                : conversations.length === 0
                  ? <div className="text-xs text-muted-foreground text-center py-4">No conversations yet</div>
                  : conversations.map((conv) => (
                    <div key={conv.id} onClick={() => { setActiveConvId(conv.id); setShowConvList(false); }}
                      className={cn("flex items-center justify-between px-3 py-2 cursor-pointer group transition-colors",
                        activeConvId === conv.id ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground hover:text-foreground")}>
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        <span className="text-xs truncate">{conv.title}</span>
                      </div>
                      <button onClick={(e) => deleteConv(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Build logs banner ── */}
      <AnimatePresence>
        {contextLogs && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
            <FileSearch className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300 flex-1">Build logs captured</span>
            <Button size="sm" className="h-6 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30" onClick={handleAnalyzeLogs}>
              Analyze
            </Button>
            <button onClick={() => setContextLogs(null)} className="text-amber-400/60 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div className="text-sm font-semibold text-foreground mb-1">APK Builder Assistant</div>
              <div className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-4">
                Fixes build errors, writes code, runs commands, answers questions — automatically decides what to do.
              </div>
              {useTools && (
                <div className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-primary font-medium">Agent mode active — can edit your project</span>
                </div>
              )}
              <div className="w-full space-y-1.5">
                {QUICK_PROMPTS.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 pt-1 justify-center">
                  <Command className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground/40">Type <code className="font-mono">/</code> for slash commands</span>
                </div>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}
              <div className={cn("min-w-0", msg.role === "user" ? "max-w-[85%] ml-auto" : "flex-1")}>
                {msg.role === "user" ? (
                  <div className="bg-primary/20 border border-primary/30 rounded-xl px-3 py-2.5">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Tool event cards */}
                    {(msg.toolEvents ?? []).map((ev) => (
                      <ToolCard key={ev.id} ev={ev} onToggle={() => toggleTool(msg.id, ev.id)} />
                    ))}
                    {/* Text response */}
                    {(msg.content || msg.streaming) && (
                      <div className="bg-background/60 border border-border rounded-xl px-3 py-2.5">
                        {msg.content && <SimpleMarkdown text={msg.content} />}
                        {msg.streaming && !(msg.toolEvents ?? []).some((e) => !e.output) && (
                          <span className="inline-flex items-center gap-1 mt-1">
                            {[0, 150, 300].map((d) => (
                              <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Waiting for tool result */}
                    {!msg.content && msg.streaming && (msg.toolEvents ?? []).length === 0 && (
                      <div className="bg-background/60 border border-border rounded-xl px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {[0, 150, 300].map((d) => (
                            <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* ── Slash commands popup ── */}
      <AnimatePresence>
        {slashCmds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="mx-3 mb-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden flex-shrink-0">
            {slashCmds.map((c, i) => (
              <button key={c.cmd} onClick={() => applyCmd(c)}
                className={cn("flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                  i === slashIdx ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}>
                <code className="text-xs font-mono text-primary w-20 flex-shrink-0">{c.cmd}</code>
                <span className="text-xs">{c.label}</span>
              </button>
            ))}
            <div className="px-3 py-1 text-xs text-muted-foreground/40 border-t border-border bg-background/50">
              Tab / Enter · Esc to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input ── */}
      <div className="p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={useTools ? "Ask to fix, build, or write code…" : "Ask anything or type / for commands…"}
            rows={2}
            disabled={streaming}
            className="flex-1 resize-none rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
          />
          {streaming
            ? <Button size="icon" variant="destructive" className="h-10 w-10 flex-shrink-0" onClick={stopStreaming}><AlertCircle className="w-4 h-4" /></Button>
            : <Button size="icon" disabled={!input.trim()} className="h-10 w-10 flex-shrink-0 bg-primary hover:bg-primary/90" onClick={() => sendMessage()}><Send className="w-4 h-4" /></Button>
          }
        </div>
        <div className="mt-1 text-xs text-muted-foreground/40 text-center hidden sm:block">Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div key="ai-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="hidden md:flex flex-shrink-0 flex-col border-r border-border bg-sidebar overflow-hidden" style={{ minWidth: 0 }}>
            <div className="flex flex-col h-full w-[380px]">{panel}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="mobile-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => { setIsOpen(false); onClose?.(); }} />
            <motion.div key="mobile-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-sidebar border-t border-border rounded-t-2xl shadow-2xl"
              style={{ height: "88dvh" }}>
              {panel}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
