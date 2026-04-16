import { useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { useGetBuild, useCancelBuild } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBuildQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useAIChat } from "@/contexts/AIChatContext";
import { ArrowLeft, Download, XCircle, CheckCircle2, Clock, HardDrive, Sparkles } from "lucide-react";

const BUILD_STEPS = [
  "Initializing",
  "Cloning",
  "Installing",
  "Detecting",
  "Wrapping",
  "Generating",
  "Building",
  "Signing",
  "Optimizing",
  "Complete",
];

function QRCode() {
  return (
    <div className="grid grid-cols-10 gap-px bg-white p-3 rounded-lg w-24 h-24">
      {Array.from({ length: 100 }, (_, i) => {
        const r = Math.floor(i / 10);
        const c = i % 10;
        const isCorner = (r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3);
        const isRand = ((r * 7 + c * 13) % 3) === 0;
        return (
          <div key={i} className={`${(isCorner || isRand) ? "bg-black" : "bg-white"}`} />
        );
      })}
    </div>
  );
}

export default function BuildMonitor() {
  const [, params] = useRoute("/build/:id");
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();
  const cancelBuild = useCancelBuild();
  const logsRef = useRef<HTMLDivElement>(null);

  const { data: build } = useGetBuild(id, {
    query: {
      enabled: !!id,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "running" || status === "queued" ? 1500 : false;
      },
    },
  });

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [build?.logs]);

  const handleCancel = async () => {
    await cancelBuild.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getGetBuildQueryKey(id) });
  };

  const { setContextLogs, setIsOpen } = useAIChat();

  const handleAnalyzeWithAI = () => {
    if (build?.logs && build.logs.length > 0) {
      setContextLogs(build.logs.join("\n"));
      setIsOpen(true);
    }
  };

  const currentStep = build ? Math.min(Math.floor((build.progress / 100) * BUILD_STEPS.length), BUILD_STEPS.length - 1) : 0;
  const isRunning = build?.status === "running" || build?.status === "queued";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Build #{build?.id}</h1>
            {build && <StatusBadge status={build.status} />}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {build ? `${build.buildType} ${build.outputFormat?.toUpperCase()}` : "Loading..."}
          </p>
        </div>
        {isRunning && (
          <button
            onClick={handleCancel}
            disabled={cancelBuild.isPending}
            className="flex items-center gap-2 bg-destructive/15 text-destructive border border-destructive/30 px-3 py-2 rounded-lg text-sm font-medium hover:bg-destructive/25 transition-colors"
          >
            <XCircle className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>

      {build && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground font-mono font-semibold">{build.progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${build.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {BUILD_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                  i < currentStep
                    ? "bg-primary/15 text-primary"
                    : i === currentStep && isRunning
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : "text-muted-foreground"
                }`}>
                  {i < currentStep && <CheckCircle2 className="w-3 h-3" />}
                  {step}
                </div>
                {i < BUILD_STEPS.length - 1 && <div className="w-3 h-px bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0d1117] border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#161b22]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-xs text-muted-foreground ml-2 font-mono">build.log</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{build?.logs?.length ?? 0} lines</span>
            {build?.logs && build.logs.length > 0 && (
              <button
                onClick={handleAnalyzeWithAI}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Analyze with AI
              </button>
            )}
          </div>
        </div>
        <div
          ref={logsRef}
          className="p-4 h-72 overflow-y-auto font-mono text-xs leading-5 space-y-0.5"
        >
          {!build || build.logs.length === 0 ? (
            <div className="text-gray-600">Waiting for build to start...</div>
          ) : (
            build.logs.map((line, i) => (
              <div key={i} className={`${line.includes("complete") || line.includes("Complete") ? "text-green-400" : line.includes("Error") || line.includes("failed") ? "text-red-400" : "text-gray-300"}`}>
                {line}
              </div>
            ))
          )}
          {isRunning && (
            <motion.div
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2 h-3 bg-green-400"
            />
          )}
        </div>
      </div>

      {build?.status === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 gap-4"
        >
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Build Successful
            </div>
            <div className="space-y-2 text-sm">
              {build.outputSizeBytes && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="w-4 h-4" />
                  Size: {(build.outputSizeBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
              )}
              {build.completedAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Completed: {new Date(build.completedAt).toLocaleString()}
                </div>
              )}
            </div>
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium w-full justify-center hover:opacity-90 transition-opacity">
              <Download className="w-4 h-4" /> Download {build.outputFormat?.toUpperCase()}
            </button>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Install via QR Code</h3>
            <p className="text-xs text-muted-foreground">Scan to install directly on your Android device</p>
            <div className="flex justify-center pt-1">
              <QRCode />
            </div>
            <p className="text-xs text-center text-muted-foreground opacity-60">QR code available after upload to server</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
