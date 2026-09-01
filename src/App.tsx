import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { ApiError } from '@/lib/api';

/* Route-level code splitting keeps the initial bundle small; heavy screens
   (markdown editor, charts) are only downloaded when they are opened. */
const Landing = lazy(() => import('./pages/Landing'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tickets = lazy(() => import('./pages/Tickets'));
const NewTicket = lazy(() => import('./pages/NewTicket'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Assets = lazy(() => import('./pages/Assets'));
const NewAsset = lazy(() => import('./pages/NewAsset'));
const Diesel = lazy(() => import('./pages/Diesel'));
const NewDiesel = lazy(() => import('./pages/NewDiesel'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Vendors = lazy(() => import('./pages/Vendors'));
const NewVendor = lazy(() => import('./pages/NewVendor'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const NewKBArticle = lazy(() => import('./pages/NewKBArticle'));
const KBArticleDetail = lazy(() => import('./pages/KBArticleDetail'));
const Expenses = lazy(() => import('./pages/Expenses'));
const NewExpense = lazy(() => import('./pages/NewExpense'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Branches = lazy(() => import('./pages/Branches'));
const UsersPage = lazy(() => import('./pages/Users'));
const Reports = lazy(() => import('./pages/Reports'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const AutomationRules = lazy(() => import('./pages/AutomationRules'));
const Notifications = lazy(() => import('./pages/Notifications'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry client errors — a 401/403/404 will not fix itself.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Wraps a protected screen in the chrome + auth guard. */
function Guarded({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  return (
    <ProtectedRoute {...(adminOnly ? { requiredRole: 'admin' as const } : {})}>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public marketing + auth */}
              <Route path="/landing" element={<Landing />} />
              <Route path="/features" element={<Features />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />

              {/* Application */}
              <Route path="/" element={<Guarded><Dashboard /></Guarded>} />
              <Route path="/tickets" element={<Guarded><Tickets /></Guarded>} />
              <Route path="/tickets/new" element={<Guarded><NewTicket /></Guarded>} />
              <Route path="/tickets/:id" element={<Guarded><TicketDetail /></Guarded>} />
              <Route path="/profile" element={<Guarded><Profile /></Guarded>} />
              <Route path="/assets" element={<Guarded><Assets /></Guarded>} />
              <Route path="/assets/new" element={<Guarded><NewAsset /></Guarded>} />
              <Route path="/diesel" element={<Guarded><Diesel /></Guarded>} />
              <Route path="/diesel/new" element={<Guarded><NewDiesel /></Guarded>} />
              <Route path="/calendar" element={<Guarded><Calendar /></Guarded>} />
              <Route path="/vendors" element={<Guarded><Vendors /></Guarded>} />
              <Route path="/vendors/new" element={<Guarded><NewVendor /></Guarded>} />
              <Route path="/purchase-orders" element={<Guarded><PurchaseOrders /></Guarded>} />
              <Route path="/knowledge-base" element={<Guarded><KnowledgeBase /></Guarded>} />
              <Route path="/knowledge-base/new" element={<Guarded><NewKBArticle /></Guarded>} />
              <Route path="/knowledge-base/:id" element={<Guarded><KBArticleDetail /></Guarded>} />
              <Route path="/expenses" element={<Guarded><Expenses /></Guarded>} />
              <Route path="/expenses/new" element={<Guarded><NewExpense /></Guarded>} />
              <Route path="/budgets" element={<Guarded><Budgets /></Guarded>} />
              <Route path="/notifications" element={<Guarded><Notifications /></Guarded>} />
              <Route path="/reports" element={<Guarded><Reports /></Guarded>} />

              {/* Administrator only */}
              <Route path="/branches" element={<Guarded adminOnly><Branches /></Guarded>} />
              <Route path="/users" element={<Guarded adminOnly><UsersPage /></Guarded>} />
              <Route path="/automation" element={<Guarded adminOnly><AutomationRules /></Guarded>} />
              <Route path="/system-health" element={<Guarded adminOnly><SystemHealth /></Guarded>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
