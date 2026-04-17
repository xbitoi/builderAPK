import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, X, Send, Trash2, Plus, ChevronDown,
  MessageSquare, Loader2, AlertCircle, Copy, Check,
  FileSearch, Sparkles, Wrench, Code2, Shield, Zap,
  Database, Command,
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
  { value: "gemini-2.5-pro", label: "2.5 Pro" },
  { value: "gemini-2.0-flash", label: "2.0 Flash" },
  { value: "gemini-1.5-pro", label: "1.5 Pro" },
];

const AGENTS = [
  { id: "general",        label: "General",       icon: Bot,       color: "text-primary",    bg: "bg-primary/10 border-primary/30",      desc: "Android build assistant" },
  { id: "build-resolver", label: "Build Fix",     icon: Wrench,    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",       desc: "Fix build & Gradle errors" },
  { id: "architect",      label: "Architect",     icon: Code2,     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",     desc: "System design & architecture" },
  { id: "code-reviewer",  label: "Reviewer",      icon: Shield,    color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30",   desc: "Code quality & security" },
  { id: "performance",    label: "Performance",   icon: Zap,       color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30",   desc: "Optimize APK & build speed" },
  { id: "database-reviewer", label: "Database",  icon: Database,  color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30", desc: "PostgreSQL & Drizzle ORM" },
];

const SLASH_COMMANDS = [
  { cmd: "/fix",      label: "Fix build errors",             template: "Fix the following build error:\n\n```\n\n```" },
  { cmd: "/review",   label: "Review code",                  template: "Please review the following code for quality, security, and best practices:\n\n```\n\n```" },
  { cmd: "/gradle",   label: "Fix Gradle issue",             template: "Fix this Gradle build error for my Android project:\n\n```\n\n```" },
  { cmd: "/plan",     label: "Plan implementation",          template: "Create a step-by-step implementation plan for:\n\n" },
  { cmd: "/analyze",  label: "Analyze build logs",           template: "Analyze these Android build logs and identify all errors with fix steps:\n\n```\n\n```" },
  { cmd: "/optimize", label: "Optimize APK size/speed",      template: "How can I optimize the following for my Android APK:\n\n" },
  { cmd: "/keystore", label: "Keystore help",                template: "Help me with Android keystore signing:\n\n" },
  { cmd: "/capacitor",label: "Capacitor configuration",      template: "Help me configure Capacitor for:\n\n" },
  { cmd: "/playstore",label: "Play Store preparation",       template: "What do I need to prepare for Play Store submission? My app details:\n\n" },
];

type Role = "user" | "assistant";
interface Message { id: number; role: Role; content: string; streaming?: boolean; }
interface Conversation { id: number; title: string; createdAt: string; }

function SimpleMarkdown({ text }: { text: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0; let match: RegExpExecArray | null; let idx = 0;

  const copyCode = (code: string, i: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const inlineFmt = (str: string) =>
    str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
      if (chunk.startsWith("**") && chunk.endsWith("**"))
        return <strong key={i} className="text-foreground font-semibold">{chunk.slice(2, -2)}</strong>;
      if (chunk.startsWith("`") && chunk.endsWith("`"))
        return <code key={i} className="bg-slate-800 text-green-300 px-1.5 py-0.5 rounded text-xs font-mono">{chunk.slice(1, -1)}</code>;
      return chunk;
    });

  const renderPara = (block: string, key: number) => {
    if (block.startsWith("# ")) return <h3 key={key} className="text-base font-bold text-foreground mt-3 mb-1">{block.slice(2)}</h3>;
    if (block.startsWith("## ")) return <h4 key={key} className="text-sm font-bold text-foreground mt-2 mb-1">{block.slice(3)}</h4>;
    if (block.startsWith("### ")) return <h5 key={key} className="text-sm font-semibold text-primary mt-2 mb-1">{block.slice(4)}</h5>;
    const lines = block.split("\n");
    if (lines.every((l) => l.match(/^[-*•]\s/) || l === "")) {
      return (
        <ul key={key} className="list-none space-y-0.5 my-1">
          {lines.filter(Boolean).map((l, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">▸</span>
              <span>{inlineFmt(l.replace(/^[-*•]\s/, ""))}</span>
            </li>
          ))}
        </ul>
      );
    }
    return <p key={key} className="text-sm text-muted-foreground leading-relaxed my-1">{inlineFmt(block)}</p>;
  };

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const before = text.slice(last, match.index);
    if (before.trim()) before.split("\n\n").forEach((b, i) => { if (b.trim()) parts.push(renderPara(b.trim(), idx++ * 100 + i)); });
    const lang = match[1] || "text"; const code = match[2].trim(); const cIdx = idx++;
    parts.push(
      <div key={cIdx} className="relative group my-2 rounded-lg overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700">
          <span className="text-xs text-slate-400 font-mono">{lang}</span>
          <button onClick={() => copyCode(code, cIdx)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            {copiedIdx === cIdx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedIdx === cIdx ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="text-xs text-green-300 font-mono p-3 overflow-x-auto bg-slate-900 leading-relaxed"><code>{code}</code></pre>
      </div>
    );
    last = match.index + match[0].length;
  }
  const remaining = text.slice(last);
  if (remaining.trim()) remaining.split("\n\n").forEach((b, i) => { if (b.trim()) parts.push(renderPara(b.trim(), idx++ * 100 + i)); });
  return <div className="space-y-0.5">{parts}</div>;
}

export default function AIChatPanel({ onClose }: { onClose?: () => void }) {
  const { isOpen, setIsOpen, contextLogs, setContextLogs } = useAIChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [agentMode, setAgentMode] = useState("general");
  const [streaming, setStreaming] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [slashCmds, setSlashCmds] = useState<typeof SLASH_COMMANDS>([]);
  const [slashIdx, setSlashIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try { const r = await fetch(`${API}/gemini/conversations`); setConversations(await r.json()); }
    finally { setLoadingConvs(false); }
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    const r = await fetch(`${API}/gemini/conversations/${convId}`);
    const data = await r.json();
    setMessages((data.messages || []).map((m: { id: number; role: string; content: string }) => ({ id: m.id, role: m.role as Role, content: m.content })));
  }, []);

  useEffect(() => { if (isOpen) loadConversations(); }, [isOpen, loadConversations]);
  useEffect(() => { if (activeConvId !== null) loadMessages(activeConvId); }, [activeConvId, loadMessages]);

  // Slash command detection
  useEffect(() => {
    if (input.startsWith("/") && !input.includes(" ")) {
      const q = input.toLowerCase();
      const matches = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q));
      setSlashCmds(matches);
      setSlashIdx(0);
    } else {
      setSlashCmds([]);
    }
  }, [input]);

  const applySlashCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
    setInput(cmd.template);
    setSlashCmds([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const createConv = async (initialMsg?: string) => {
    const title = initialMsg ? initialMsg.slice(0, 40) + (initialMsg.length > 40 ? "…" : "") : "New Chat";
    const r = await fetch(`${API}/gemini/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const conv = await r.json();
    setConversations((prev) => [...prev, conv]);
    setActiveConvId(conv.id);
    setMessages([]);
    return conv.id;
  };

  const deleteConv = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${API}/gemini/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  };

  const sendMessage = async (msgContent?: string) => {
    const content = (msgContent ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    let convId = activeConvId;
    if (!convId) convId = await createConv(content);

    const userMsg: Message = { id: Date.now(), role: "user", content };
    const asstMsg: Message = { id: Date.now() + 1, role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const r = await fetch(`${API}/gemini/conversations/${convId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model, agentMode }), signal: abortRef.current.signal,
      });
      const reader = r.body?.getReader(); const decoder = new TextDecoder();
      let buffer = ""; let full = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6); if (data === "[DONE]") break;
              try { const parsed = JSON.parse(data); if (parsed.text) { full += parsed.text; setMessages((prev) => prev.map((m) => m.streaming ? { ...m, content: full } : m)); } } catch { /* ignore */ }
            }
          }
        }
      }
      setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false, content: full || "(no response)" } : m));
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: content.slice(0, 40) } : c));
    } catch (err) {
      if ((err as Error).name !== "AbortError")
        setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false, content: "Error: failed to get response." } : m));
    } finally { setStreaming(false); abortRef.current = null; }
  };

  const handleAnalyzeLogs = () => {
    if (!contextLogs) return;
    setAgentMode("build-resolver");
    const prompt = `Analyze these Android build logs and identify all errors with specific fix steps:\n\n\`\`\`\n${contextLogs.slice(0, 3000)}\n\`\`\``;
    setContextLogs(null); sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashCmds.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, slashCmds.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); applySlashCommand(slashCmds[slashIdx]); return; }
      if (e.key === "Escape") { setSlashCmds([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const stopStreaming = () => {
    abortRef.current?.abort(); setStreaming(false);
    setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
  };

  const activeAgent = AGENTS.find((a) => a.id === agentMode) ?? AGENTS[0];

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-sidebar/95 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg border", activeAgent.bg)}>
            <activeAgent.icon className={cn("w-3.5 h-3.5", activeAgent.color)} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">AI Assistant</div>
            <div className={cn("text-xs", activeAgent.color)}>{activeAgent.label} Mode</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 text-xs w-28 border-border bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setIsOpen(false); onClose?.(); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Agent selector */}
      <div className="flex gap-1 px-2 py-2 border-b border-border bg-background/10 flex-shrink-0 overflow-x-auto scrollbar-none">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgentMode(a.id)}
            title={a.desc}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
              agentMode === a.id
                ? cn("border", a.bg, a.color)
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground bg-transparent"
            )}
          >
            <a.icon className="w-3 h-3" />
            {a.label}
          </button>
        ))}
      </div>

      {/* Conversation bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/20 flex-shrink-0">
        <button onClick={() => setShowConvList((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left group">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
            {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title ?? "Chat" : "No conversation selected"}
          </span>
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform", showConvList && "rotate-180")} />
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary flex-shrink-0"
          onClick={() => { setActiveConvId(null); setMessages([]); setShowConvList(false); }} title="New conversation">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Conversation list */}
      <AnimatePresence>
        {showConvList && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden flex-shrink-0 border-b border-border">
            <div className="max-h-44 overflow-y-auto bg-background/50">
              {loadingConvs ? <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                : conversations.length === 0 ? <div className="text-xs text-muted-foreground text-center py-4">No conversations yet</div>
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

      {/* Context logs banner */}
      <AnimatePresence>
        {contextLogs && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
            <FileSearch className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300 flex-1">Build logs ready</span>
            <Button size="sm" className="h-6 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30" onClick={handleAnalyzeLogs}>
              Analyze
            </Button>
            <button onClick={() => setContextLogs(null)} className="text-amber-400/60 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center mb-3", activeAgent.bg)}>
                <activeAgent.icon className={cn("w-6 h-6", activeAgent.color)} />
              </div>
              <div className="text-sm font-medium text-foreground mb-1">{activeAgent.label} Agent</div>
              <div className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-4">{activeAgent.desc}</div>
              <div className="w-full space-y-1.5">
                {agentMode === "general" && ["Analyze my build logs for errors", "How do I configure Capacitor?", "Help me set up a release keystore"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                {agentMode === "build-resolver" && ["Fix my Gradle sync error", "Resolve a TypeScript build error", "Fix duplicate class in Android build"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-red-500/40 hover:bg-red-500/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                {agentMode === "architect" && ["Design my web-to-Android pipeline", "Best structure for a Capacitor app", "Plan a multi-flavor Android build"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-blue-500/40 hover:bg-blue-500/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                {agentMode === "code-reviewer" && ["Review my Capacitor config", "Review my build.gradle file", "Check my AndroidManifest.xml"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-amber-500/40 hover:bg-amber-500/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                {agentMode === "performance" && ["Reduce my APK size", "Speed up Gradle build time", "Optimize WebView performance"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-green-500/40 hover:bg-green-500/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                {agentMode === "database-reviewer" && ["Optimize my build logs query", "Review my Drizzle schema", "Add indexes for faster queries"].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="w-full text-xs text-left px-3 py-2 rounded-lg bg-background/50 border border-border hover:border-purple-500/40 hover:bg-purple-500/5 text-muted-foreground hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 pt-1 justify-center">
                  <Command className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground/50">Type <code className="font-mono">/</code> for slash commands</span>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {msg.role === "assistant" && (
                <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5", activeAgent.bg)}>
                  <activeAgent.icon className={cn("w-3 h-3", activeAgent.color)} />
                </div>
              )}
              <div className={cn("max-w-[85%] rounded-xl px-3 py-2.5",
                msg.role === "user" ? "bg-primary/20 border border-primary/30 ml-auto" : "bg-background/60 border border-border")}>
                {msg.role === "user"
                  ? <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  : <>
                    {msg.content ? <SimpleMarkdown text={msg.content} /> : null}
                    {msg.streaming && (
                      <span className="inline-flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </>
                }
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Slash command popup */}
      <AnimatePresence>
        {slashCmds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="mx-3 mb-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden flex-shrink-0">
            {slashCmds.map((c, i) => (
              <button key={c.cmd} onClick={() => applySlashCommand(c)}
                className={cn("flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                  i === slashIdx ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}>
                <code className="text-xs font-mono text-primary w-20 flex-shrink-0">{c.cmd}</code>
                <span className="text-xs">{c.label}</span>
              </button>
            ))}
            <div className="px-3 py-1 text-xs text-muted-foreground/50 border-t border-border bg-background/50">
              Tab or Enter to select · Esc to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="relative flex-1">
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={`${activeAgent.label} · Ask anything or type / for commands`} rows={2} disabled={streaming}
              className="w-full resize-none rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50" />
          </div>
          {streaming
            ? <Button size="icon" variant="destructive" className="h-10 w-10 flex-shrink-0" onClick={stopStreaming}><AlertCircle className="w-4 h-4" /></Button>
            : <Button size="icon" disabled={!input.trim()} className="h-10 w-10 flex-shrink-0 bg-primary hover:bg-primary/90" onClick={() => sendMessage()}>
                <Send className="w-4 h-4" />
              </Button>
          }
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Sparkles className={cn("w-2.5 h-2.5", activeAgent.color)} />
            <span className="text-xs text-muted-foreground/50">{activeAgent.label}</span>
          </div>
          <div className="text-xs text-muted-foreground/50 hidden sm:block">Enter · Shift+Enter new line</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: inline left panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div key="ai-desktop" initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="hidden md:flex flex-shrink-0 flex-col border-r border-border bg-sidebar overflow-hidden" style={{ minWidth: 0 }}>
            <div className="flex flex-col h-full w-[380px]">{panelContent}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: full-screen overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="ai-mobile-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => { setIsOpen(false); onClose?.(); }} />
            <motion.div key="ai-mobile-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-sidebar border-t border-border rounded-t-2xl shadow-2xl"
              style={{ height: "88dvh" }}>
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
