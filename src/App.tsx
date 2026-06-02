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
import ClientDetail from "./pages/ClientDetail";
import Team from "./pages/Team";
import TeamMemberDetail from "./pages/TeamMemberDetail";
import TeamsDB from "./pages/TeamsDB";
import Collaborators from "./pages/Collaborators";
import Finance from "./pages/Finance";
import ReportDetail from "./pages/ReportDetail";
import TimeTracking from "./pages/TimeTracking";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Studio from "./pages/Studio";
import Services from "./pages/Services";
import SalesFunnel from "./pages/SalesFunnel";
import SalesAgenda from "./pages/SalesAgenda";
import SalesDashboard from "./pages/SalesDashboard";
import NotFound from "./pages/NotFound.tsx";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === "commercial") return <Navigate to="/sales/dashboard" replace />;
  return <Dashboard />;
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
                      <Route path="/" element={<HomeRoute />} />
                      <Route path="/kanban" element={<Kanban />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/reports/:type" element={<ReportDetail />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/clients/:id" element={<ClientDetail />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/team" element={<Team />} />
                      <Route path="/team/:id" element={<TeamMemberDetail />} />
                      <Route path="/teams" element={<TeamsDB />} />
                      <Route path="/collaborators" element={<Collaborators />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/time" element={<TimeTracking />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/studio" element={<Studio />} />
                      <Route path="/sales" element={<SalesFunnel />} />
                      <Route path="/sales/agenda" element={<SalesAgenda />} />
                      <Route path="/sales/dashboard" element={<SalesDashboard />} />
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
