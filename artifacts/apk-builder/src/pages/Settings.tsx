import { useSystemCheck } from "@workspace/api-client-react";
import { CheckCircle, XCircle, AlertTriangle, Cpu, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getSystemCheckQueryKey } from "@workspace/api-client-react";

export default function Settings() {
  const { data: system, isLoading, refetch } = useSystemCheck();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getSystemCheckQueryKey() });
    refetch();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your build environment</p>
      </div>

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
            <span>Supported Frameworks</span>
            <span className="font-mono">React, Vue, Next.js, Angular, HTML</span>
          </div>
        </div>
      </div>
    </div>
  );
}
