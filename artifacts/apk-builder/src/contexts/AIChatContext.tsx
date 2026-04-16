import { createContext, useContext, useState } from "react";

interface AIChatContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  togglePanel: () => void;
  contextLogs: string | null;
  setContextLogs: (logs: string | null) => void;
}

const AIChatContext = createContext<AIChatContextType | null>(null);

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextLogs, setContextLogs] = useState<string | null>(null);

  const togglePanel = () => setIsOpen((v) => !v);

  return (
    <AIChatContext.Provider
      value={{ isOpen, setIsOpen, togglePanel, contextLogs, setContextLogs }}
    >
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error("useAIChat must be used within AIChatProvider");
  return ctx;
}
