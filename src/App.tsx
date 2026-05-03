import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppStoreProvider } from "@/store/AppStore";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SearchProvider } from "@/context/SearchContext";
import Dashboard from "./pages/Dashboard";
import Kanban from "./pages/Kanban";
import Reports from "./pages/Reports";
import Clients from "./pages/Clients";
import Team from "./pages/Team";
import TimeTracking from "./pages/TimeTracking";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound.tsx";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <NotificationsProvider>
        <AuthProvider>
          <AppStoreProvider>
            <SearchProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<Protected><AppLayout /></Protected>}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/kanban" element={<Kanban />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/team" element={<Team />} />
                      <Route path="/time" element={<TimeTracking />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </SearchProvider>
          </AppStoreProvider>
        </AuthProvider>
      </NotificationsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
