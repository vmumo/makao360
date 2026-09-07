import { Link, useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Moon, Sun, ShieldCheck, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useUnreadNotifications, markAllNotificationsRead } from "@/hooks/use-notifications";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true, this nav entry is the notifications inbox. */
  notifications?: boolean;
}

export function AppLayout({
  nav,
  children,
}: {
  nav: NavItem[];
  children: ReactNode;
}) {
  const { profile, signOut, roles, hasRole, user } = useAuth();
  const location = useLocation();
  const router = useRouter();
  const qc = useQueryClient();
  const unread = useUnreadNotifications();
  const [dark, setDark] = useState(false);

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      toast.success("All notifications marked as read");
      void qc.invalidateQueries({ queryKey: ["unread-notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as read");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("makao-theme");
    const isDark =
      saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("makao-theme", next ? "dark" : "light");
  };

  const initials = (profile?.full_name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-6 border-b border-sidebar-border bg-white/5">
          <Logo variant="image" size={72} className="text-sidebar-foreground" />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const showBadge = item.notifications && unread > 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
            >
              <Check className="size-3.5" />
              Mark all {unread} as read
            </button>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 px-2">
            Signed in as
          </div>
          <div className="text-sm px-2 truncate">{profile?.full_name ?? "User"}</div>
          <div className="text-xs text-sidebar-foreground/60 px-2 capitalize">{roles.join(", ")}</div>
        </div>
      </aside>

      {/* Top bar (mobile + desktop) */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8 h-20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Go back"
                  title="Go back"
                  onClick={() => router.history.back()}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Go forward"
                  title="Go forward"
                  onClick={() => router.history.forward()}
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              <div className="lg:hidden"><Logo variant="image" size={56} /></div>
              <div className="hidden lg:block text-sm text-muted-foreground truncate">
                {nav.find((n) => isActive(n.to))?.label ?? ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle theme">
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid place-items-center size-9 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-medium">{profile?.full_name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {profile?.phone ?? ""}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <User className="size-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  {hasRole("admin") && (
                    <DropdownMenuItem asChild>
                      <Link to="/app/admin">
                        <ShieldCheck className="size-4 mr-2" /> Super admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-10 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* Bottom tab bar (mobile) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border pb-safe">
          <ul className="grid grid-cols-4">
            {nav.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              const showBadge = item.notifications && unread > 0;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`relative flex flex-col items-center justify-center py-2.5 text-[11px] gap-1 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span>{item.label}</span>
                    {showBadge && (
                      <span className="absolute top-1 right-[18%] inline-flex items-center justify-center min-w-4 h-4 px-1 text-[9px] font-bold rounded-full bg-primary text-primary-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
