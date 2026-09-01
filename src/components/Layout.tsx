import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building,
  Calendar,
  DollarSign,
  FileText,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Ticket,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: typeof Ticket;
  adminOnly?: boolean;
}

const NAVIGATION: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Assets', href: '/assets', icon: Package },
  { name: 'Diesel', href: '/diesel', icon: Fuel },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Vendors', href: '/vendors', icon: Building },
  { name: 'Purchase orders', href: '/purchase-orders', icon: FileText },
  { name: 'Knowledge base', href: '/knowledge-base', icon: BookOpen },
  { name: 'Expenses', href: '/expenses', icon: DollarSign },
  { name: 'Budgets', href: '/budgets', icon: DollarSign },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Organisation', href: '/branches', icon: Building, adminOnly: true },
  { name: 'Users', href: '/users', icon: Users, adminOnly: true },
  { name: 'Automation', href: '/automation', icon: Zap, adminOnly: true },
  { name: 'System health', href: '/system-health', icon: Activity, adminOnly: true },
];

function initials(name: string | null | undefined) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unread badge; polled rather than pushed, which keeps the edge API stateless.
  const { data: notificationStats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: () => api.get<{ total: number; unread: number; read: number }>('/notifications/stats'),
    refetchInterval: 60_000,
    enabled: Boolean(profile),
  });

  const unread = notificationStats?.unread ?? 0;
  const items = NAVIGATION.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname === href || location.pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.name}</span>
            {item.href === '/notifications' && unread > 0 ? (
              <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1 text-[10px]">
                {unread > 99 ? '99+' : unread}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex items-center gap-2 border-b px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                    <Ticket className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold">TechPros ITSM</span>
                </div>
                <ScrollArea className="h-[calc(100vh-4rem)]">
                  <nav className="flex flex-col gap-1 p-3">
                    <NavItems onNavigate={() => setMobileMenuOpen(false)} />
                  </nav>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                <Ticket className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="hidden font-bold sm:inline-block">TechPros ITSM</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Notifications">
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="Account menu">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">{initials(profile?.full_name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.full_name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
                    <p className="text-xs font-medium capitalize text-primary">{profile?.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r lg:block">
          <ScrollArea className="h-[calc(100vh-4rem)] sticky top-16">
            <nav className="flex flex-col gap-1 p-3">
              <NavItems />
            </nav>
          </ScrollArea>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
        </main>
      </div>

      <footer className="border-t py-4">
        <div className="px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} TechPros ITSM
        </div>
      </footer>
    </div>
  );
}
