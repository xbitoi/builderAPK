import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  useGetProject, useDetectProjectType, useStartBuild, useListBuilds
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProjectQueryKey, getListBuildsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { FrameworkBadge } from "@/components/FrameworkBadge";
import {
  ArrowLeft, Scan, Hammer, Play, Package, ExternalLink, Clock
} from "lucide-react";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(id, { query: { enabled: !!id } });
  const { data: allBuilds } = useListBuilds({ query: { refetchInterval: 3000 } });
  const detectType = useDetectProjectType();
  const startBuild = useStartBuild();

  const [buildConfig, setBuildConfig] = useState({
    buildType: "release" as "debug" | "release",
    outputFormat: "apk" as "apk" | "aab",
    useKeystore: true,
    playStoreMode: false,
  });

  const projectBuilds = allBuilds?.filter((b) => b.projectId === id) ?? [];

  const handleDetect = async () => {
    await detectType.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
  };

  const handleBuild = async () => {
    const build = await startBuild.mutateAsync({
      id,
      data: { ...buildConfig, minSdkVersion: 22, targetSdkVersion: 34 },
    });
    queryClient.invalidateQueries({ queryKey: getListBuildsQueryKey() });
    navigate(`/build/${build.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-card border border-card-border rounded-xl animate-pulse" />
        <div className="h-48 bg-card border border-card-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <FrameworkBadge type={project.projectType} />
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{project.packageId}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Project Details
          </h2>
          <div className="space-y-2 text-sm">
            {[
              { label: "Source", value: project.sourceType },
              { label: "URL", value: project.sourceUrl ?? "N/A" },
              { label: "App Name", value: project.appName ?? "N/A" },
              { label: "Version", value: `${project.versionName ?? "1.0.0"} (${project.versionCode ?? 1})` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground truncate max-w-[200px]" title={value}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleDetect}
            disabled={detectType.isPending}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 mt-2"
          >
            <Scan className="w-4 h-4" />
            {detectType.isPending ? "Detecting..." : "Detect Project Type"}
          </button>
          {detectType.data && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs space-y-1"
            >
              <div className="text-green-400 font-medium">Detection Results:</div>
              {detectType.data.recommendations?.map((r, i) => (
                <div key={i} className="text-muted-foreground">- {r}</div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Hammer className="w-4 h-4 text-primary" /> Build Configuration
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Build Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["debug", "release"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBuildConfig((c) => ({ ...c, buildType: type }))}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${buildConfig.buildType === type ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Output Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(["apk", "aab"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setBuildConfig((c) => ({ ...c, outputFormat: fmt }))}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${buildConfig.outputFormat === fmt ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {fmt.toUpperCase()} {fmt === "aab" ? "(Play Store)" : "(Direct Install)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">Use Keystore Signing</span>
              <button
                type="button"
                onClick={() => setBuildConfig((c) => ({ ...c, useKeystore: !c.useKeystore }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${buildConfig.useKeystore ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${buildConfig.useKeystore ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">Play Store Mode</span>
              <button
                type="button"
                onClick={() => setBuildConfig((c) => ({ ...c, playStoreMode: !c.playStoreMode }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${buildConfig.playStoreMode ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${buildConfig.playStoreMode ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
          <button
            onClick={handleBuild}
            disabled={startBuild.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {startBuild.isPending ? "Starting Build..." : "Start Build"}
          </button>
        </div>
      </div>

      {projectBuilds.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Build History
          </h2>
          <div className="space-y-2">
            {projectBuilds.map((build) => (
              <Link key={build.id} href={`/build/${build.id}`}>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">#{build.id}</span>
                    <span className="text-sm text-foreground capitalize">{build.buildType} {build.outputFormat?.toUpperCase()}</span>
                    {build.outputSizeBytes && (
                      <span className="text-xs text-muted-foreground">{(build.outputSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={build.status} />
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
