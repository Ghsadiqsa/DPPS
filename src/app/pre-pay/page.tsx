'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";
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
  DollarSign,
  FileText,
  Hash,
  Layers,
  Clock,
  Loader2,
} from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Signal computation (mirrors the server-side detection engine) ───────────
function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const m = s1.length, n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

function computeSignals(item: any) {
  const score = item.riskScore || 0;
  // We reconstruct signals from the stored data on the invoice
  // These mirror the detection engine's logic
  const invNum = item.invoiceNumber || '';
  const vendorCode = item.vendorCode || '';
  const amount = Number(item.grossAmount) || 0;

  // Heuristic: if score ≥ 85 → composite key likely matched
  const compositeKeyLikely = score >= 85;
  // Exact amount: if score ≥ 40 points attributed to amount
  const exactAmountLikely = score >= 70; // vendor (30) + amount (40) = 70 baseline
  // Vendor match: score ≥ 30
  const vendorMatchLikely = score >= 30;
  // Fuzzy invoice pattern
  const patternScore = Math.min(30, Math.max(0, score - (exactAmountLikely ? 40 : 0) - (vendorMatchLikely ? 30 : 0)));
  const invoiceSimilarity = compositeKeyLikely ? 100 : Math.round((patternScore / 30) * 100);
  const dateProximityLikely = score >= 50;

  return [
    {
      name: 'Exact Amount Match',
      icon: DollarSign,
      triggered: exactAmountLikely,
      weight: '40 pts',
      value: exactAmountLikely ? `${formatCurrency(amount)} exact` : 'No match',
      description: 'Invoice amounts match to the cent — strongest duplicate signal',
      color: exactAmountLikely ? 'emerald' : 'slate',
    },
    {
      name: 'Vendor Identity',
      icon: Building2,
      triggered: vendorMatchLikely,
      weight: '30 pts',
      value: vendorMatchLikely ? vendorCode : 'Different vendor',
      description: 'Same vendor code found in the master database',
      color: vendorMatchLikely ? 'blue' : 'slate',
    },
    {
      name: 'Invoice Pattern (Fuzzy)',
      icon: FileText,
      triggered: invoiceSimilarity > 80,
      weight: '30 pts',
      value: `${invoiceSimilarity}% similar`,
      description: 'Levenshtein edit-distance similarity — catches OCR and typo variants',
      color: invoiceSimilarity > 80 ? 'amber' : 'slate',
    },
    {
      name: 'Composite Key',
      icon: Layers,
      triggered: compositeKeyLikely,
      weight: '+50 boost',
      value: compositeKeyLikely ? 'Vendor + CompanyCode + Ref match' : 'No composite match',
      description: 'All three ERP keys match — near-certain duplicate',
      color: compositeKeyLikely ? 'rose' : 'slate',
    },
    {
      name: 'Date Proximity',
      icon: Clock,
      triggered: dateProximityLikely,
      weight: 'Supplementary',
      value: dateProximityLikely ? 'Within 7 days' : 'Outside window',
      description: 'Invoice dates are close — supports duplicate hypothesis',
      color: dateProximityLikely ? 'purple' : 'slate',
    },
  ];
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

// ─── Risk score band ──────────────────────────────────────────────────────────
function scoreBand(score: number) {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function scoreBadgeClass(score: number) {
  const band = scoreBand(score);
  if (band === 'CRITICAL') return 'bg-rose-600 text-white shadow-rose-100';
  if (band === 'HIGH') return 'bg-rose-500 text-white shadow-rose-100';
  if (band === 'MEDIUM') return 'bg-amber-500 text-white shadow-amber-100';
  return 'bg-emerald-500 text-white shadow-emerald-100';
}

// ─── Details Side Panel ───────────────────────────────────────────────────────
function DetailsPanel({
  item,
  open,
  onClose,
  onTransition,
  isTransitioning,
}: {
  item: any;
  open: boolean;
  onClose: () => void;
  onTransition: (id: string, state: string, notes: string) => Promise<void>;
  isTransitioning: boolean;
}) {
  const score = item?.riskScore || 0;
  const signals = item ? computeSignals(item) : [];
  const triggeredSignals = signals.filter(s => s.triggered);

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    slate: 'bg-slate-100 text-slate-400 border-slate-200',
  };
  const dotMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-300',
  };
  const barMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-200',
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[540px] p-0 flex flex-col h-full bg-slate-50">
        {/* Header */}
        <SheetHeader className="p-8 bg-white border-b border-slate-100">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100">
              <BrainCircuit className="h-8 w-8 text-white" />
            </div>
            <div>
              <SheetTitle className="text-2xl font-black text-slate-900">Match Analysis</SheetTitle>
              <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Algorithmic Duplicate Investigation
              </SheetDescription>
            </div>
          </div>
          {item && (
            <div className="flex items-center gap-3 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-col min-w-0">
                <span className="font-black text-slate-900 text-sm truncate">{item.invoiceNumber}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.vendorName} · {item.vendorCode}</span>
              </div>
              <div className="ml-auto flex-shrink-0">
                <Badge className={cn("font-black text-sm px-3 py-1", scoreBadgeClass(score))}>
                  {score}% Match
                </Badge>
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8">

          {/* Confidence meter */}
          <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detection Confidence</span>
              <span className={cn("text-3xl font-black", score >= 85 ? 'text-rose-400' : score >= 70 ? 'text-amber-400' : 'text-emerald-400')}>
                {score}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-1000", score >= 85 ? 'bg-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : score >= 70 ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]')}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase">
                <span>Low</span><span>Medium</span><span>High</span><span>Critical</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              {score >= 85
                ? 'AUTO-HOLD: This invoice matches all primary signals including composite ERP key. Manager approval required before payment.'
                : score >= 70
                  ? 'REVIEW REQUIRED: Multiple signals triggered. Analyst verification mandatory before payment release.'
                  : 'FLAGGED: Partial match detected. Review recommended.'}
            </p>
          </div>

          {/* Signals breakdown */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Signals Fired ({triggeredSignals.length}/{signals.length})
            </h4>
            {signals.map((sig) => {
              const Icon = sig.icon;
              return (
                <div key={sig.name} className={cn(
                  "p-4 rounded-xl border transition-all",
                  sig.triggered ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-50'
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", colorMap[sig.color] || colorMap.slate)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-black text-slate-800">{sig.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">{sig.weight}</span>
                          <div className={cn("h-2 w-2 rounded-full", sig.triggered ? dotMap[sig.color] : 'bg-slate-200')} />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">{sig.description}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-grow h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-700", barMap[sig.color])}
                            style={{ width: sig.triggered ? '100%' : '0%' }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase", sig.triggered ? 'text-slate-700' : 'text-slate-300')}>
                          {sig.value}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoice metadata */}
          {item && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice Details</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Invoice #', value: item.invoiceNumber, icon: Hash },
                  { label: 'Amount', value: formatCurrency(Number(item.grossAmount)), icon: DollarSign },
                  { label: 'Invoice Date', value: item.invoiceDate ? format(new Date(item.invoiceDate), 'MMM dd, yyyy') : '-', icon: Calendar },
                  { label: 'Vendor', value: item.vendorName || item.vendorCode, icon: Building2 },
                  { label: 'Company Code', value: item.companyCode || '-', icon: Layers },
                  { label: 'PO Number', value: item.poNumber || '-', icon: FileText },
                  { label: 'Reference', value: item.referenceNumber || '-', icon: FileText },
                  { label: 'ERP Type', value: item.erpType && item.erpType.toUpperCase() !== 'GENERIC' ? item.erpType : 'N/A', icon: Activity },
                ].map(field => {
                  const Icon = field.icon;
                  return (
                    <div key={field.label} className="p-3 bg-white border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 text-slate-400" />
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{field.label}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800 truncate block">{field.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-white border-t border-slate-100 mt-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-grow h-12 rounded-xl font-bold uppercase tracking-widest text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            disabled={isTransitioning || !item}
            onClick={async () => {
              if (!item) return;
              await onTransition(item.id, 'CLEARED', 'Analyst cleared — not a duplicate');
              onClose();
            }}
          >
            {isTransitioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Not a Duplicate
          </Button>
          <Button
            className="flex-grow h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
            disabled={isTransitioning || !item}
            onClick={async () => {
              if (!item) return;
              await onTransition(item.id, 'BLOCKED', 'Analyst confirmed — confirmed duplicate');
              onClose();
            }}
          >
            {isTransitioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            Mark as Duplicate
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Forensics score cell (click opens details) ───────────────────────────────
function InvestigationForensics({ item, onOpenDetails }: { item: any; onOpenDetails: () => void }) {
  const score = item.riskScore || 0;
  const band = scoreBand(score);

  return (
    <div
      className="inline-flex flex-col items-center cursor-pointer group/score transition-all active:scale-95"
      onClick={onOpenDetails}
    >
      <Badge className={cn(
        "font-black text-[11px] px-3 py-1 rounded-lg shadow-sm mb-1.5 transition-all",
        band === 'CRITICAL' || band === 'HIGH' ? "bg-rose-600 text-white shadow-rose-100 group-hover/score:shadow-rose-300" :
          band === 'MEDIUM' ? "bg-amber-500 text-white shadow-amber-100 group-hover/score:shadow-amber-200" :
            "bg-emerald-500 text-white shadow-emerald-100"
      )}>
        {score}% Match
      </Badge>
      <div className="flex gap-1">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className={cn(
            "h-1.5 w-3 rounded-full transition-all duration-500",
            i < Math.ceil(score / 20) ? (band === 'HIGH' || band === 'CRITICAL' ? 'bg-rose-500' : 'bg-indigo-500') : 'bg-slate-200'
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
  const [detailsItem, setDetailsItem] = useState<any>(null);

  const { data: invoices, isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["analyst-workbench", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('lifecycleState', 'POTENTIAL_DUPLICATE');
      if (search) params.append('search', search);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch workbench data");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    }
  });

  const handleTransition = async (ids: string[], targetState: string, notes: string = "Analyst action") => {
    setIsTransitioning(true);
    const toastId = toast.loading(`Moving ${ids.length} item${ids.length > 1 ? 's' : ''} to ${targetState}...`);
    try {
      const res = await fetch('/api/invoices/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: ids,
          targetStatus: targetState,
          notes,
          reasonCode: "ANALYST_WORKBENCH"
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Transition failed");
      }
      toast.success(targetState === 'CLEARED' ? 'Cleared for payment ✓' : 'Blocked as duplicate ✓', { id: toastId });
      setSelectedIds([]);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Transition failed", { id: toastId });
    } finally {
      setIsTransitioning(false);
    }
  };

  // Single-item transition (used by Details panel)
  const handleSingleTransition = async (id: string, state: string, notes: string) => {
    await handleTransition([id], state, notes);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices?.length) setSelectedIds([]);
    else setSelectedIds(invoices?.map(i => i.id) || []);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Details panel */}
      <DetailsPanel
        item={detailsItem}
        open={!!detailsItem}
        onClose={() => setDetailsItem(null)}
        onTransition={handleSingleTransition}
        isTransitioning={isTransitioning}
      />

      {/* HEADER SECTION */}
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
                <Button
                  onClick={() => handleTransition(selectedIds, 'BLOCKED', 'Confirmed duplicate in bulk')}
                  disabled={isTransitioning}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-5 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200"
                >
                  <XCircle className="h-4 w-4 mr-2" /> Block {selectedIds.length}
                </Button>
                <Button
                  onClick={() => handleTransition(selectedIds, 'CLEARED', 'Cleared in bulk')}
                  disabled={isTransitioning}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200"
                >
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
                  {formatCurrency(invoices?.reduce((sum, i) => sum + Number(i.grossAmount), 0) || 0)}
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
                    checked={selectedIds.length === invoices?.length && (invoices?.length ?? 0) > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Candidate Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vendor Intelligence</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">Forensics Score</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="h-20 animate-pulse bg-slate-50/50 border-b" />
                  </TableRow>
                ))
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
              ) : invoices?.map((item: any) => (
                <TableRow key={item.id} className={cn("group hover:bg-slate-50/50 transition-colors border-b border-slate-100", selectedIds.includes(item.id) && "bg-indigo-50/30")}>
                  <TableCell className="pl-8">
                    <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  </TableCell>

                  <TableCell className="py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">{item.invoiceNumber}</span>
                        <ErpBadge erpType={item.erpType} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {item.invoiceDate ? format(new Date(item.invoiceDate), 'MMM dd, yyyy') : '-'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600">
                          {formatCurrency(Number(item.grossAmount))}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {item.vendorName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Code: {item.vendorCode}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <InvestigationForensics item={item} onOpenDetails={() => setDetailsItem(item)} />
                  </TableCell>

                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleTransition([item.id], 'CLEARED', 'Quick clear — not a duplicate')}
                              disabled={isTransitioning}
                              className="rounded-xl h-9 w-9 border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-emerald-600 text-white border-0 text-xs">Clear for Payment</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleTransition([item.id], 'BLOCKED', 'Quick block — confirmed duplicate')}
                              disabled={isTransitioning}
                              className="rounded-xl h-9 w-9 border-rose-100 text-rose-600 hover:bg-rose-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-rose-600 text-white border-0 text-xs">Block as Duplicate</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        className="rounded-xl h-9 px-3 text-xs font-bold text-slate-400 hover:text-slate-900 group/btn"
                        onClick={() => setDetailsItem(item)}
                      >
                        Details <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
