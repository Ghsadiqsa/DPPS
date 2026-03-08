'use client';

import { Sidebar } from "./Sidebar";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Activity, ShieldCheck, AlertTriangle, Clock, ChevronRight, Bell, Settings, LogOut, Menu, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// State colors for badge display
const stateColor: Record<string, string> = {
  FLAGGED_HIGH: "bg-rose-100 text-rose-700",
  FLAGGED_MEDIUM: "bg-amber-100 text-amber-700",
  FLAGGED_LOW: "bg-yellow-100 text-yellow-700",
  IN_INVESTIGATION: "bg-indigo-100 text-indigo-700",
  CONFIRMED_DUPLICATE: "bg-red-100 text-red-700",
  NOT_DUPLICATE: "bg-emerald-100 text-emerald-700",
  READY_FOR_RELEASE: "bg-sky-100 text-sky-700",
  RELEASED_TO_PAYMENT: "bg-green-100 text-green-700",
  default: "bg-slate-100 text-slate-600",
};

function LiveActivityPanel() {
  const [summary, setSummary] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const [summaryRes, reportsRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/reports'),
      ]);
      if (summaryRes.ok) {
        const s = await summaryRes.json();
        setSummary(s);
      }
      if (reportsRes.ok) {
        const r = await reportsRes.json();
        setRecent(r.recentActivity || []);
      }
      setLastRefresh(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const hero = summary?.hero;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">

      {/* Live KPI Strip */}
      <div className="p-4 bg-indigo-600 text-white space-y-2">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Live Status</span>
          <button onClick={fetchData} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCcw className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/10 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3 w-3 text-amber-300" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Active Flags</span>
              </div>
              <p className="text-xl font-black tabular-nums">{hero?.exposureAtRisk?.count ?? 0}</p>
              <p className="text-[10px] opacity-60">{formatCurrency(hero?.exposureAtRisk?.value ?? 0)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3 w-3 text-emerald-300" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Prevented</span>
              </div>
              <p className="text-xl font-black tabular-nums">{hero?.prevented?.count ?? 0}</p>
              <p className="text-[10px] opacity-60">{formatCurrency(hero?.prevented?.value ?? 0)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-sky-300" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Open Tasks</span>
              </div>
              <p className="text-xl font-black tabular-nums">{hero?.leakage?.count ?? 0}</p>
              <p className="text-[10px] opacity-60">In Investigation</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3 w-3 text-indigo-300" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Net Impact</span>
              </div>
              <p className="text-xl font-black tabular-nums truncate">{formatCurrency(hero?.netProtectedImpact?.value ?? 0)}</p>
              <p className="text-[10px] opacity-60">Cumulative saved</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          Recent Activity
          <span className="ml-2 opacity-50 normal-case font-medium">
            Updated {format(lastRefresh, 'HH:mm:ss')}
          </span>
        </p>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && recent.length === 0 && (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No recent activity</p>
            <p className="text-[10px] text-slate-300 mt-1">Upload a payment proposal to get started</p>
          </div>
        )}

        <div className="space-y-2">
          {recent.map((item: any, i: number) => {
            const colorCls = stateColor[item.status] || stateColor.default;
            return (
              <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{item.invoiceNumber}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.vendorName}</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 uppercase tracking-tight ${colorCls}`}>
                    {(item.status || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-black text-slate-700">{formatCurrency(Number(item.amount))}</span>
                  {item.createdAt && (
                    <span className="text-[9px] text-slate-300">
                      {format(new Date(item.createdAt), 'MMM d, HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children, session }: { children: React.ReactNode, session?: any }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/login') {
    return <div className="min-h-screen bg-[#F8FAFC]">{children}</div>;
  }

  const user = session?.user || { name: "Jane Doe", email: "jane@example.com", role: "ADMINISTRATOR" };
  const initial = user.name ? user.name.split(' ').map((n: string) => n[0]).join('') : 'JD';

  return (
    <div className="flex h-screen overflow-hidden bg-secondary/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 relative z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <nav className="hidden md:flex items-center space-x-2 text-sm text-slate-500">
              <span>Home</span>
              <ChevronRight className="h-4 w-4" />
              <span>DPPS</span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-slate-900 font-medium">Prevention Control</span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 hidden md:flex">
              <Bell className="h-5 w-5 text-slate-600" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-2">
                  <Avatar className="h-9 w-9 border shadow-sm">
                    <AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold">{initial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="container mx-auto p-8 max-w-7xl animate-in fade-in duration-500 relative">
          {children}

          {/* Live Activity Panel Toggle */}
          <div className="fixed bottom-6 right-6 z-[100]">
            <Button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="h-14 w-14 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 text-white p-0 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
              data-testid="button-toggle-chatbot"
            >
              {isChatOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
            </Button>

            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="absolute bottom-16 right-0 w-80 sm:w-96 h-[520px] bg-white border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* Panel Header */}
                  <div className="p-4 bg-indigo-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm">DPPS Live Feed</h3>
                        <p className="text-[10px] text-white/70">Real-time â€¢ From Database</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8" onClick={() => setIsChatOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <LiveActivityPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

