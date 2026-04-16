const frameworkStyles: Record<string, string> = {
  react: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  vue: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  nextjs: "bg-white/10 text-white border-white/20",
  angular: "bg-red-500/15 text-red-400 border-red-500/30",
  html: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  node: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  svelte: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  nuxt: "bg-green-500/15 text-green-400 border-green-500/30",
};

const frameworkLabels: Record<string, string> = {
  react: "React",
  vue: "Vue",
  nextjs: "Next.js",
  angular: "Angular",
  html: "HTML/JS",
  node: "Node.js",
  svelte: "Svelte",
  nuxt: "Nuxt",
};

export function FrameworkBadge({ type }: { type: string | null | undefined }) {
  if (!type) return <span className="text-xs text-muted-foreground">Unknown</span>;
  const style = frameworkStyles[type] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {frameworkLabels[type] ?? type}
    </span>
  );
}
