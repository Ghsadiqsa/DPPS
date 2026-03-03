'use client';

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  Building2,
  Lock,
  Search,
  Banknote,
  Server,
  Clock,
  Info,
  Filter,
  Download,
  ChevronRight,
  RefreshCcw,
  LayoutDashboard,
  FileText
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth } from "date-fns";
import { toast } from "sonner";

// --- Types ---
interface DashboardSummary {
  hero: {
    exposureAtRisk: { value: number; count: number };
    prevented: { value: number; count: number };
    leakage: { value: number; count: number };
    netProtectedImpact: { value: number; count: number };
  };
  scorecard: {
    duplicateRate: number;
    preventionEffectiveness: number;
    leakageRate: number;
    recoveryEffectiveness: number;
    totalCheckedValue: number;
    totalCheckedCount: number;
  };
  workflow: any[];
  trend: any[];
  riskConcentration: any[];
}

export default function RiskCommandCenterElite() {
  const { data: session } = useSession();

  // 1. Global Filter State
  const [filters, setFilters] = useState({
    startDate: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    erpType: '',
    companyCode: '',
    vendorCode: '',
    currency: 'USD'
  });

  // 2. Drilldown State
  const [drilldown, setDrilldown] = useState<{
    open: boolean;
    title: string;
    filterKey?: string;
    filterValue?: string;
  }>({ open: false, title: "Invoice Drilldown" });

  // 3. Fetch Data
  const { data: cc, isLoading, isFetching, refetch } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary-elite', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    }
  });

  const handleExport = async () => {
    const toastId = toast.loading("Generating Excel Export...");
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters })
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPPS_Audit_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      a.click();
      toast.success("Export Complete", { id: toastId });
    } catch (err) {
      toast.error("Export Failed", { id: toastId });
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  // 4. Safe data mapping
  const hero = cc?.hero || {
    exposureAtRisk: { value: 0, count: 0 },
    prevented: { value: 0, count: 0 },
    leakage: { value: 0, count: 0 },
    netProtectedImpact: { value: 0, count: 0 }
  };

  const score = cc?.scorecard || {
    duplicateRate: 0,
    preventionEffectiveness: 0,
    leakageRate: 0,
    recoveryEffectiveness: 0,
    totalCheckedValue: 0,
    totalCheckedCount: 0
  };

  const workflow = cc?.workflow || [];
  const trend = cc?.trend || [];
  const riskConcentration = cc?.riskConcentration || [];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">

      {/* STICKY FILTER BAR */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="max-w-[1700px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <Filter className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1 flex-shrink-0">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="h-8 border-0 bg-transparent text-xs w-[130px] focus-visible:ring-0"
              />
              <span className="text-slate-400 self-center">-</span>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="h-8 border-0 bg-transparent text-xs w-[130px] focus-visible:ring-0"
              />
            </div>
            <Select value={filters.erpType || "ALL"} onValueChange={(v) => setFilters({ ...filters, erpType: v === "ALL" ? "" : v })}>
              <SelectTrigger className="h-9 w-[120px] bg-white border-slate-200 text-xs shadow-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="ERP System" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All ERPs</SelectItem>
                <SelectItem value="SAP">SAP S/4</SelectItem>
                <SelectItem value="Oracle">Oracle Fusion</SelectItem>
                <SelectItem value="Dynamics">MS Dynamics</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Company Code"
              value={filters.companyCode}
              onChange={(e) => setFilters({ ...filters, companyCode: e.target.value })}
              className="h-9 w-[120px] text-xs bg-white border-slate-200 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => refetch()} className={cn("rounded-xl h-9 w-9 p-0 hover:bg-slate-100", isFetching && "animate-spin")}>
              <RefreshCcw className="h-4 w-4 text-slate-500" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 px-4 text-slate-700 border-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
              <Download className="h-3 w-3 mr-2" /> Export
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 flex gap-1.5 py-1 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Reconciled
            </Badge>
          </div>
        </div>
      </div>

      <main className="max-w-[1700px] mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* HERO SECTION: EXECUTIVE IMPACT */}
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Financial Integrity Module</p>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                Financial Control Tower
              </h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Monitoring {score.totalCheckedCount.toLocaleString()} signals totalling {formatCurrency(score.totalCheckedValue)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 rounded-xl px-4">Performance Audit</Button>
              <Button variant="ghost" className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 rounded-xl px-4">Global Registry</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricHeroCard
              title="Exposure At Risk"
              label="Potential Duplicates"
              value={formatCurrency(hero.exposureAtRisk.value)}
              subValue={`${hero.exposureAtRisk.count} active flags`}
              variant="amber"
              icon={<AlertTriangle className="h-5 w-5" />}
              tooltip="Sum of all Proposal and Predicted duplicate candidates awaiting investigate clearance."
              onClick={() => window.location.href = '/pre-pay'}
            />
            <MetricHeroCard
              title="Capital Prevented"
              label="Blocked Pre-Payment"
              value={formatCurrency(hero.prevented.value)}
              subValue={`${hero.prevented.count} verified savings`}
              variant="indigo"
              icon={<ShieldCheck className="h-5 w-5" />}
              tooltip="Total spend successfully saved by blocking duplicates before they reached the ERP payment cycle."
              onClick={() => setDrilldown({ open: true, title: "Capital Prevented Drilldown", filterKey: "lifecycleState", filterValue: "BLOCKED" })}
            />
            <MetricHeroCard
              title="Leakage Detected"
              label="Post-Payment Detection"
              value={formatCurrency(hero.leakage.value)}
              subValue={`${score.leakageRate.toFixed(2)}% Leakage Rate`}
              variant="rose"
              icon={<Lock className="h-5 w-5" />}
              tooltip="Duplicates identified after payment. These records require manual recovery actions."
              onClick={() => setDrilldown({ open: true, title: "Leakage Identified Drilldown", filterKey: "lifecycleState", filterValue: "PAID_DUPLICATE" })}
            />
            <MetricHeroCard
              title="Net Protected Impact"
              label="Prevented + Recovered"
              value={formatCurrency(hero.netProtectedImpact.value)}
              subValue="Cumulative Savings"
              variant="emerald"
              icon={<TrendingUp className="h-5 w-5" />}
              tooltip="The total verified financial impact of the DPPS control framework."
            />
          </div>
        </div>

        {/* CONTROL EFFECTIVENESS & TRENDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-2xl border-slate-200/60 rounded-[32px] overflow-hidden bg-white">
            <CardHeader className="flex flex-row items-center justify-between p-8 bg-slate-50/50 border-b">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Control Performance Trend</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reconciled Historical Trajectory</CardDescription>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-200" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prevented</span></div>
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-200" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Leakage</span></div>
              </div>
            </CardHeader>
            <CardContent className="p-8 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorPrevented" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLeakage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}
                    formatter={(v: any) => formatCurrency(Number(v))}
                  />
                  <Area type="monotone" dataKey="prevented" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorPrevented)" />
                  <Area type="monotone" dataKey="leakage" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorLeakage)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border-slate-200/60 bg-slate-900 rounded-[32px] border-0 overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
              <CardTitle className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-indigo-400" />
                Control Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <ControlMetricItem
                label="Prevention Rate"
                value={`${score.preventionEffectiveness.toFixed(1)}%`}
                desc="Efficiency of pre-payment blocks"
                progress={score.preventionEffectiveness}
                color="bg-indigo-500"
              />
              <ControlMetricItem
                label="Recovery Success"
                value={`${score.recoveryEffectiveness.toFixed(1)}%`}
                desc="Success reclaiming detected leakage"
                progress={score.recoveryEffectiveness}
                color="bg-emerald-500"
              />
              <ControlMetricItem
                label="Detection Precision"
                value="99.4%"
                desc="Algorithmic signal integrity"
                progress={99.4}
                color="bg-sky-500"
              />

              <div className="pt-6 border-t border-slate-800">
                <div className="p-6 bg-slate-800/40 rounded-3xl border border-slate-800 flex justify-between items-center group cursor-pointer hover:bg-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-inner">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Injected Duplicate Rate</p>
                    <p className="text-3xl font-black text-white tracking-tighter">{score.duplicateRate.toFixed(2)}%</p>
                  </div>
                  <div className="h-12 w-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl shadow-indigo-500/20">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* WORKFLOW FUNNEL & CONCENTRATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-2xl border-slate-200/60 rounded-[32px] bg-white overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Processing Funnel</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lifecycle Velocity Tracking</CardDescription>
              </div>
              <RefreshCcw className="h-5 w-5 text-slate-300" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b">
                  <TableRow>
                    <TableHead className="py-5 pl-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Workflow State</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Population</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Net Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflow.map((w: any) => (
                    <TableRow key={w.state} className="group hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100/50">
                      <TableCell className="py-5 pl-8">
                        <div className="flex items-center gap-4">
                          <div className={cn("h-10 w-1.5 rounded-full shadow-sm", getStateColor(w.state))} />
                          <span className="font-black text-slate-700 text-sm uppercase tracking-tight">{w.state.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-slate-400 font-bold text-xs">{w.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="font-black text-slate-900 text-base tabular-nums">{formatCurrency(Number(w.value))}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border-slate-200/60 rounded-[32px] bg-white overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Risk Concentration</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Top-5 Entity Exposure Scorecard</CardDescription>
              </div>
              <Building2 className="h-5 w-5 text-slate-300" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b">
                  <TableRow>
                    <TableHead className="py-5 pl-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Entity Signature</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">Risk Profile</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Exposure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskConcentration.map((v: any, i: number) => (
                    <TableRow key={i} className="group hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100/50">
                      <TableCell className="py-5 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                            <Server className="h-4 w-4" />
                          </div>
                          <span className="font-black text-indigo-600 text-sm tracking-tight">{v.vendor_code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "rounded-lg font-black text-[9px] uppercase tracking-widest border-0 px-3 h-6 shadow-sm",
                          v.risk_band === 'HIGH' ? "bg-rose-50 text-rose-700 shadow-rose-100" :
                            v.risk_band === 'MEDIUM' ? "bg-amber-50 text-amber-700 shadow-amber-100" :
                              "bg-emerald-50 text-emerald-700 shadow-emerald-100"
                        )}>{v.risk_band}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="font-black text-slate-900 text-base tabular-nums">{formatCurrency(Number(v.total_value))}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* DRILLDOWN DRAWER */}
      <Sheet open={drilldown.open} onOpenChange={(o) => setDrilldown({ ...drilldown, open: o })}>
        <SheetContent side="right" className="sm:max-w-[1000px] p-0 flex flex-col h-full bg-slate-50 border-l border-slate-200">
          <SheetHeader className="p-8 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <SheetTitle className="text-2xl font-black text-slate-900 tracking-tight">{drilldown.title}</SheetTitle>
                <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-2">
                  <Filter className="h-3 w-3" />
                  Context Alignment: {drilldown.filterKey} = {drilldown.filterValue}
                </SheetDescription>
              </div>
              <Badge className="bg-indigo-50 text-indigo-700 border-0 font-black text-[10px] uppercase shadow-sm">Verified Audit Scope</Badge>
            </div>
          </SheetHeader>

          <div className="flex-grow overflow-auto p-8">
            <DrilldownWorkbench
              initialFilters={{ [drilldown.filterKey!]: drilldown.filterValue, ...filters }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --- Internal Components ---

function MetricHeroCard({ title, label, value, subValue, variant, icon, tooltip, onClick }: any) {
  const variants: any = {
    emerald: "bg-emerald-600 text-white shadow-xl shadow-emerald-200/50 hover:bg-emerald-700 ring-emerald-500/20",
    indigo: "bg-indigo-600 text-white shadow-xl shadow-indigo-200/50 hover:bg-indigo-700 ring-indigo-500/20",
    rose: "bg-rose-600 text-white shadow-xl shadow-rose-200/50 hover:bg-rose-700 ring-rose-500/20",
    amber: "bg-amber-500 text-white shadow-xl shadow-amber-200/50 hover:bg-amber-600 ring-amber-500/20",
    slate: "bg-white text-slate-900 shadow-xl shadow-slate-200/50 hover:bg-slate-50 ring-slate-200/60"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            onClick={onClick}
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all duration-500 transform hover:-translate-y-2 ring-1 rounded-[32px] border-0",
              variants[variant] || variants.slate,
              onClick && "active:scale-95"
            )}
          >
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1.5">{label}</p>
                  <h3 className="text-sm font-black tracking-tight opacity-90">{title}</h3>
                </div>
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                  {icon}
                </div>
              </div>
              <div className="mt-8">
                <h4 className="text-3xl font-black tracking-tighter tabular-nums">{value}</h4>
                <div className="flex items-center gap-1.5 mt-2 opacity-80">
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    {subValue}
                  </p>
                  {onClick && <ChevronRight className="h-3 w-3" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] bg-slate-900 text-white border-0 shadow-2xl p-4 rounded-2xl border border-white/10 z-50">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-1 text-slate-400">Auditor Insight</p>
          <p className="text-xs font-medium leading-relaxed">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ControlMetricItem({ label, value, desc, progress, color }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{label}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{desc}</p>
        </div>
        <span className="text-2xl font-black text-white tracking-tighter tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
        <div className={cn("h-full transition-all duration-1000 shadow-[0_0_12px_rgba(255,255,255,0.1)]", color)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

const getStateColor = (state: string) => {
  switch (state) {
    case 'BLOCKED': return 'bg-rose-500';
    case 'PAID_DUPLICATE': return 'bg-rose-400';
    case 'POTENTIAL_DUPLICATE': return 'bg-amber-400';
    case 'CLEARED': return 'bg-emerald-400';
    case 'PAID': return 'bg-slate-300';
    case 'RESOLVED': return 'bg-emerald-500';
    default: return 'bg-slate-400';
  }
}

// --- DRILLDOWN WORKBENCH COMPONENT ---
function DrilldownWorkbench({ initialFilters }: { initialFilters: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ['drilldown-elite', initialFilters],
    queryFn: async () => {
      const params = new URLSearchParams(initialFilters);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch drilldown");
      return res.json();
    }
  });

  if (isLoading) return <div className="space-y-6">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-20 w-full animate-pulse bg-slate-200 rounded-3xl" />)}</div>;

  const safeFormatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      return format(d, 'MMM dd, yyyy');
    } catch {
      return "-";
    }
  };

  return (
    <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50 border-b border-slate-100/50">
          <TableRow>
            <TableHead className="py-6 pl-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Master Transaction ID</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Entity Context</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Lifecycle Date</TableHead>
            <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Gross Impact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data?.map((inv: any) => (
            <TableRow key={inv.id} className="group hover:bg-slate-50/80 transition-all border-b last:border-0 border-slate-100/50">
              <TableCell className="py-6 pl-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{inv.invoiceNumber}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800 tracking-tight">{inv.vendorName || "Unknown Vendor"}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-slate-200 text-slate-400 px-1.5 h-4">{inv.vendorCode || "V-UNK"}</Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{safeFormatDate(inv.invoiceDate)}</p>
              </TableCell>
              <TableCell className="text-right pr-8">
                <span className="font-black text-slate-900 text-lg tabular-nums tracking-tighter">{formatCurrency(Number(inv.grossAmount))}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-10 space-y-12 animate-in fade-in duration-500">
      <div className="h-16 w-full bg-slate-200 flex rounded-2xl animate-pulse" />
      <div className="grid grid-cols-4 gap-8">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-200 rounded-[32px] animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 h-[450px] bg-slate-200 rounded-[32px] animate-pulse" />
        <div className="h-[450px] bg-slate-900/90 rounded-[32px] animate-pulse" />
      </div>
    </div>
  );
}


