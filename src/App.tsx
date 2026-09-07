import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Tickets = React.lazy(() => import("./pages/Tickets"));
const NewTicket = React.lazy(() => import("./pages/NewTicket"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Assets = React.lazy(() => import("./pages/Assets"));
const NewAsset = React.lazy(() => import("./pages/NewAsset"));
const Diesel = React.lazy(() => import("./pages/Diesel"));
const NewDiesel = React.lazy(() => import("./pages/NewDiesel"));
const TicketDetail = React.lazy(() => import("./pages/TicketDetail"));
const Calendar = React.lazy(() => import("./pages/Calendar"));
const Vendors = React.lazy(() => import("./pages/Vendors"));
const NewVendor = React.lazy(() => import("./pages/NewVendor"));
const PurchaseOrders = React.lazy(() => import("./pages/PurchaseOrders"));
const KnowledgeBase = React.lazy(() => import("./pages/KnowledgeBase"));
const NewKBArticle = React.lazy(() => import("./pages/NewKBArticle"));
const KBArticleDetail = React.lazy(() => import("./pages/KBArticleDetail"));
const Expenses = React.lazy(() => import("./pages/Expenses"));
const NewExpense = React.lazy(() => import("./pages/NewExpense"));
const Budgets = React.lazy(() => import("./pages/Budgets"));
const Branches = React.lazy(() => import("./pages/Branches"));
const Users = React.lazy(() => import("./pages/Users"));
const Reports = React.lazy(() => import("./pages/Reports"));
const SystemHealth = React.lazy(() => import("./pages/SystemHealth"));
const AutomationRules = React.lazy(() => import("./pages/AutomationRules"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";

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
          <ErrorBoundary>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <Routes>
            {/* Public Pages */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
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
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
