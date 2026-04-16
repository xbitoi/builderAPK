import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import { Github, Upload, FolderOpen, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type SourceType = "github" | "zip" | "local";

export default function NewProject() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();

  const [sourceType, setSourceType] = useState<SourceType>("github");
  const [form, setForm] = useState({
    name: "",
    sourceUrl: "",
    packageId: "",
    appName: "",
    versionName: "1.0.0",
    versionCode: 1,
  });
  const [error, setError] = useState<string | null>(null);

  const sourceOptions = [
    { id: "github" as SourceType, label: "GitHub URL", icon: Github, desc: "Clone from a GitHub repository" },
    { id: "zip" as SourceType, label: "Upload ZIP", icon: Upload, desc: "Upload a zipped project folder" },
    { id: "local" as SourceType, label: "Local Path", icon: FolderOpen, desc: "Point to a local directory" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("Project name is required"); return; }
    if (sourceType === "github" && !form.sourceUrl.trim()) { setError("GitHub URL is required"); return; }

    try {
      const project = await createProject.mutateAsync({
        data: {
          name: form.name.trim(),
          sourceType,
          sourceUrl: form.sourceUrl.trim() || null,
          packageId: form.packageId.trim() || null,
          appName: form.appName.trim() || form.name.trim(),
          versionName: form.versionName.trim() || "1.0.0",
          versionCode: form.versionCode,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Project</h1>
          <p className="text-sm text-muted-foreground">Convert a web project to Android APK</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Source Type</h2>
          <div className="grid grid-cols-3 gap-3">
            {sourceOptions.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSourceType(id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                  sourceType === id
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-xs opacity-60 leading-tight">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Project Info</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Project Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Android App"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {(sourceType === "github" || sourceType === "local") && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  {sourceType === "github" ? "GitHub Repository URL *" : "Local Project Path"}
                </label>
                <input
                  type="text"
                  value={form.sourceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder={sourceType === "github" ? "https://github.com/user/repo" : "/home/user/my-project"}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {sourceType === "zip" && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">ZIP upload coming soon</p>
                <p className="text-xs mt-1 opacity-60">Use GitHub URL for now</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Android Configuration</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Package ID</label>
              <input
                type="text"
                value={form.packageId}
                onChange={(e) => setForm((f) => ({ ...f, packageId: e.target.value }))}
                placeholder="com.example.myapp"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">App Name</label>
              <input
                type="text"
                value={form.appName}
                onChange={(e) => setForm((f) => ({ ...f, appName: e.target.value }))}
                placeholder="My App"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Version Name</label>
              <input
                type="text"
                value={form.versionName}
                onChange={(e) => setForm((f) => ({ ...f, versionName: e.target.value }))}
                placeholder="1.0.0"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Version Code</label>
              <input
                type="number"
                value={form.versionCode}
                onChange={(e) => setForm((f) => ({ ...f, versionCode: parseInt(e.target.value) || 1 }))}
                min={1}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={createProject.isPending}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {createProject.isPending ? "Creating..." : "Create Project"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
