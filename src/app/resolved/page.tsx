'use client';

import * as XLSX from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search, Download, CheckCircle2, XCircle, AlertTriangle, Calendar, Loader2,
    FileSpreadsheet, FileJson, FileCode2, ChevronRight, Building2, Eye
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface ResolvedInvoice {
    id: string;
    invoiceNumber: string;
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    erpType: string;
    companyCode: string;
    grossAmount: string;
    amount: string;
    currency: string;
    invoiceDate: string;
    poNumber: string;
    status: string;
    isDuplicate: boolean;
    similarityScore: number;
    signals: string[];
    investigationNotes?: string;
    statusUpdatedAt?: string;
    createdAt: string;
}

type CategoryFilter = 'all' | 'ready_for_payment' | 'confirmed_duplicate';

export default function DuplicateResolved() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<CategoryFilter>("ready_for_payment");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewOpen, setPreviewOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);

    // Fetch all resolved invoices
    const { data: invoices = [], isLoading } = useQuery<ResolvedInvoice[]>({
        queryKey: ["resolved-invoices"],
        queryFn: async () => {
            const res = await fetch('/api/invoices?lifecycleState=CONFIRMED_DUPLICATE&lifecycleState=NOT_DUPLICATE&lifecycleState=RECOVERY_RESOLVED');
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            const dataArray = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
            // Map lifecycleState to status if status is undefined
            return dataArray.map((i: any) => ({
                ...i,
                status: i.status || i.lifecycleState
            }));
        }
    });

    // Categorize invoices
    const readyForPayment = useMemo(() => invoices.filter(i => i.status === 'NOT_DUPLICATE'), [invoices]);
    const confirmedDuplicate = useMemo(() => invoices.filter(i => i.status === 'CONFIRMED_DUPLICATE' || i.status === 'RECOVERY_RESOLVED'), [invoices]);

    // Apply filters
    const filteredList = useMemo(() => {
        let list = category === 'ready_for_payment' ? readyForPayment
            : category === 'confirmed_duplicate' ? confirmedDuplicate
                : [...readyForPayment, ...confirmedDuplicate];

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.invoiceNumber.toLowerCase().includes(q) ||
                (i.vendorName || '').toLowerCase().includes(q) ||
                (i.vendorCode || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [category, readyForPayment, confirmedDuplicate, search]);

    // Select
    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredList.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredList.map(i => i.id)));
    };

    // Export API call
    const generatePaymentLoad = async (formatType: 'excel' | 'xml' | 'json') => {
        const idsArray = Array.from(selectedIds);
        if (idsArray.length === 0) return toast.error("Select invoices to export");

        setIsExporting(formatType);
        const toastId = toast.loading(`Generating ${formatType.toUpperCase()} payment load...`);

        try {
            const res = await fetch('/api/export/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceIds: idsArray, format: formatType })
            });

            if (!res.ok) throw new Error("Export failed");

            // Handle file download
            if (formatType === 'excel') {
                const { data, filename } = await res.json();
                const byteCharacters = atob(data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                downloadBlob(blob, filename);
            } else {
                const blob = await res.blob();
                const filename = res.headers.get('content-disposition')?.split('filename="')[1]?.split('"')[0] || `Payment_Load_${formatType}`;
                downloadBlob(blob, filename);
            }

            toast.success("Payment load exported successfully ✓", { id: toastId });
            setPreviewOpen(false); // Close preview after successful export
            setSelectedIds(new Set());

        } catch (err: any) {
            toast.error(err.message || "Failed to generate export file", { id: toastId });
        } finally {
            setIsExporting(null);
        }
    };

    function downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const selectedInvoices = useMemo(() => filteredList.filter(i => selectedIds.has(i.id)), [filteredList, selectedIds]);

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Payment Release Preview Modal */}
            <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
                <SheetContent side="bottom" className="h-[95vh] rounded-t-3xl p-0 flex flex-col bg-slate-50">
                    <SheetHeader className="px-8 py-6 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200">
                                    <FileSpreadsheet className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <SheetTitle className="text-2xl font-black text-slate-900 tracking-tight">Payment Load Preview</SheetTitle>
                                    <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Review {selectedInvoices.length} invoices before generating the final ERP export file
                                    </SheetDescription>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-widest text-xs uppercase shadow-xl shadow-slate-200">
                                            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                                            Release for Payment
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-xl">
                                        <DropdownMenuItem onClick={() => generatePaymentLoad('excel')} className="py-3 px-4 font-bold text-xs text-slate-700 cursor-pointer rounded-lg hover:bg-slate-50 focus:bg-slate-50">
                                            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Excel Spreadsheet (.xlsx)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generatePaymentLoad('xml')} className="py-3 px-4 font-bold text-xs text-slate-700 cursor-pointer rounded-lg hover:bg-slate-50 focus:bg-slate-50">
                                            <FileCode2 className="h-4 w-4 mr-2 text-indigo-600" /> ERP Structured XML (.xml)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generatePaymentLoad('json')} className="py-3 px-4 font-bold text-xs text-slate-700 cursor-pointer rounded-lg hover:bg-slate-50 focus:bg-slate-50">
                                            <FileJson className="h-4 w-4 mr-2 text-amber-600" /> Developer JSON Payload (.json)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </SheetHeader>

                    {/* Excel-style grid */}
                    <div className="flex-grow p-8 overflow-auto">
                        <div className="bg-white border text-sm border-slate-300 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-[#f8f9fa] border-b border-slate-300 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">ERP Source</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Company Code</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Vendor Code</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Vendor Name</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Invoice Number</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Invoice Date</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-right border-r border-slate-200">Gross Amount</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">Currency</th>
                                        <th className="font-bold text-[10px] uppercase text-slate-500 tracking-wider py-2.5 px-4 text-left border-r border-slate-200">PO Number</th>
                                        <th className="font-bold text-[10px] uppercase text-emerald-600 tracking-wider py-2.5 px-4 text-left">DPPS Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoices.map((inv, idx) => (
                                        <tr key={inv.id} className={cn(
                                            "border-b border-slate-100 hover:bg-emerald-50/30 transition-colors",
                                            idx % 2 === 0 ? "bg-white" : "bg-[#fcfdff]"
                                        )}>
                                            <td className="px-4 py-2 border-r border-slate-100 text-slate-600 font-medium whitespace-nowrap">
                                                {inv.erpType?.toUpperCase() === 'GENERIC' ? 'N/A' : inv.erpType}
                                            </td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-700 whitespace-nowrap">{inv.companyCode}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-700 whitespace-nowrap">{inv.vendorCode}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-900 font-bold whitespace-nowrap truncate max-w-[200px]" title={inv.vendorName}>{inv.vendorName}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-indigo-700 font-bold whitespace-nowrap">{inv.invoiceNumber}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-600 whitespace-nowrap">{inv.invoiceDate ? format(new Date(inv.invoiceDate), 'MM/dd/yyyy') : ''}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-900 font-mono font-bold text-right whitespace-nowrap">{formatCurrency(Number(inv.grossAmount))}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-500 whitespace-nowrap">{inv.currency}</td>
                                            <td className="px-4 py-2 border-r border-slate-100/50 text-slate-500 whitespace-nowrap">{inv.poNumber || '-'}</td>
                                            <td className="px-4 py-2 bg-emerald-50/50 text-emerald-700 font-bold text-[10px] tracking-widest uppercase whitespace-nowrap">NOT DUPLICATE</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* HEADER */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1700px] mx-auto px-8 h-24 flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                            <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Resolution Center</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cleared payments & blocked duplicates</p>
                        </div>
                    </div>
                    <div className="flex-grow max-w-2xl relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Quick search cleared or blocked invoices..."
                            className="pl-10 h-10 border-slate-200 rounded-xl bg-slate-50/50 text-sm focus:bg-white transition-all outline-none ring-0 focus-visible:ring-0 shadow-none focus:border-indigo-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div>
                        {selectedIds.size > 0 && category === 'ready_for_payment' ? (
                            <Button
                                onClick={() => setPreviewOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 h-11 text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200 animate-in slide-in-from-right duration-300"
                            >
                                <Eye className="h-4 w-4 mr-2" /> Preview Release Batch ({selectedIds.size})
                            </Button>
                        ) : (
                            <div className="h-11 border border-slate-200 rounded-xl bg-slate-50 px-4 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Select items to release
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-[1700px] mx-auto px-8 pt-8 space-y-6">

                {/* View Tabs */}
                <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl w-fit">
                    <button
                        onClick={() => { setCategory('ready_for_payment'); setSelectedIds(new Set()); }}
                        className={cn(
                            "px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            category === 'ready_for_payment' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        ✓ (not duplicate: ready for payment) ({readyForPayment.length})
                    </button>
                    <button
                        onClick={() => { setCategory('confirmed_duplicate'); setSelectedIds(new Set()); }}
                        className={cn(
                            "px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            category === 'confirmed_duplicate' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        ✕ Confirmed Duplicates ({confirmedDuplicate.length})
                    </button>
                </div>

                {/* TABLE */}
                <Card className="shadow-2xl border-slate-200/60 rounded-3xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50/80 border-b">
                            <TableRow className="hover:bg-transparent">
                                {category === 'ready_for_payment' && (
                                    <TableHead className="w-[60px] pl-8">
                                        <Checkbox
                                            checked={selectedIds.size === filteredList.length && filteredList.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                )}
                                <TableHead className={cn("py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest", category !== 'ready_for_payment' && "pl-8")}>Invoice Data</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vendor & ERP</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="h-20 animate-pulse bg-slate-50/50 border-b" /></TableRow>)
                            ) : filteredList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 grayscale opacity-40">
                                            {category === 'ready_for_payment' ? <CheckCircle2 className="h-12 w-12 text-slate-400" /> : <AlertTriangle className="h-12 w-12 text-slate-400" />}
                                            <p className="font-black text-xl tracking-tight text-slate-600">No records found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredList.map((item: any) => (
                                <TableRow key={item.id} className={cn("group transition-colors border-b border-slate-100", selectedIds.has(item.id) ? "bg-emerald-50/40" : "hover:bg-slate-50/50")}>
                                    {category === 'ready_for_payment' && (
                                        <TableCell className="pl-8">
                                            <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                                        </TableCell>
                                    )}
                                    <TableCell className={cn("py-5", category !== 'ready_for_payment' && "pl-8")}>
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-black text-slate-900 text-base">{item.invoiceNumber}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] font-bold">
                                                    <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> {item.invoiceDate ? format(new Date(item.invoiceDate), 'MMM dd, yyyy') : '-'}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="font-black text-slate-700 font-mono">{formatCurrency(Number(item.grossAmount))}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm">{item.vendorName || `Vendor ${item.vendorCode}`}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Code: {item.vendorCode}</span>
                                                {item.erpType && item.erpType.toUpperCase() !== 'GENERIC' && (
                                                    <Badge variant="outline" className="text-[9px] font-black text-slate-400 border-slate-200">
                                                        {item.erpType}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Badge className={cn("font-black text-[10px] px-3 py-1 uppercase tracking-widest rounded-lg shadow-sm border-0",
                                            item.status === 'NOT_DUPLICATE' ? "bg-emerald-100 text-emerald-800" :
                                                item.status === 'CONFIRMED_DUPLICATE' ? "bg-rose-100 text-rose-800" :
                                                    "bg-slate-100 text-slate-800"
                                        )}>
                                            {item.status === 'NOT_DUPLICATE' ? 'NOT DUPLICATE' : item.status}
                                        </Badge>
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
