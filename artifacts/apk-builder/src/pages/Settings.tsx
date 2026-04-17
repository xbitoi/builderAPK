import { useState, useEffect } from "react";
import { useSystemCheck } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getSystemCheckQueryKey } from "@workspace/api-client-react";
import {
  CheckCircle, XCircle, AlertTriangle, Cpu, RefreshCw,
  KeyRound, Eye, EyeOff, Save, RotateCcw, Wifi, WifiOff, Loader2,
  FolderOpen, Bot,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface KeySlot {
  slot: number;
  label: string;
  isActive: boolean;
  hasKey: boolean;
  exhaustedUntil: string | null;
  updatedAt: string | null;
}

function KeySlotCard({ slot, onSaved }: { slot: KeySlot; onSaved: () => void }) {
  const [keyValue, setKeyValue] = useState("");
  const [label, setLabel] = useState(slot.label);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);

  const isExhausted =
    slot.exhaustedUntil !== null && new Date(slot.exhaustedUntil) > new Date();

  const statusColor = !slot.hasKey
    ? "border-border"
    : isExhausted
    ? "border-red-500/30 bg-red-500/5"
    : slot.isActive
    ? "border-green-500/25 bg-green-500/5"
    : "border-yellow-500/25 bg-yellow-500/5";

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { label };
      if (keyValue.trim()) body.keyValue = keyValue.trim();
      await fetch(`${API}/gemini-keys/${slot.slot}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setKeyValue("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    await fetch(`${API}/gemini-keys/${slot.slot}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !slot.isActive }),
    });
    onSaved();
  };

  const handleResetExhausted = async () => {
    setResetting(true);
    try {
      await fetch(`${API}/gemini-keys/${slot.slot}/reset-exhausted`, { method: "POST" });
      onSaved();
    } finally {
      setResetting(false);
    }
  };

  const exhaustedUntilFmt = slot.exhaustedUntil
    ? new Date(slot.exhaustedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${statusColor}`}>
      {/* Slot Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
            !slot.hasKey
              ? "bg-secondary border-border text-muted-foreground"
              : isExhausted
              ? "bg-red-500/20 border-red-500/40 text-red-400"
              : slot.isActive
              ? "bg-green-500/20 border-green-500/40 text-green-400"
              : "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
          }`}>
            {slot.slot}
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-sm font-medium text-foreground bg-transparent border-none outline-none focus:underline decoration-primary/40 w-28"
            placeholder={`Key ${slot.slot}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {!slot.hasKey ? (
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              Empty
            </span>
          ) : isExhausted ? (
            <span className="text-xs text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10">
              Exhausted until {exhaustedUntilFmt}
            </span>
          ) : slot.isActive ? (
            <span className="text-xs text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="text-xs text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Disabled
            </span>
          )}

          {/* Toggle active */}
          {slot.hasKey && !isExhausted && (
            <button
              onClick={handleToggleActive}
              title={slot.isActive ? "Disable key" : "Enable key"}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
            >
              {slot.isActive ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Reset exhausted */}
          {isExhausted && (
            <button
              onClick={handleResetExhausted}
              disabled={resetting}
              title="Reset exhausted status"
              className="text-xs text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-primary/10"
            >
              {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Key Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type={showKey ? "text" : "password"}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={slot.hasKey ? "Enter new key to replace…" : "AIza…"}
            className="w-full pl-8 pr-10 py-2 text-xs font-mono rounded-lg bg-background/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || (!keyValue.trim() && label === slot.label)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: system, isLoading, refetch } = useSystemCheck();
  const queryClient = useQueryClient();
  const [keySlots, setKeySlots] = useState<KeySlot[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [projectPath, setProjectPath] = useState("");
  const [projectPathInput, setProjectPathInput] = useState("");
  const [savingPath, setSavingPath] = useState(false);
  const [pathSaved, setPathSaved] = useState(false);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getSystemCheckQueryKey() });
    refetch();
  };

  const loadKeys = async () => {
    setLoadingKeys(true);
    try {
      const r = await fetch(`${API}/gemini-keys`);
      const data = await r.json();
      setKeySlots(data);
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadSettings = async () => {
    const r = await fetch(`${API}/settings`);
    const data = await r.json();
    const path = data.project_path ?? "";
    setProjectPath(path);
    setProjectPathInput(path);
  };

  const saveProjectPath = async () => {
    setSavingPath(true);
    try {
      await fetch(`${API}/settings/project_path`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: projectPathInput.trim() }),
      });
      setProjectPath(projectPathInput.trim());
      setPathSaved(true);
      setTimeout(() => setPathSaved(false), 2000);
    } finally {
      setSavingPath(false);
    }
  };

  useEffect(() => { loadKeys(); loadSettings(); }, []);

  const activeCount = keySlots.filter((k) => {
    if (!k.hasKey || !k.isActive) return false;
    if (k.exhaustedUntil && new Date(k.exhaustedUntil) > new Date()) return false;
    return true;
  }).length;

  const exhaustedCount = keySlots.filter(
    (k) => k.hasKey && k.exhaustedUntil && new Date(k.exhaustedUntil) > new Date()
  ).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your build environment</p>
      </div>

      {/* Gemini API Keys */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Gemini API Keys</h2>
          </div>
          <div className="flex items-center gap-3">
            {!loadingKeys && (
              <div className="flex items-center gap-2 text-xs">
                {activeCount > 0 && (
                  <span className="text-green-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> {activeCount} active
                  </span>
                )}
                {exhaustedCount > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> {exhaustedCount} exhausted
                  </span>
                )}
              </div>
            )}
            <button
              onClick={loadKeys}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Add up to 5 Gemini API keys. The AI assistant automatically rotates to the next key
          when one's quota is exhausted — no interruption to your workflow.
          Get keys from{" "}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Google AI Studio
          </a>.
        </p>

        {/* Rotation flow diagram */}
        {!loadingKeys && keySlots.some((k) => k.hasKey) && (
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {keySlots.filter((k) => k.hasKey).map((k, i, arr) => {
              const exhausted = k.exhaustedUntil && new Date(k.exhaustedUntil) > new Date();
              return (
                <div key={k.slot} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${
                    exhausted
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : !k.isActive
                      ? "bg-secondary border-border text-muted-foreground"
                      : "bg-green-500/10 border-green-500/25 text-green-400"
                  }`}>
                    <span className="font-mono font-bold">{k.slot}</span>
                    <span>{k.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loadingKeys ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[88px] bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {keySlots.map((slot) => (
              <KeySlotCard key={slot.slot} slot={slot} onSaved={loadKeys} />
            ))}
          </div>
        )}
      </div>

      {/* Agent Settings */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Agent Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set the project directory the AI agent will read and write files in. Leave empty to use the current working directory.
          On Windows, use the full path, e.g. <code className="font-mono bg-muted px-1 rounded">C:\Users\you\my-app</code>
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Project Path</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={projectPathInput}
                onChange={(e) => setProjectPathInput(e.target.value)}
                placeholder="/path/to/your/project   or   C:\Users\you\my-app"
                className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-lg bg-background/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={saveProjectPath}
              disabled={savingPath || projectPathInput === projectPath}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingPath ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : pathSaved ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {pathSaved ? "Saved" : "Save"}
            </button>
          </div>
          {projectPath && (
            <p className="text-xs text-green-400/80 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Agent root: <code className="font-mono">{projectPath}</code>
            </p>
          )}
        </div>
      </div>

      {/* System Requirements */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" /> System Requirements
          </h2>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {system?.items?.map((item) => (
              <div key={item.name} className={`flex items-center justify-between p-3 rounded-lg border ${
                item.available
                  ? "bg-green-500/5 border-green-500/15"
                  : item.required
                  ? "bg-red-500/5 border-red-500/15"
                  : "bg-secondary border-border"
              }`}>
                <div className="flex items-center gap-3">
                  {item.available ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      {item.name}
                      {item.required && !item.available && (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                      )}
                    </div>
                    {!item.available && item.installHint && (
                      <div className="text-xs text-muted-foreground mt-0.5">{item.installHint}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.version ?? (item.available ? "Available" : "Not installed")}
                  </span>
                  {item.required && (
                    <div className="text-xs text-red-400/70 mt-0.5">Required</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {system && !system.allRequired && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            Some required tools are missing. Install them to enable full build functionality.
          </div>
        )}
        {system?.allRequired && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">
            All required tools are available. Your build environment is ready.
          </div>
        )}
      </div>

      {/* Build Defaults */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Build Defaults</h2>
        <div className="space-y-3">
          {[
            { label: "Default Min SDK Version", value: "22 (Android 5.1+)", sub: "Compatible with 99.5% of devices" },
            { label: "Default Target SDK Version", value: "34 (Android 14)", sub: "Required by Play Store for new apps" },
            { label: "Default Build Tool", value: "Capacitor 5.x", sub: "Best for React/Vue/Angular projects" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
              <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>APK Builder Pro</span>
            <span className="font-mono">v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Build Engine</span>
            <span className="font-mono">Capacitor 5 + Gradle</span>
          </div>
          <div className="flex justify-between">
            <span>AI Assistant</span>
            <span className="font-mono">Gemini — 5 key rotation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
