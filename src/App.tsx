import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import NewTicket from "./pages/NewTicket";
import Profile from "./pages/Profile";
import Assets from "./pages/Assets";
import NewAsset from "./pages/NewAsset";
import Diesel from "./pages/Diesel";
import NewDiesel from "./pages/NewDiesel";
import TicketDetail from "./pages/TicketDetail";
import Calendar from "./pages/Calendar";
import Vendors from "./pages/Vendors";
import NewVendor from "./pages/NewVendor";
import PurchaseOrders from "./pages/PurchaseOrders";
import KnowledgeBase from "./pages/KnowledgeBase";
import NewKBArticle from "./pages/NewKBArticle";
import KBArticleDetail from "./pages/KBArticleDetail";
import Expenses from "./pages/Expenses";
import NewExpense from "./pages/NewExpense";
import Budgets from "./pages/Budgets";
import Branches from "./pages/Branches";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import SystemHealth from "./pages/SystemHealth";
import AutomationRules from "./pages/AutomationRules";
import Notifications from "./pages/Notifications";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Tickets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewTicket />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Assets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewAsset />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/diesel"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Diesel />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/diesel/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewDiesel />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TicketDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Calendar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendors"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Vendors />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendors/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewVendor />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseOrders />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-base"
              element={
                <ProtectedRoute>
                  <Layout>
                    <KnowledgeBase />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-base/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewKBArticle />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-base/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <KBArticleDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Expenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewExpense />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/budgets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Budgets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Branches />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Users />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-health"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SystemHealth />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/automation"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AutomationRules />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
