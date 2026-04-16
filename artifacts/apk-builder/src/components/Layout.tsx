import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderOpen,
  Play,
  Key,
  UploadCloud,
  Settings,
  Smartphone,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/keystore", label: "Keystore", icon: Key },
  { href: "/play-store", label: "Play Store", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 border border-primary/30">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-sidebar-foreground leading-tight">APK Builder</div>
            <div className="text-xs text-muted-foreground">Pro</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                  {active && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                </motion.div>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-border">
          <div className="text-xs text-muted-foreground">APK Builder Pro v1.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-full p-6 max-w-6xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
