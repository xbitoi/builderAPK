import { Link } from "wouter";
import { motion } from "framer-motion";
import { useGetDashboardStats, useSystemCheck, useListBuilds } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { FrameworkBadge } from "@/components/FrameworkBadge";
import {
  FolderOpen, Hammer, CheckCircle2, XCircle, HardDrive,
  Plus, AlertTriangle, CheckCircle, Cpu
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-card-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { refetchInterval: 5000 } });
  const { data: system } = useSystemCheck();
  const { data: builds } = useListBuilds({ query: { refetchInterval: 5000 } });

  const successRate = stats && stats.totalBuilds > 0
    ? Math.round((stats.successfulBuilds / stats.totalBuilds) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your Android build station</p>
        </div>
        <Link href="/projects/new">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Projects" value={stats?.totalProjects ?? 0} icon={FolderOpen} color="bg-blue-500/15 text-blue-400" />
          <StatCard label="Total Builds" value={stats?.totalBuilds ?? 0} icon={Hammer} color="bg-purple-500/15 text-purple-400" />
          <StatCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} color="bg-green-500/15 text-green-400" />
          <StatCard label="Output Size" value={`${stats?.totalOutputSizeMB ?? 0} MB`} icon={HardDrive} color="bg-orange-500/15 text-orange-400" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">System Readiness</h2>
          </div>
          {!system ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {system.items?.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    {item.available ? (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-foreground">{item.name}</span>
                    {item.required && !item.available && (
                      <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.version ?? (item.available ? "Available" : "Not found")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Builds</h2>
            </div>
            <Link href="/projects">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
          {!builds || builds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No builds yet. <Link href="/projects/new"><span className="text-primary cursor-pointer hover:underline">Start a project</span></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {builds.slice(0, 5).map((build) => (
                <Link key={build.id} href={`/build/${build.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground font-mono">#{build.id}</div>
                      <span className="text-sm text-foreground capitalize">{build.buildType} {build.outputFormat?.toUpperCase()}</span>
                    </div>
                    <StatusBadge status={build.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
