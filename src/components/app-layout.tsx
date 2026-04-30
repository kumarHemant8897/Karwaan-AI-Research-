import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Sparkles } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider defaultOpen>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="h-12 flex items-center gap-2 border-b border-border px-3 shrink-0">
            <SidebarTrigger />
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">gemini-1.5-flash</span>
          </header>
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
