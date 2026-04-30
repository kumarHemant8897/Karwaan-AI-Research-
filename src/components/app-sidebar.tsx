import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Check, FileText, GitCompareArrows, LogOut, Moon, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";
import { useTheme } from "./theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Paper {
  id: string;
  title: string;
  status: string;
  uploaded_at: string;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { paperId } = useParams();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  const loadPapers = async () => {
    const { data, error } = await supabase
      .from("papers")
      .select("id, title, status, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(30);
    if (!error && data) setPapers(data);
  };

  useEffect(() => {
    if (!user) return;
    loadPapers();
    const channel = supabase
      .channel("papers-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "papers" },
        () => loadPapers(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const deletePaper = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { error } = await supabase.from("papers").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Paper removed");
      if (paperId === id) navigate("/app");
    }
  };

  const toggleComparePaper = (id: string) => {
    setSelectedCompareIds((current) => {
      if (current.includes(id)) return current.filter((paperId) => paperId !== id);
      if (current.length >= 5) {
        toast.error("You can compare up to five papers.");
        return current;
      }
      return [...current, id];
    });
  };

  const openComparison = () => {
    if (selectedCompareIds.length < 2) {
      toast.error("Select at least two ready papers.");
      return;
    }
    navigate(`/compare?papers=${selectedCompareIds.join(",")}`);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight">Karwaan</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Paper Assistant</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/app" end className="hover:bg-sidebar-accent" >
                    <Plus className="h-4 w-4" />
                    {!collapsed && <span>New Chat</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Papers</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {papers.length === 0 && !collapsed && (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  No papers yet. Upload one to get started.
                </div>
              )}
              {papers.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton asChild isActive={paperId === p.id}>
                    <NavLink to={`/paper/${p.id}`} className="group hover:bg-sidebar-accent">
                      <FileText className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-sm">{p.title}</span>
                          {p.status === "processing" && (
                            <span className="typing-dot !w-1 !h-1 shrink-0" />
                          )}
                          {p.status === "failed" && (
                            <span className="text-xs text-destructive shrink-0">!</span>
                          )}
                          <button
                            onClick={(e) => deletePaper(p.id, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                            aria-label="Delete paper"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Compare Papers</SidebarGroupLabel>}
          <SidebarGroupContent>
            {collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={openComparison}>
                    <GitCompareArrows className="h-4 w-4" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <div className="px-2 space-y-2">
                <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin pr-1">
                  {papers.filter((p) => p.status === "ready").length === 0 ? (
                    <p className="px-1 py-3 text-xs text-muted-foreground">Processed papers will appear here.</p>
                  ) : (
                    papers.filter((p) => p.status === "ready").map((paper) => {
                      const selected = selectedCompareIds.includes(paper.id);
                      return (
                        <button
                          key={paper.id}
                          onClick={() => toggleComparePaper(paper.id)}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent transition-colors"
                        >
                          <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{paper.title}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <Button size="sm" className="w-full" onClick={openComparison} disabled={selectedCompareIds.length < 2}>
                  <GitCompareArrows className="h-4 w-4 mr-2" />
                  Compare {selectedCompareIds.length > 0 ? `(${selectedCompareIds.length})` : ""}
                </Button>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!collapsed && user && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground truncate">
              {user.email}
            </div>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
