import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListProjects, useDeleteProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { FrameworkBadge } from "@/components/FrameworkBadge";
import { Plus, Trash2, ExternalLink, FolderOpen } from "lucide-react";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const deleteProject = useDeleteProject();
  const queryClient = useQueryClient();

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await deleteProject.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your web-to-Android conversion projects</p>
        </div>
        <Link href="/projects/new">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
          <p className="text-muted-foreground text-sm">No projects yet</p>
          <Link href="/projects/new">
            <button className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Create your first project
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/projects/${project.id}`}>
                <div className="flex items-center justify-between bg-card border border-card-border rounded-xl p-5 hover:border-primary/30 cursor-pointer transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="text-primary text-lg font-bold">{project.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{project.name}</span>
                        <FrameworkBadge type={project.projectType} />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">{project.packageId ?? "No package ID"}</span>
                        {project.sourceUrl && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">{project.sourceUrl}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={project.status} />
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      className="p-1.5 rounded-lg hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
