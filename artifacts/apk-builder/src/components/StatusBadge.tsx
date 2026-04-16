import { motion } from "framer-motion";

const statusStyles: Record<string, string> = {
  queued: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  success: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  detecting: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/15 text-green-400 border-green-500/30",
  building: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const isRunning = status === "running" || status === "building" || status === "detecting";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>
      {isRunning ? (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="w-1.5 h-1.5 rounded-full bg-current"
        />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
