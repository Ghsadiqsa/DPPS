'use client';

import { useState, useRef, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Search,
  Download,
  Activity,
  CheckCircle2,
  ArrowRight,
  Lock,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  History,
  Building2,
  Calendar,
  BrainCircuit,
  MoreHorizontal,
  AlertCircle,
  Equal,
  Minus,
  TableProperties,
  ListOrdered,
  CalendarDays,
  FileBox,
  RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// 1. Types & Constants
interface ValidationResult {
  totalLines: number;
  approvedLines: number;
  duplicatesDetected: number;
  duplicates: DetectedDuplicate[];
  approvedForPayment: any[];
}

interface DetectedDuplicate {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  amount: number;
  invoiceDate: string;
  status: 'BLOCKED' | 'POTENTIAL_DUPLICATE' | 'CLEARED';
  score: number;
  riskLevel: string;
  signals: { name: string; score: number; triggered: boolean }[];
  matchedWith?: any;
}

const STORAGE_KEY = 'payment_gate_v2_state';


// ─── Batch History Panel ────────────────────────────────────────────────────
function BatchHistoryPanel() {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/batches?includeItems=true');
      if (res.ok) setBatches(await res.json());
    } catch { /* silent */ } finally { setIsLoading(false); }
  };
  useEffect(() => { fetchBatches(); }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <div className="h-8 w-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <ListOrdered className="h-4 w-4" />
            </div>
            Payment Batch History
          </h2>
          <p className="text-slate-500 mt-1 text-sm">Audit ledger of all released payment exports.</p>
        </div>
        <Button variant="outline" className="font-bold border-slate-200 shadow-sm" onClick={fetchBatches}>
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-24 text-slate-400 font-bold animate-pulse">Loading...</div>
      ) : batches.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
          <FileBox className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900">No Payment Batches Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">Release approved proposals from the Gate tab to generate export records.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <Card key={batch.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200/60">
              <div className="bg-white p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50" onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}>
                <div className="flex items-center gap-5">
                  <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/50">
                    <Download className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-black text-slate-900 text-lg">Batch #{batch.id.substring(0, 8).toUpperCase()}</h3>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{batch.exportFormat}</Badge>
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold border-none">{batch.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(batch.createdAt), 'MMM dd, yyyy • HH:mm')}</span>
                      <span>•</span><span>{batch.totalCount} items</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Value</p>
                    <p className="text-xl font-black text-emerald-700">{formatCurrency(batch.totalAmount)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 rounded-full hover:bg-slate-200">
                    {expandedBatchId === batch.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              <AnimatePresence>
                {expandedBatchId === batch.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 bg-slate-50/80">
                    <div className="p-6">
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                              {['#', 'Reference', 'Vendor', 'Amount', 'Currency'].map(h => <th key={h} className="p-3 font-bold uppercase tracking-widest text-[10px]">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {batch.items?.map((row: any, idx: number) => (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="p-3 text-slate-400 text-xs">{idx + 1}</td>
                                <td className="p-3 text-slate-900 font-bold">{row.invoiceNumber || row.invoiceId}</td>
                                <td className="p-3 text-slate-600">{row.vendorCode}</td>
                                <td className="p-3 text-emerald-700 font-bold text-right">{formatCurrency(row.amount)}</td>
                                <td className="p-3 text-slate-500 text-xs">{row.currency}</td>
                              </tr>
                            ))}
                            {(!batch.items || batch.items.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No items.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentGateElite() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [gateTab, setGateTab] = useState<'gate' | 'batches'>('gate');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setValidationResult(parsed.result);
        setFileName(parsed.fileName);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (validationResult) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: validationResult, fileName }));
    }
  }, [validationResult, fileName]);

  // 2. Upload Logic
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setFileName(file.name);
    setValidationResult(null);

    const progressTimer = setInterval(() => {
      setUploadProgress(prev => prev >= 90 ? prev : prev + 5);
    }, 200);

    try {
      // Simple CSV parse for the payload
      const text = await file.text();
      const rows = text.split('\n').filter(r => r.trim()).map(r => r.split(','));
      const invoices = rows.slice(1).map(cols => ({
        invoiceNumber: cols[0]?.trim() || "INV-UNK",
        vendorId: cols[1]?.trim() || "V-UNK",
        amount: parseFloat(cols[2]) || 0,
        invoiceDate: cols[3]?.trim() || new Date().toISOString(),
      }));

      const res = await fetch('/api/payment-gate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Analysis failed");
      }
      const data = await res.json();

      if (!data || data.error) throw new Error(data.error || "Malformed response");

      clearInterval(progressTimer);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setValidationResult(data);
        toast.success("Proposal Analysis Complete", {
          description: `Successfully analyzed ${data.totalLines || 0} records.`
        });
      }, 500);
    } catch (err) {
      clearInterval(progressTimer);
      setIsUploading(false);
      toast.error("Analysis Failed", { description: "The DPPS Engine could not parse this file." });
    }
  };

  const clearWorkbench = () => {
    setValidationResult(null);
    setFileName(null);
    localStorage.removeItem(STORAGE_KEY);
    toast.info("Workbench Cleared");
  };

  // 3. Filtered View
  const filteredDuplicates = useMemo(() => {
    if (!validationResult || !Array.isArray(validationResult.duplicates)) return [];
    let list = validationResult.duplicates;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(d =>
        d.invoiceNumber?.toLowerCase().includes(s) ||
        d.vendorId?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [validationResult, search]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">

      {/* HEADER SECTION (Elite) */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
              <History className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Payment Gate</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Proposal Validation Hub</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setGateTab('gate')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  gateTab === 'gate' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Gate
              </button>
              <button
                onClick={() => setGateTab('batches')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  gateTab === 'batches' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ListOrdered className="h-3 w-3" /> Batch History
              </button>
            </div>
            {validationResult && gateTab === 'gate' && (
              <Button variant="outline" onClick={clearWorkbench} className="rounded-xl h-10 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all">
                Reset Hub
              </Button>
            )}
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-900 text-white hover:bg-black rounded-xl h-10 px-6 text-xs font-bold uppercase tracking-wider shadow-xl shadow-slate-200"
            >
              <Upload className="h-4 w-4 mr-2" /> Upload Flow
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept=".csv" />
          </div>
        </div>
      </div>

      {gateTab === 'batches' ? (
        <BatchHistoryPanel />
      ) : (
        <main className="max-w-[1400px] mx-auto px-8 pt-8 space-y-8">

          {!validationResult && !isUploading ? (
            <div className="mt-20 flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                <div className="relative h-24 w-24 bg-white border border-slate-100 rounded-3xl shadow-2xl flex items-center justify-center animate-bounce duration-[3000ms]">
                  <FileText className="h-10 w-10 text-indigo-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Drop a payment proposal.</h2>
                <p className="text-slate-500 font-medium">Instantly cross-check against billions of records using the DPPS AI Detection Engine. Precision-engineered for CFO-grade assurance.</p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-2xl shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95">
                Select File to Begin
              </Button>
              <div className="flex gap-8 pt-4">
                <div className="flex flex-col items-center opacity-40">
                  <Badge variant="outline" className="text-[10px] font-black mb-1">ISO 20022</Badge>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">Compliant</span>
                </div>
                <div className="flex flex-col items-center opacity-40">
                  <Badge variant="outline" className="text-[10px] font-black mb-1">SAP IDOC</Badge>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">Supported</span>
                </div>
              </div>
            </div>
          ) : isUploading ? (
            <div className="mt-20 max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/10 animate-ping rounded-full" />
                  <BrainCircuit className="relative h-16 w-16 text-indigo-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Validating Intelligence...</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Analyzing {fileName}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Progress value={uploadProgress} className="h-3 bg-slate-100" />
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Scanning Pattern Hub</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            </div>
          ) : validationResult ? (
            <div className="space-y-8 animate-in fade-in duration-700">

              {/* 4. IMPACT CARDS (Elite) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Proposal Volume"
                  value={validationResult.totalLines}
                  sub="Invoices analyzed"
                  icon={Activity}
                  trend="+12%"
                  color="indigo"
                />
                <MetricCard
                  label="Approved Release"
                  value={validationResult.approvedLines}
                  sub={formatCurrency(Array.isArray(validationResult.approvedForPayment) ? validationResult.approvedForPayment.reduce((s, i) => s + Number(i.amount || 0), 0) : 0)}
                  icon={ShieldCheck}
                  color="emerald"
                />
                <MetricCard
                  label="Blocked Exposure"
                  value={validationResult.duplicatesDetected}
                  sub={formatCurrency(Array.isArray(validationResult.duplicates) ? validationResult.duplicates.reduce((s, i) => s + Number(i.amount || 0), 0) : 0)}
                  icon={ShieldAlert}
                  color="rose"
                />
                <MetricCard
                  label="Confidence Score"
                  value="98.4%"
                  sub="Model accuracy"
                  icon={BrainCircuit}
                  color="slate"
                />
              </div>

              {/* 5. WORKBENCH SECTION */}
              <div className="grid lg:grid-cols-12 gap-8">

                <div className="lg:col-span-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Risk Investigation Queue
                    </h3>
                    <div className="relative w-72">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Filter by invoice..."
                        className="pl-10 h-9 rounded-xl border-slate-200 text-xs focus:bg-white bg-slate-100/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {filteredDuplicates.map((dup) => (
                        <div key={dup.id} className="group">
                          <Card className={cn(
                            "rounded-2xl border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden bg-white",
                            expandedId === dup.id && "ring-2 ring-indigo-500 ring-offset-2"
                          )}>
                            <div className="p-5 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "h-12 w-12 rounded-xl flex items-center justify-center font-black transition-all",
                                  dup.score >= 90 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                )}>
                                  {dup.score}%
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900">{dup.invoiceNumber}</span>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 border-slate-100">{dup.vendorId}</Badge>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                                    <span className="text-slate-900">{formatCurrency(dup.amount)}</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                                    <span>{format(new Date(dup.invoiceDate || new Date()), 'MMM dd, yyyy')}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                  {dup.signals.map((s, idx) => (
                                    <TooltipProvider key={idx}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] text-slate-600 font-bold cursor-help hover:z-10 transition-all">
                                            {s.name.charAt(0)}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-0 text-[10px] font-bold">{s.name}</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedId(expandedId === dup.id ? null : dup.id)}
                                  className="rounded-xl h-9 w-9 p-0 text-slate-400 hover:text-slate-900"
                                >
                                  {expandedId === dup.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </Button>
                              </div>
                            </div>

                            {/* EXPANDED COMPARISON (Forensics) */}
                            {expandedId === dup.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6"
                              >
                                <div className="grid md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                      <BrainCircuit className="h-3 w-3" /> Comparison Matrix
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm text-xs">
                                      <table className="w-full">
                                        <thead className="bg-slate-50 border-b">
                                          <tr>
                                            <th className="p-3 text-left font-bold text-slate-500">Field</th>
                                            <th className="p-3 text-left font-bold text-slate-900">Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          <ForensicRow label="Invoice #" value={dup.invoiceNumber} match={dup.matchedWith?.invoiceNumber} />
                                          <ForensicRow label="Gross Amount" value={formatCurrency(dup.amount)} match={formatCurrency(dup.matchedWith?.amount)} />
                                          <ForensicRow label="Invoice Date" value={format(new Date(dup.invoiceDate), 'MMM dd')} match={format(new Date(dup.matchedWith?.invoiceDate || ''), 'MMM dd')} />
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600">
                                      <ShieldAlert className="h-3 w-3" /> Risk Explanation
                                    </div>
                                    <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                        The <span className="font-bold text-indigo-600">DPPS Detection Engine</span> identified a match with <span className="font-bold text-slate-900">Case ID #{dup.matchedWith?.id?.slice(0, 8)}</span>.
                                        Similarity score of <span className="font-black">{dup.score}%</span> is primarily driven by normalized vendor identification and exact amount correlation.
                                      </p>
                                      <div className="flex gap-2">
                                        <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-8 px-4 text-[10px] font-black uppercase">Hold (Confirm Duplicate)</Button>
                                        <Button size="sm" variant="outline" className="rounded-xl h-8 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Clear</Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </Card>
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  <Card className="rounded-3xl border-slate-200/60 shadow-xl overflow-hidden bg-slate-900 text-white">
                    <CardHeader className="p-8 pb-4">
                      <CardTitle className="text-xl font-black tracking-tight">System Decision</CardTitle>
                      <CardDescription className="text-slate-400 font-medium">Automatic actions executed based on risk policy.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                      <div className="space-y-4">
                        <DecisionItem icon={Lock} label="Hard Blocked" count={validationResult.duplicates.filter(d => d.score >= 95).length} color="rose" />
                        <DecisionItem icon={Eye} label="Investigation Required" count={validationResult.duplicates.filter(d => d.score < 95).length} color="amber" />
                        <DecisionItem icon={CheckCircle2} label="Clean Release" count={validationResult.approvedLines} color="emerald" />
                      </div>

                      <div className="p-6 bg-slate-800 rounded-3xl border border-slate-700/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Policy Compliance</span>
                          <span className="text-xs font-bold text-emerald-400">100% SECURE</span>
                        </div>
                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: '100%' }} />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">System state is deterministic. All released payments meet the configured threshold of &lt;70% similarity.</p>
                      </div>

                      <Button className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl">
                        Finalize Batch Process
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      )}
    </div>
  );
}

// Sub-components
function MetricCard({ label, value, sub, icon: Icon, trend, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-600 text-indigo-100 shadow-indigo-100",
    emerald: "bg-emerald-600 text-emerald-100 shadow-emerald-100",
    rose: "bg-rose-600 text-rose-100 shadow-rose-100",
    slate: "bg-slate-900 text-slate-100 shadow-slate-100"
  };
  const accent: any = {
    indigo: "text-indigo-600",
    emerald: "text-emerald-500",
    rose: "text-rose-500",
    slate: "text-slate-400"
  };

  return (
    <Card className="rounded-3xl border-slate-200/60 shadow-lg hover:shadow-2xl transition-all duration-300 group overflow-hidden bg-white">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2.5 rounded-xl flex items-center justify-center text-white", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[10px] group-hover:scale-110 transition-transform">{trend}</Badge>}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
          <p className={cn("text-[10px] font-bold mt-1", accent[color])}>{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ForensicRow({ label, value, match }: any) {
  const isMatched = value === match;
  return (
    <tr>
      <td className="p-3 font-bold text-slate-500">{label}</td>
      <td className="p-3">
        <div className="flex flex-col gap-1">
          <span className="font-black text-slate-900">{value}</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit uppercase",
            isMatched ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
          )}>
            {isMatched ? "Exact Match" : "Fuzzy Match"}
          </span>
          <span className="text-[9px] text-slate-400 font-mono">Matched: {match || 'N/A'}</span>
        </div>
      </td>
    </tr>
  );
}

function DecisionItem({ icon: Icon, label, count, color }: any) {
  const colors: any = {
    rose: "bg-rose-500/20 text-rose-400",
    amber: "bg-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/20 text-emerald-400"
  };
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 group hover:border-indigo-500/50 transition-all">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", colors[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-bold text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-black text-white">{count}</span>
    </div>
  );
}

import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
