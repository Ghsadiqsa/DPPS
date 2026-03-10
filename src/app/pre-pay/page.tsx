'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, convertCurrency } from "@/lib/currency";
import { useConfig } from "@/components/providers/ConfigProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  ShieldAlert,
  RefreshCcw,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Building2,
  Calendar,
  AlertTriangle,
  Activity,
  Loader2,
  AlertCircle,
  Equal,
  Minus,
} from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreBand(score: number) {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function scoreBadgeClass(score: number) {
  const band = scoreBand(score);
  if (band === 'CRITICAL' || band === 'HIGH') return 'bg-rose-600 text-white';
  if (band === 'MEDIUM') return 'bg-amber-500 text-white';
  return 'bg-emerald-500 text-white';
}

function fmtDate(v: any) {
  if (!v) return '—';
  try { return format(new Date(v), 'MMM dd, yyyy'); } catch { return String(v); }
}

function fmtAmount(v: any, currency: string = 'USD') {
  const n = parseFloat(String(v));
  return isNaN(n) ? (v || '—') : formatCurrency(n, currency);
}

function displayVal(key: string, val: any, currency: string = 'USD') {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'grossAmount' || key === 'amount') return fmtAmount(val, currency);
  if (key === 'invoiceDate' || key === 'paymentDate' || key === 'dueDate') return fmtDate(val);
  if (key === 'erpType' && String(val).toUpperCase() === 'GENERIC') return 'N/A';
  return String(val);
}

// ─── ERP badge — hide GENERIC ─────────────────────────────────────────────────
function ErpBadge({ erpType }: { erpType?: string }) {
  if (!erpType || erpType.toUpperCase() === 'GENERIC') return null;
  return (
    <Badge variant="outline" className="text-[10px] font-black text-slate-400 border-slate-200 uppercase">
      {erpType}
    </Badge>
  );
}

// ─── Similarity style map ─────────────────────────────────────────────────────
const SIM_STYLES: Record<string, { row: string; cell: string; badge: string; icon: any; label: string }> = {
  exact: {
    row: 'bg-rose-50/60',
    cell: 'bg-rose-50 border border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    icon: AlertCircle,
    label: 'EXACT MATCH',
  },
  near: {
    row: 'bg-amber-50/60',
    cell: 'bg-amber-50 border border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: Equal,
    label: 'NEAR MATCH',
  },
  fuzzy: {
    row: 'bg-yellow-50/40',
    cell: 'bg-yellow-50 border border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    icon: Minus,
    label: 'SIMILAR',
  },
  different: {
    row: '',
    cell: 'bg-white border border-slate-200',
    badge: 'bg-slate-100 text-slate-500',
    icon: Minus,
    label: 'DIFFERENT',
  },
  empty: {
    row: '',
    cell: 'bg-slate-50 border border-slate-200',
    badge: 'bg-slate-100 text-slate-400',
    icon: Minus,
    label: 'EMPTY',
  },
};

// ─── Details / Compare Panel ──────────────────────────────────────────────────
function DetailsPanel({
  item,
  open,
  onClose,
  onTransition,
  isTransitioning,
}: {
  item: Record<string, any> | null;
  open: boolean;
  onClose: () => void;
  onTransition: (ids: string[], state: string, notes: string) => Promise<void>;
  isTransitioning: boolean;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice-compare', item?.id],
    queryFn: async () => {
      if (!item) return null;
      const res = await fetch(`/api/invoices/${item?.id}/compare`);
      if (!res.ok) throw new Error('Failed to load comparison data');
      return res.json();
    },
    enabled: !!item?.id && open,
    staleTime: 30_000,
  });

  const score = item?.riskScore || 0;
  const matched = data?.matched;
  const flagged = data?.flagged;
  const comparison: Record<string, any>[] = data?.comparison || [];
  const exactCount = comparison.filter(r => r.similarity === 'exact').length;
  const nearCount = comparison.filter(r => r.similarity === 'near').length;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[800px] p-0 flex flex-col h-full bg-slate-50">

        {/* Header */}
        <SheetHeader className="p-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div className="flex-grow">
              <SheetTitle className="text-lg font-black text-slate-900">Invoice Comparison</SheetTitle>
              <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Field-by-field match analysis against existing record
              </SheetDescription>
            </div>
            {item && (
              <Badge className={cn("font-black text-sm px-3 py-1.5 ml-auto shrink-0", scoreBadgeClass(score))}>
                {score}% Match
              </Badge>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Legend:</span>
            {[
              { label: 'Exact Match', cls: 'bg-rose-100 text-rose-700' },
              { label: 'Near Match', cls: 'bg-amber-100 text-amber-700' },
              { label: 'Similar', cls: 'bg-yellow-100 text-yellow-700' },
              { label: 'Different', cls: 'bg-slate-100 text-slate-500' },
            ].map(({ label, cls }) => (
              <span key={label} className={cn("text-[10px] font-bold px-2 py-0.5 rounded", cls)}>{label}</span>
            ))}
            {!isLoading && (
              <span className="ml-auto text-[10px] font-bold text-slate-500">
                {exactCount} exact • {nearCount} near
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-bold">Loading comparison data…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-bold">Could not load comparison</p>
            </div>
          ) : !matched ? (
            /* ── No historical match found ── */
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                ⚠ No historical match record found. This invoice was flagged based on partial pattern signals.
              </div>
              {flagged && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-500">Field</th>
                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-rose-600">🚩 Flagged Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Invoice Number', flagged.invoiceNumber],
                        ['Gross Amount', fmtAmount(flagged.grossAmount)],
                        ['Invoice Date', fmtDate(flagged.invoiceDate)],
                        ['Vendor', `${flagged.vendorName} (${flagged.vendorCode})`],
                        ['Company Code', flagged.companyCode],
                        ['PO Number', flagged.poNumber || '—'],
                        ['Currency', flagged.currency],
                        ['Payment Status', flagged.paymentStatus],
                        ['Lifecycle State', flagged.lifecycleState],
                      ].map(([label, val], i) => (
                        <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 w-40">{label}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── Excel-style side-by-side comparison ── */
            <div className="p-4 space-y-4">

              {/* Matched record context banner */}
              <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="shrink-0 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-700 text-sm">📋</span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-0.5">Existing Record Being Compared</p>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="font-black text-blue-900">{matched.invoiceNumber}</span>
                    <span className="text-blue-400">·</span>
                    <span className="text-blue-700">{fmtDate(matched.invoiceDate)}</span>
                    <span className="text-blue-400">·</span>
                    <span className="font-black text-blue-900">{fmtAmount(matched.grossAmount)}</span>
                  </div>
                </div>
                <Badge className={cn("shrink-0 text-[10px] font-bold",
                  matched.lifecycleState === 'PAID' ? 'bg-green-100 text-green-700' :
                    matched.lifecycleState === 'BLOCKED' ? 'bg-rose-100 text-rose-700' :
                      matched.lifecycleState === 'CLEARED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                )}>
                  {matched.lifecycleState}
                </Badge>
              </div>

              {/* The comparison table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ width: 120 }}>Field</th>
                      <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-rose-600" style={{ width: 175 }}>
                        🚩 Flagged Invoice
                      </th>
                      <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600" style={{ width: 175 }}>
                        📋 Existing Record
                      </th>
                      <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Similarity Analysis
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row: Record<string, any>, idx: number) => {
                      const s = SIM_STYLES[row.similarity] || SIM_STYLES.different;
                      const Icon = s.icon;
                      return (
                        <tr key={row.key} className={cn(
                          "border-b border-slate-100 transition-colors",
                          s.row || (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')
                        )}>
                          {/* Field */}
                          <td className="px-3 py-3 align-top">
                            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{row.label}</span>
                          </td>
                          {/* Flagged value */}
                          <td className="px-3 py-3 align-top">
                            <div className={cn("rounded-lg px-2.5 py-2", s.cell)}>
                              <span className={cn("font-bold text-[13px] break-all leading-snug",
                                row.similarity === 'exact' ? 'text-rose-800' :
                                  row.similarity === 'near' ? 'text-amber-800' :
                                    'text-slate-700'
                              )}>
                                {displayVal(row.key, row.flaggedVal, (row.key === 'grossAmount' || row.key === 'amount') ? flagged.currency : 'USD')}
                              </span>
                            </div>
                          </td>
                          {/* Matched value */}
                          <td className="px-3 py-3 align-top">
                            <div className={cn("rounded-lg px-2.5 py-2", s.cell)}>
                              <span className={cn("font-bold text-[13px] break-all leading-snug",
                                row.similarity === 'exact' ? 'text-rose-800' :
                                  row.similarity === 'near' ? 'text-amber-800' :
                                    'text-slate-600'
                              )}>
                                {displayVal(row.key, row.matchedVal, (row.key === 'grossAmount' || row.key === 'amount') ? matched.currency : 'USD')}
                              </span>
                            </div>
                          </td>
                          {/* Commentary */}
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-1.5">
                              <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md", s.badge)}>
                                <Icon className="h-2.5 w-2.5" />
                                {s.label}
                              </span>
                              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[220px]">
                                {row.commentary}
                              </p>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 bg-white border-t border-slate-100 shrink-0 flex gap-3">
          <Button
            variant="outline"
            disabled={isTransitioning || !item}
            onClick={async () => {
              if (!item) return;
              await onTransition([item.id], 'NOT_DUPLICATE', 'Analyst cleared — not a duplicate');
              onClose();
            }}
            className="flex-grow h-12 rounded-xl font-bold uppercase tracking-widest text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {isTransitioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Not a Duplicate
          </Button>
          <Button
            disabled={isTransitioning || !item}
            onClick={async () => {
              if (!item) return;
              await onTransition([item.id], 'CONFIRMED_DUPLICATE', 'Analyst confirmed — confirmed duplicate');
              onClose();
            }}
            className="flex-grow h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
          >
            {isTransitioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            Mark as Duplicate
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Forensics score cell ─────────────────────────────────────────────────────
function InvestigationForensics({ item, onOpenDetails }: { item: Record<string, any>; onOpenDetails: () => void }) {
  const score = item.riskScore || 0;
  const band = scoreBand(score);
  return (
    <div className="inline-flex flex-col items-center cursor-pointer group/score active:scale-95 transition-all" onClick={onOpenDetails}>
      <Badge className={cn("font-black text-[11px] px-3 py-1 rounded-lg shadow-sm mb-1.5 transition-all",
        band === 'CRITICAL' || band === 'HIGH'
          ? "bg-rose-600 text-white group-hover/score:shadow-rose-300"
          : band === 'MEDIUM'
            ? "bg-amber-500 text-white group-hover/score:shadow-amber-200"
            : "bg-emerald-500 text-white"
      )}>
        {score}% Match
      </Badge>
      <div className="flex gap-1">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className={cn("h-1.5 w-3 rounded-full transition-all duration-500",
            i < Math.ceil(score / 20)
              ? (band === 'HIGH' || band === 'CRITICAL' ? 'bg-rose-500' : 'bg-indigo-500')
              : 'bg-slate-200'
          )} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalystWorkbench() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [search, setSearch] = useState("");
  const [detailsItem, setDetailsItem] = useState<Record<string, any> | null>(null);

  const { data: responseData, isLoading, refetch, isFetching } = useQuery<{ data: Record<string, any>[], metadata: any }>({
    queryKey: ["analyst-workbench", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('lifecycleState', 'IN_INVESTIGATION');
      params.append('lifecycleState', 'FLAGGED_HIGH');
      params.append('lifecycleState', 'FLAGGED_MEDIUM');
      params.append('lifecycleState', 'FLAGGED_LOW');
      if (search) params.append('search', search);
      const res = await fetch(`/api/invoices?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch workbench data");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const invoices = responseData?.data || [];
  const metadata = responseData?.metadata || { reportingCurrency: 'USD', showSideBySideAmounts: false };

  const handleTransition = async (ids: string[], targetState: string, notes: string = "Analyst action") => {
    setIsTransitioning(true);
    const toastId = toast.loading(`Moving ${ids.length} item${ids.length > 1 ? 's' : ''}…`);
    try {
      const res = await fetch('/api/invoices/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: ids, targetStatus: targetState, notes, reasonCode: "ANALYST_WORKBENCH" })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Transition failed");
      }
      toast.success(targetState === 'NOT_DUPLICATE' ? 'Cleared for payment ✓' : 'Blocked as duplicate ✓', { id: toastId });
      setSelectedIds([]);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Transition failed", { id: toastId });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleSingleTransition = async (id: string, state: string, notes: string) => {
    await handleTransition([id], state, notes);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter((i: string) => i !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    if (selectedIds.length === invoices?.length) setSelectedIds([]);
    else setSelectedIds(invoices?.map((i: Record<string, any>) => i.id) || []);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <DetailsPanel
        item={detailsItem}
        open={!!detailsItem}
        onClose={() => setDetailsItem(null)}
        onTransition={handleTransition}
        isTransitioning={isTransitioning}
      />

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1700px] mx-auto px-8 h-24 flex items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500 rounded-xl shadow-lg shadow-amber-200">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Analyst Workbench</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Potential Duplicate Investigation Queue</p>
            </div>
          </div>
          <div className="flex-grow max-w-2xl relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Quick search by Invoice # or Vendor..."
              className="pl-10 h-10 border-slate-200 rounded-xl bg-slate-50/50 text-sm focus:bg-white transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl h-11 w-11">
              <RefreshCcw className={cn("h-4 w-4 text-slate-500", isFetching && "animate-spin")} />
            </Button>
            {selectedIds.length > 0 && (
              <div className="flex gap-2 animate-in slide-in-from-right duration-300">
                <Button onClick={() => handleTransition(selectedIds, 'CONFIRMED_DUPLICATE', 'Confirmed duplicate in bulk')} disabled={isTransitioning}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-5 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200">
                  <XCircle className="h-4 w-4 mr-2" /> Block {selectedIds.length}
                </Button>
                <Button onClick={() => handleTransition(selectedIds, 'NOT_DUPLICATE', 'Cleared in bulk')} disabled={isTransitioning}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Clear {selectedIds.length}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-[1700px] mx-auto px-8 pt-8 space-y-6">
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-slate-200/60 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pending Review</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{invoices?.length || 0} <span className="text-xs font-bold text-slate-300">invoices</span></p>
              </div>
              <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/60 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Exposure at Risk</p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {formatCurrency(invoices?.reduce((sum: number, i: any) => sum + (i.amountInReportingCurrency || convertCurrency(Number(i.grossAmount), i.currency, metadata.reportingCurrency)), 0) || 0, metadata.reportingCurrency)}
                </p>
              </div>
              <div className="h-10 w-10 bg-rose-50 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABLE */}
        <Card className="shadow-2xl border-slate-200/60 rounded-3xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[60px] pl-8">
                  <Checkbox
                    checked={selectedIds.length > 0 && selectedIds.length === invoices?.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Group / Primary Invoice</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vendor Intelligence</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Forensics Trace</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="h-20 animate-pulse bg-slate-50/50 border-b" /></TableRow>)
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 grayscale opacity-30">
                      <CheckCircle2 className="h-12 w-12" />
                      <p className="font-black text-xl tracking-tight">Investigation Queue Clear</p>
                      <p className="text-xs font-bold uppercase tracking-widest">No potential duplicates currently flagged</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : Object.entries(
                (invoices || []).reduce((acc: Record<string, Record<string, any>[]>, item: Record<string, any>) => {
                  const gid = item.duplicateGroupId || `UNGRP-${item.id}`;
                  if (!acc[gid]) acc[gid] = [];
                  acc[gid].push(item);
                  return acc;
                }, {})
              ).map(([gid, groupItems]: [string, any]) => {
                const master = groupItems[0];
                return (
                  <TableRow key={gid} className={cn("group hover:bg-slate-50/50 transition-colors border-b border-slate-100", groupItems.every((gi: Record<string, any>) => selectedIds.includes(gi.id)) && "bg-indigo-50/30")}>
                    <TableCell className="pl-8 align-top py-6">
                      <Checkbox
                        checked={groupItems.every((gi: Record<string, any>) => selectedIds.includes(gi.id))}
                        onCheckedChange={() => {
                          const allSelected = groupItems.every((gi: Record<string, any>) => selectedIds.includes(gi.id));
                          if (allSelected) {
                            setSelectedIds(prev => prev.filter(id => !groupItems.some((gi: Record<string, any>) => gi.id === id)));
                          } else {
                            const newIds = groupItems.filter((gi: Record<string, any>) => !selectedIds.includes(gi.id)).map((gi: Record<string, any>) => gi.id);
                            setSelectedIds(prev => [...prev, ...newIds]);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-6 align-top">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">{master.invoiceNumber}</span>
                          <ErpBadge erpType={master.erpType} />
                        </div>
                        {groupItems.length > 1 && (
                          <div className="text-[9px] text-indigo-600 mt-1 font-black uppercase tracking-tighter">
                            Group ID: {gid} ({groupItems.length} items)
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {master.invoiceDate ? format(new Date(master.invoiceDate), 'MMM dd, yyyy') : '-'}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-indigo-600">
                              {formatCurrency(Number(metadata.showSideBySideAmounts ? master.amountInReportingCurrency : master.grossAmount), metadata.reportingCurrency || master.currency || 'USD')}
                            </span>
                            {metadata.showSideBySideAmounts && (
                              <span className="text-[8px] font-bold text-slate-400 uppercase">
                                Local: {formatCurrency(Number(master.grossAmount), master.currency || 'USD')}
                              </span>
                            )}
                          </div>
                        </div>
                        {groupItems.length > 1 && (
                          <div className="mt-3 pl-3 border-l-2 border-indigo-100 flex flex-col gap-1.5">
                            {groupItems.slice(1).map((child: any) => (
                              <div key={child.id} className="text-[10px] flex gap-2 items-center">
                                <span className="text-slate-400 font-mono">#{child.invoiceNumber}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-slate-600 font-bold">{formatCurrency(Number(metadata.showSideBySideAmounts ? child.amountInReportingCurrency : child.grossAmount), metadata.reportingCurrency || child.currency || 'USD')}</span>
                                  {metadata.showSideBySideAmounts && (
                                    <span className="text-[7px] text-slate-400">({formatCurrency(Number(child.grossAmount), child.currency || 'USD')})</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />{master.vendorName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Code: {master.vendorCode}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-6">
                      <div className="flex flex-col items-start max-w-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <InvestigationForensics item={master} onOpenDetails={() => setDetailsItem(master)} />
                          <Badge className={cn(
                            "border-none text-[8px] font-black uppercase px-2 py-0.5",
                            master.matchSource === 'Intra-Proposal Duplicate' ? 'bg-indigo-50 text-indigo-600' :
                              master.matchSource === 'Mixed Match' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                          )}>
                            {master.matchSource || 'External/Pattern'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium leading-tight">
                          {master.matchingReason || "Pattern or rules identified potential duplicate behavior."}
                        </p>
                        {(master.systemComments || master.investigationNotes) && (
                          <p className="text-[9px] text-slate-400 mt-1.5 italic line-clamp-3">
                            {master.systemComments || master.investigationNotes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8 align-top py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="outline" disabled={isTransitioning}
                                onClick={() => handleTransition(groupItems.map((gi: any) => gi.id), 'NOT_DUPLICATE', 'Quick clear ' + groupItems.length + ' items')}
                                className="rounded-xl h-9 w-9 border-emerald-100 text-emerald-600 hover:bg-emerald-50 shadow-sm">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-emerald-600 text-white border-0 text-xs">Clear for Payment</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="outline" disabled={isTransitioning}
                                onClick={() => handleTransition(groupItems.map((gi: any) => gi.id), 'CONFIRMED_DUPLICATE', 'Quick block ' + groupItems.length + ' items')}
                                className="rounded-xl h-9 w-9 border-rose-100 text-rose-600 hover:bg-rose-50 shadow-sm">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-rose-600 text-white border-0 text-xs">Block as Duplicate</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="ghost" className="rounded-xl h-9 px-3 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-900 group/btn"
                          onClick={() => setDetailsItem(master)}>
                          Details <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
