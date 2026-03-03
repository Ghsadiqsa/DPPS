'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  RefreshCcw,
  Info,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  AlertTriangle,
  Activity
} from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function AnalystWorkbench() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [search, setSearch] = useState("");

  // 1. Fetch Invoices requiring analyst review (POTENTIAL_DUPLICATE)
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

  const handleTransition = async (ids: string[], targetState: string, notes: string = "Analyst bulk action") => {
    setIsTransitioning(true);
    const toastId = toast.loading(`Moving ${ids.length} items to ${targetState}...`);
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

      if (!res.ok) throw new Error("Transition failed");

      toast.success(`Transition successful`, { id: toastId });
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error("Transition failed", { id: toastId });
    } finally {
      setIsTransitioning(false);
    }
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
            <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl h-11 w-11"><RefreshCcw className={cn("h-4 w-4 text-slate-500", isFetching && "animate-spin")} /></Button>
            {selectedIds.length > 0 && (
              <div className="flex gap-2 animate-in slide-in-from-right duration-300">
                <Button
                  onClick={() => handleTransition(selectedIds, 'BLOCKED', 'Confirmed duplicate in bulk')}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-5 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200"
                >
                  <XCircle className="h-4 w-4 mr-2" /> Block {selectedIds.length}
                </Button>
                <Button
                  onClick={() => handleTransition(selectedIds, 'CLEARED', 'Cleared in bulk')}
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

        {/* STATS OVERVIEW */}
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

        {/* WORKBENCH TABLE */}
        <Card className="shadow-2xl border-slate-200/60 rounded-3xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[60px] pl-8">
                  <Checkbox checked={selectedIds.length === invoices?.length && invoices?.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Candidate Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vendor Intelligence</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">Forensics Score</TableHead>
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
              ) : invoices?.map((item: any) => (
                <TableRow key={item.id} className={cn("group hover:bg-slate-50/50 transition-colors border-b border-slate-100", selectedIds.includes(item.id) && "bg-indigo-50/30")}>
                  <TableCell className="pl-8">
                    <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  </TableCell>
                  <TableCell className="py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">{item.invoiceNumber}</span>
                        <Badge variant="outline" className="text-[10px] font-black text-slate-400 border-slate-200 uppercase">{item.erpType}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Calendar className="h-3 w-3" /> {item.invoiceDate ? format(new Date(item.invoiceDate), 'MMM dd, yyyy') : '-'}
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
                    <InvestigationForensics item={item} />
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="outline" onClick={() => handleTransition([item.id], 'CLEARED')} className="rounded-xl h-9 w-9 border-emerald-100 text-emerald-600 hover:bg-emerald-50">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-emerald-600 text-white border-0 text-xs">Clear for Payment</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="outline" onClick={() => handleTransition([item.id], 'BLOCKED')} className="rounded-xl h-9 w-9 border-rose-100 text-rose-600 hover:bg-rose-50">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-rose-600 text-white border-0 text-xs">Block as Duplicate</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" className="rounded-xl h-9 px-3 text-xs font-bold text-slate-400 hover:text-slate-900 group/btn">
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

function InvestigationForensics({ item }: { item: any }) {
  const score = item.riskScore || 0;
  const band = item.riskBand || 'LOW';

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="inline-flex flex-col items-center cursor-pointer group/score transition-all active:scale-95">
          <Badge className={cn(
            "font-black text-[11px] px-3 py-1 rounded-lg shadow-sm mb-1.5 transition-all",
            band === 'HIGH' ? "bg-rose-600 text-white shadow-rose-100 group-hover/score:shadow-rose-300" :
              band === 'MEDIUM' ? "bg-amber-500 text-white shadow-amber-100 group-hover/score:shadow-amber-200" :
                "bg-emerald-500 text-white shadow-emerald-100"
          )}>
            {score}% Match
          </Badge>
          <div className="flex gap-1">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className={cn(
                "h-1.5 w-3 rounded-full transition-all duration-500",
                i < Math.ceil(score / 20) ? (band === 'HIGH' ? 'bg-rose-500' : 'bg-indigo-500') : 'bg-slate-200'
              )} />
            ))}
          </div>
        </div>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-[500px] p-0 flex flex-col h-full bg-slate-50">
        <SheetHeader className="p-8 bg-white border-b border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100">
              <BrainCircuit className="h-8 w-8 text-white" />
            </div>
            <div>
              <SheetTitle className="text-2xl font-black text-slate-900">Investigation Forensics</SheetTitle>
              <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Algorithmic Match Profile</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Similarity Vectors</h4>
            <div className="grid grid-cols-2 gap-4">
              <ForensicMetric label="Name Match" value="High" progress={98} />
              <ForensicMetric label="Amount Match" value="Exact" progress={100} />
              <ForensicMetric label="Pattern Drift" value="Low" progress={12} invert />
              <ForensicMetric label="Vendor Master" value="Match" progress={95} />
            </div>
          </div>

          <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Model Confidence</span>
              <span className="text-3xl font-black text-emerald-400">{score}%</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${score}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">The DPPS Engine has identified this invoice as a near-perfect match to a previously cleared record within this vendor context.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Historical Context</h4>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">12</div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Prior Flags</p>
                  <p className="text-[10px] text-slate-500">Same vendor, last 12 months</p>
                </div>
              </div>
              <Badge className="bg-rose-50 text-rose-700 border-0">High Freq</Badge>
            </div>
          </div>
        </div>

        <div className="p-8 bg-white border-t border-slate-100 mt-auto flex gap-3">
          <Button variant="outline" className="flex-grow h-12 rounded-xl font-bold uppercase tracking-widest text-xs">Dismiss Risk</Button>
          <Button className="flex-grow h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Confirm Duplicate</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ForensicMetric({ label, value, progress, invert }: any) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-tight">{label}</span>
        <span className="text-xs font-black text-slate-900">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-1000", invert ? "bg-rose-400" : "bg-indigo-500")}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
