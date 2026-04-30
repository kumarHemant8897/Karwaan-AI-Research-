import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { AppLayout } from "@/components/app-layout";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import Paper from "./pages/Paper.tsx";
import Compare from "./pages/Compare.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/app"
                element={
                  <AppLayout>
                    <Index />
                  </AppLayout>
                }
              />
              <Route
                path="/paper/:paperId"
                element={
                  <AppLayout>
                    <Paper />
                  </AppLayout>
                }
              />
              <Route
                path="/compare"
                element={
                  <AppLayout>
                    <Compare />
                  </AppLayout>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
