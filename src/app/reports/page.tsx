'use client';

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Filter,
  Search,
  Calendar,
  RefreshCcw,
  FileSpreadsheet,
  Lock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingUp,
  CheckCircle2,
  ArrowDownToLine,
  Activity,
  History,
  FileText
} from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { format, subYears } from "date-fns";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

export default function ReportsEngineElite() {
  const { data: session } = useSession();

  // 1. Global Filter State (Matched to Dashboard for parity)
  const [filters, setFilters] = useState({
    dateRange: {
      from: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
      to: format(new Date(), 'yyyy-MM-dd')
    },
    riskBands: [] as string[],
    statuses: [] as string[],
    search: '',
    currency: 'all',
    erpType: 'all',
    companyCode: 'all'
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 25 });
  const [isExporting, setIsExporting] = useState(false);

  // 2. Fetch Data
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ['reportsEngineHardened', filters, pagination],
    queryFn: async () => {
      const res = await fetch('/api/reports/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, pagination })
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    }
  });

  const summary = data?.summary || {};

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating Multi-Sheet Audit Export...");
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
      a.download = `DPPS_Audit_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Excel Report Delivered", { id: toastId });
    } catch (err) {
      toast.error("Failed to generate report", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="min-h-screen bg-slate-50/50 pb-20">

      {/* STICKY HEADER & FILTERS (Elite) */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-[1700px] mx-auto px-8 h-20 flex items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Reporting & Extraction</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Global Audit Baseline</p>
            </div>
          </div>

          <div className="flex-grow max-w-5xl flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60">
            <div className="flex gap-1 bg-white p-1 rounded-xl shadow-inner border">
              <Input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value } })}
                className="h-8 border-0 bg-transparent text-xs w-[130px] focus-visible:ring-0"
              />
              <span className="text-slate-300 self-center">to</span>
              <Input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value } })}
                className="h-8 border-0 bg-transparent text-xs w-[130px] focus-visible:ring-0"
              />
            </div>

            <Select onValueChange={(val) => setFilters({ ...filters, erpType: val })}>
              <SelectTrigger className="h-10 w-[120px] bg-white border-slate-200 rounded-xl text-xs font-bold"><SelectValue placeholder="ERP" /></SelectTrigger>
              <SelectContent className="rounded-xl"><SelectItem value="all">All ERPs</SelectItem><SelectItem value="SAP">SAP</SelectItem><SelectItem value="Oracle">Oracle</SelectItem></SelectContent>
            </Select>

            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Invoice, Vendor, ID..."
                className="pl-10 h-10 border-slate-200 rounded-xl bg-white text-xs placeholder:font-medium placeholder:text-slate-300"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl h-11 w-11 border-slate-200 hover:bg-white active:scale-95 transition-all"><RefreshCcw className={cn("h-4 w-4 text-slate-500", isFetching && "animate-spin")} /></Button>
            <Button onClick={handleExport} disabled={isExporting} className="bg-slate-900 hover:bg-black text-white px-6 h-11 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:shadow-xl hover:shadow-slate-200 active:scale-95">
              {isExporting ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
              Extract Data
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-[1700px] mx-auto px-8 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* RECONCILED KPI STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <ReportMetricCard
            label="Volume"
            value={summary.totalChecked}
            sub="Records Audited"
            icon={Activity}
            tooltip="The total count of unique invoices processed and risk-scored by the DPPS engine within the selected date range."
          />
          <ReportMetricCard
            label="Prevented"
            value={formatCurrency(summary.prevented?.value, data?.metadata?.reportingCurrency)}
            sub={`${summary.prevented?.count || 0} Blocked`}
            color="indigo"
            icon={ShieldAlert}
            tooltip="Total financial value of confirmed duplicates that were successfully blocked before payment was issued."
          />
          <ReportMetricCard
            label="Leakage"
            value={formatCurrency(summary.leakage?.value, data?.metadata?.reportingCurrency)}
            sub={`${summary.leakage?.count || 0} Detected`}
            color="rose"
            icon={Lock}
            tooltip="Duplicates that were identified after payment had already been made, typically discovered during historical data synchronization."
          />
          <ReportMetricCard
            label="Recovered"
            value={formatCurrency(summary.recovered?.value, data?.metadata?.reportingCurrency)}
            sub={`${summary.recovered?.count || 0} Cash Back`}
            color="emerald"
            icon={TrendingUp}
            tooltip="Total value of funds successfully clawed back from vendors following the resolution of a recovery case."
          />
          <ReportMetricCard
            label="Leakage Rate"
            value={`${(summary.leakageRate || 0).toFixed(2)}%`}
            sub="Duplicate %"
            color="rose"
            tooltip="The percentage of your total payment volume that resulted in a duplicate payment. A key indicator of AP process health."
          />
          <ReportMetricCard
            label="Recovery Eff."
            value={`${(summary.recoveryEfficiency || 0).toFixed(1)}%`}
            sub="Collection Strength"
            color="emerald"
            tooltip="Measures the success rate of recovering leaked funds. Calculated as (Recovered Value / Total Leakage Value)."
          />
        </div>

        {/* MAIN DATA GRID (TanStack Equivalent) */}
        <Card className="shadow-2xl border-slate-200/60 rounded-[32px] overflow-hidden bg-white">
          <CardHeader className="p-8 bg-slate-50/50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Verified Audit Trail</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Displaying {data?.data?.length || 0} of {data?.pagination?.total?.toLocaleString() || 0} Scope-Match Records
              </CardDescription>
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-slate-400">Reconciled At</span>
                <span className="text-[10px] font-bold text-slate-900">{data?.reconciledAt ? format(new Date(data.reconciledAt), 'HH:mm:ss') : 'LIVE'}</span>
              </div>
              <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-6 pl-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Master Transaction ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Entity Context</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">Risk Analysis</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Control Status</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Gross Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5} className="h-16 animate-pulse bg-slate-50/20" /></TableRow>
                  ))
                ) : data?.data?.length > 0 ? (
                  data.data.map((item: any) => (
                    <TableRow key={item.id} className="group hover:bg-slate-50/80 transition-all border-b border-slate-100/50">
                      <TableCell className="py-6 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.invoiceNumber}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{safeFormatDate(item.invoiceDate)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm">{item.vendorName || 'N/A'}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-slate-200 text-slate-400 px-1.5 h-4">{item.vendorCode || 'V-UNK'}</Badge>
                            <span className="h-1 w-1 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-400">SAP ERP</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className={cn(
                            "px-3 py-1 rounded-full font-black text-[10px] mb-1.5 shadow-sm",
                            item.riskBand === 'HIGH' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' :
                              item.riskBand === 'MEDIUM' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' :
                                'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                          )}>
                            {item.riskBand} ({item.riskScore}%)
                          </div>
                          <div className="flex gap-1">
                            {Array(5).fill(0).map((_, i) => (
                              <div key={i} className={cn("h-1 w-2.5 rounded-full transition-all duration-500", i < Math.ceil(item.riskScore / 20) ? (item.riskScore >= 70 ? 'bg-rose-500' : 'bg-indigo-500') : 'bg-slate-200')} />
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "rounded-lg text-[9px] font-black uppercase tracking-widest border-0 px-2 h-6 shadow-sm",
                          item.status === 'BLOCKED' ? "bg-rose-600 text-white shadow-rose-100" :
                            item.status === 'CLEARED' ? "bg-indigo-600 text-white shadow-indigo-100" :
                              item.status === 'PAID' ? "bg-emerald-600 text-white shadow-emerald-100" :
                                "bg-slate-100 text-slate-500"
                        )}>
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-slate-900 text-lg tracking-tight">
                            {formatCurrency(Number(data?.metadata?.showSideBySideAmounts ? item.amountInReportingCurrency : item.amount), data?.metadata?.reportingCurrency || item.currency || 'USD')}
                          </span>
                          {data?.metadata?.showSideBySideAmounts && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              Original: {formatCurrency(Number(item.amount), item.currency || 'USD')}
                            </span>
                          )}
                          {!data?.metadata?.showSideBySideAmounts && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.currency || 'USD'}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-96 text-center text-slate-400 font-bold uppercase tracking-widest">No matching signals found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination (Elite) */}
            <div className="p-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{data?.pagination?.pages || 1}</span>
                </p>
                <span className="h-4 w-[1px] bg-slate-200" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Total: <span className="text-slate-900">{data?.pagination?.total?.toLocaleString() || 0} Records</span>
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-200 bg-white h-12 px-6 font-black text-xs uppercase text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 disabled:opacity-30"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-200 bg-white h-12 px-6 font-black text-xs uppercase text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95 disabled:opacity-30"
                  disabled={pagination.page >= (data?.pagination?.pages || 1)}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  Next <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ReportMetricCard({ label, value, sub, icon: Icon, color = "slate", tooltip }: any) {
  const colors: any = {
    slate: "text-slate-900 bg-white border-slate-200",
    indigo: "text-indigo-700 bg-indigo-50/50 border-indigo-100",
    rose: "text-rose-700 bg-rose-50/50 border-rose-100",
    emerald: "text-emerald-700 bg-emerald-50/50 border-emerald-100"
  };
  const accent: any = {
    slate: "bg-slate-900",
    indigo: "bg-indigo-600",
    rose: "bg-rose-600",
    emerald: "bg-emerald-600"
  };

  return (
    <Card className={cn("shadow-sm border-2 rounded-[28px] overflow-hidden group hover:shadow-xl transition-all duration-500", colors[color])}>
      <CardContent className="p-6 flex flex-col justify-center gap-1 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none">{label}</span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-slate-300 hover:text-indigo-500 cursor-help transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-900 text-white border-0 text-[10px] font-bold p-3 rounded-xl max-w-[200px]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className={cn("p-1.5 rounded-lg text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100", accent[color])}>
            {Icon && <Icon className="h-3 w-3" />}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black tracking-tight leading-none mb-1">{value?.toLocaleString() || (typeof value === 'string' ? value : 0)}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

