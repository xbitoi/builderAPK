import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderOpen,
  Key,
  UploadCloud,
  Settings,
  Smartphone,
  ChevronRight,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAIChat } from "@/contexts/AIChatContext";
import AIChatPanel from "@/components/AIChatPanel";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/keystore", label: "Keystore", icon: Key },
  { href: "/play-store", label: "Play Store", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  location,
  isOpen: aiOpen,
  togglePanel,
  onNavClick,
}: {
  location: string;
  isOpen: boolean;
  togglePanel: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 border border-primary/30">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold text-sidebar-foreground leading-tight">APK Builder</div>
          <div className="text-xs text-muted-foreground">Pro</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onNavClick}>
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

      {/* AI Toggle */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0">
        <motion.button
          whileHover={{ x: 2 }}
          onClick={() => { togglePanel(); onNavClick?.(); }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all",
            aiOpen
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          AI Assistant
          {aiOpen && (
            <span className="ml-auto flex items-center justify-center w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </motion.button>
        <div className="mt-2 px-1 text-xs text-muted-foreground">APK Builder Pro v1.0</div>
      </div>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isOpen: aiOpen, togglePanel, setIsOpen: setAiOpen } = useAIChat();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileSidebarOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-border bg-sidebar z-10">
        <SidebarContent location={location} isOpen={aiOpen} togglePanel={togglePanel} />
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-sidebar border-r border-border shadow-2xl"
            >
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent
                location={location}
                isOpen={aiOpen}
                togglePanel={togglePanel}
                onNavClick={() => setMobileSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── AI Chat Panel — left inline on desktop, full-overlay on mobile ── */}
      <AIChatPanel onClose={() => setAiOpen(false)} />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 border border-primary/30">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">APK Builder Pro</span>
          </div>
          <button
            onClick={togglePanel}
            className={cn(
              "p-2 rounded-lg transition-colors",
              aiOpen
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            )}
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="min-h-full p-4 md:p-6 max-w-6xl mx-auto"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex-shrink-0 flex items-center border-t border-border bg-sidebar safe-area-bottom">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-2.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
              </Link>
            );
          })}
          <button
            onClick={togglePanel}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors",
              aiOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-medium">AI</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
