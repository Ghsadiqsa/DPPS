'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, Activity, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const daysInMonth = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 56 }, (_, i) => (currentYear - 5 + i).toString());
const months = [
  { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
  { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" },
  { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
  { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

const DayGridSelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
  <div className="grid grid-cols-7 gap-1 p-2 w-[220px]">
    {daysInMonth.map((day) => (
      <Button
        key={day}
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 text-[10px] font-medium",
          value === day && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={() => onChange(day)}
      >
        {parseInt(day)}
      </Button>
    ))}
  </div>
);

export default function Dashboard() {
  const [selectedRange, setSelectedRange] = useState({
    fromYear: "2024",
    fromMonth: "01",
    fromDay: "01",
    toYear: "2024",
    toMonth: "12",
    toDay: "31"
  });

  const handleRangeChange = (key: string, value: string) => {
    setSelectedRange(prev => ({ ...prev, [key]: value }));
  };

  // Fetch dashboard metrics from API (re-using reports API for consistency)
  const { data: reportsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch('/api/reports');
      return res.json();
    }
  });

  // Fetch vendors for ranking
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch('/api/vendors');
      return res.json();
    }
  });

  const kpi = reportsData?.kpi;

  const metrics = {
    preventedValue: kpi?.prevented || 0,
    openCases: kpi?.detectedRisks || 0, // Using detectedRisks as proxy for open cases
    totalDetections: kpi?.detectedRisks || 0,
    efficiency: kpi?.successRate || 0,
    totalProcessed: 5250000 // Still hardcoded or fetch from another agg
  };

  const isLoading = isLoadingMetrics;

  const chartData = reportsData?.monthlyData || [];

  // Generate heatmap data client-side only to avoid hydration mismatch
  const [heatmapData, setHeatmapData] = useState<number[]>([]);

  useEffect(() => {
    // Generate random risk values only on client
    const data = Array.from({ length: 48 }, () => Math.random());
    setHeatmapData(data);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-heading text-foreground tracking-tight">Launchpad Overview</h1>
          <p className="text-sm text-muted-foreground">
            Duplicate Payment Prevention Cockpit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 px-2 text-muted-foreground border-r pr-4 mr-1">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Date Range</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">From</span>
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[45px] h-8 text-[11px] font-bold border-none bg-muted/50 p-0">
                    {parseInt(selectedRange.fromDay)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DayGridSelector
                    value={selectedRange.fromDay}
                    onChange={(v) => handleRangeChange("fromDay", v)}
                  />
                </PopoverContent>
              </Popover>

              <Select value={selectedRange.fromMonth} onValueChange={(v) => handleRangeChange("fromMonth", v)}>
                <SelectTrigger className="w-[70px] h-8 text-[11px] font-bold border-none bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {months.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedRange.fromYear} onValueChange={(v) => handleRangeChange("fromYear", v)}>
                <SelectTrigger className="w-[75px] h-8 text-[11px] font-bold border-none bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {years.map(y => <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-border mx-1" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">To</span>
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[45px] h-8 text-[11px] font-bold border-none bg-muted/50 p-0">
                    {parseInt(selectedRange.toDay)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DayGridSelector
                    value={selectedRange.toDay}
                    onChange={(v) => handleRangeChange("toDay", v)}
                  />
                </PopoverContent>
              </Popover>

              <Select value={selectedRange.toMonth} onValueChange={(v) => handleRangeChange("toMonth", v)}>
                <SelectTrigger className="w-[70px] h-8 text-[11px] font-bold border-none bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {months.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedRange.toYear} onValueChange={(v) => handleRangeChange("toYear", v)}>
                <SelectTrigger className="w-[75px] h-8 text-[11px] font-bold border-none bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {years.map(y => <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 pl-2 border-l ml-1">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            </div>
          )}
        </div>
      </div>

      {/* Real-time Ticker */}
      <div className="bg-slate-900 text-slate-300 py-2 px-4 rounded-lg flex items-center gap-6 overflow-hidden text-xs font-mono border border-slate-800 shadow-inner">
        <div className="flex items-center gap-2 text-emerald-400 font-bold shrink-0 animate-pulse">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          LIVE SAVINGS
        </div>
        <div className="flex gap-8 animate-marquee whitespace-nowrap">
          <span>Detected: <span className="text-white">$45,200</span> (Acme Corp) - <span className="text-slate-500">Just now</span></span>
          <span>Blocked: <span className="text-white">$12,150</span> (Globex) - <span className="text-slate-500">2m ago</span></span>
          <span>Flagged: <span className="text-white">$8,900</span> (Soylent) - <span className="text-slate-500">5m ago</span></span>
          <span>Recovery: <span className="text-white">$2,500</span> (Initech) - <span className="text-slate-500">12m ago</span></span>
          <span>System: <span className="text-indigo-400">Rules Updated</span> - <span className="text-slate-500">15m ago</span></span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-bold text-muted-foreground">Syncing...</span>
            </div>
          </div>
        )}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md transition-shadow cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prevented Value</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold font-mono text-emerald-600">
                      ${metrics.preventedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs font-bold text-emerald-500">
                      ({((metrics.preventedValue / metrics.totalProcessed) * 100).toFixed(1)}%)
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">
                    of ${(metrics.totalProcessed / 1000000).toFixed(2)}M Total Processed
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-[#121c26] border-[#2c3e50] text-white p-3 max-w-[200px]">
              <p className="text-xs font-bold mb-1">Leakage Prevention</p>
              <p className="text-[10px] text-slate-300">Successfully blocked duplicate payments representing {((metrics.preventedValue / metrics.totalProcessed) * 100).toFixed(1)}% of total invoice volume.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-t-4 border-t-amber-500 shadow-sm hover:shadow-md transition-shadow cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Tasks</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-amber-600">{metrics.openCases}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">REQUIRES ATTENTION</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-[#121c26] border-[#2c3e50] text-white p-3 max-w-[200px]">
              <p className="text-xs font-bold mb-1">Open Tasks</p>
              <p className="text-[10px] text-slate-300">Total number of flagged invoices currently awaiting manual review and resolution.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analytic Score</CardTitle>
                  <Activity className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{metrics.totalDetections}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">TOTAL DETECTIONS</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-[#121c26] border-[#2c3e50] text-white p-3 max-w-[200px]">
              <p className="text-xs font-bold mb-1">Analytic Score</p>
              <p className="text-[10px] text-slate-300">Aggregated detection volume processed by the ML engine over the selected period.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow cursor-help">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Efficiency</CardTitle>
                  <Activity className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{metrics.efficiency}%</div>
                  <p className="text-[10px] text-muted-foreground mt-1">RECOVERY PERFORMANCE</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-[#121c26] border-[#2c3e50] text-white p-3 max-w-[200px]">
              <p className="text-xs font-bold mb-1">Efficiency</p>
              <p className="text-[10px] text-slate-300">Percentage of funds successfully recovered compared to total post-pay detections.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prevention Value Trend</CardTitle>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  cursor={{ fill: 'var(--color-muted)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="prevented" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top 10 High-Risk Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Array.isArray(vendorsData) ? vendorsData : []).slice(0, 10).map((vendor: any, i: number) => (
                <div key={vendor.name || vendor.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{vendor.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{vendor.riskLevel || vendor.region}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold">${((vendor.totalSpend || vendor.value) / 1000).toFixed(1)}k</p>
                      <p className="text-[10px] text-muted-foreground">{vendor.duplicateCount || vendor.count} duplicates</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-muted/50">
                      {(vendor.duplicateCount || vendor.count) > 2 ? "High" : "Med"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Heatmap Widget */}
        <Card className="col-span-4 lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Risk Heatmap & Anomaly Detection
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Critical</Badge>
                <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">High</Badge>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Safe</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-1 h-24">
              {heatmapData.length === 0 ? (
                // Render placeholder during SSR/initial load
                Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="rounded-sm bg-muted/50 animate-pulse" />
                ))
              ) : (
                heatmapData.map((risk, i) => {
                  let color = "bg-emerald-100/50 hover:bg-emerald-200";
                  if (risk > 0.95) color = "bg-red-500 hover:bg-red-600 shadow-md ring-1 ring-red-300";
                  else if (risk > 0.85) color = "bg-orange-400 hover:bg-orange-500";
                  else if (risk > 0.7) color = "bg-yellow-300 hover:bg-yellow-400";
                  else if (risk > 0.5) color = "bg-emerald-200 hover:bg-emerald-300";

                  return (
                    <TooltipProvider key={i}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("rounded-sm transition-all cursor-pointer", color)} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-[10px] font-bold">Block #{1000 + i}</p>
                          <p className="text-[10px] text-muted-foreground">Risk Score: {(risk * 100).toFixed(0)}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })
              )}
            </div>
            <div className="mt-4 flex justify-between items-center text-xs text-muted-foreground">
              <span>Real-time transaction monitoring blocks (last 4 hours)</span>
              <span>Updated: Live</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
