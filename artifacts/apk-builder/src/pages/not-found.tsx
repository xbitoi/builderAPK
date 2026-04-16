import { Link } from "wouter";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <AlertCircle className="w-16 h-16 text-destructive" />
      <div className="text-4xl font-bold text-foreground">404</div>
      <p className="text-muted-foreground text-lg">Page not found</p>
      <Link href="/">
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          <Home className="w-4 h-4" /> Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
