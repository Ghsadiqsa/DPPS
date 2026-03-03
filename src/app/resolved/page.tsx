'use client';

import * as XLSX from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Search, Download, CheckCircle2, XCircle, AlertTriangle, Calendar, Loader2, FileSpreadsheet
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ResolvedInvoice {
    id: string;
    invoiceNumber: string;
    vendorId: string;
    amount: string;
    invoiceDate: string;
    status: string;
    isDuplicate: boolean;
    similarityScore: number;
    signals: string[];
    investigationNotes?: string;
    statusUpdatedAt?: string;
    createdAt: string;
}

type CategoryFilter = 'all' | 'released' | 'not_duplicate' | 'confirmed_duplicate';

export default function DuplicateResolved() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<CategoryFilter>("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch all resolved invoices (CLEARED, UPLOADED with isDuplicate=false, BLOCKED, RECOVERY_REQUIRED)
    const { data: invoices = [], isLoading } = useQuery<ResolvedInvoice[]>({
        queryKey: ["resolved-invoices"],
        queryFn: async () => {
            const res = await fetch('/api/invoices?status=CLEARED&status=UPLOADED&status=BLOCKED&status=RECOVERY_REQUIRED&status=PAID_DUPLICATE');
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
        }
    });

    // Categorize invoices
    const categorized = useMemo(() => {
        const list = Array.isArray(invoices) ? invoices : [];
        const released = list.filter(i => i.status === 'CLEARED');
        const notDuplicate = list.filter(i => i.status === 'UPLOADED' && !i.isDuplicate);
        const confirmedDuplicate = list.filter(i =>
            i.status === 'BLOCKED' || i.status === 'RECOVERY_REQUIRED' || i.status === 'PAID_DUPLICATE'
        );
        return { released, notDuplicate, confirmedDuplicate };
    }, [invoices]);

    // Apply filters
    const filteredList = useMemo(() => {
        let list: ResolvedInvoice[] = [];

        switch (category) {
            case 'released': list = categorized.released; break;
            case 'not_duplicate': list = categorized.notDuplicate; break;
            case 'confirmed_duplicate': list = categorized.confirmedDuplicate; break;
            default: list = [...categorized.released, ...categorized.notDuplicate, ...categorized.confirmedDuplicate];
        }

        // Date filter
        if (dateFrom) {
            const from = new Date(dateFrom);
            list = list.filter(i => new Date(i.createdAt || i.invoiceDate) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59);
            list = list.filter(i => new Date(i.createdAt || i.invoiceDate) <= to);
        }

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.invoiceNumber.toLowerCase().includes(q) ||
                i.vendorId.toLowerCase().includes(q) ||
                i.amount.toString().includes(q)
            );
        }

        return list;
    }, [category, categorized, dateFrom, dateTo, search]);

    // Select
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredList.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredList.map(i => i.id)));
        }
    };

    // Export non-duplicates to Excel
    const handleExportBatch = () => {
        const exportList = category === 'not_duplicate'
            ? filteredList
            : categorized.notDuplicate.filter(i => {
                if (dateFrom && new Date(i.createdAt || i.invoiceDate) < new Date(dateFrom)) return false;
                if (dateTo) {
                    const to = new Date(dateTo); to.setHours(23, 59, 59);
                    if (new Date(i.createdAt || i.invoiceDate) > to) return false;
                }
                return true;
            });

        if (exportList.length === 0) {
            toast.error("No non-duplicate records to export.");
            return;
        }

        const rows = exportList.map(i => ({
            "Invoice Number": i.invoiceNumber,
            "Vendor ID": i.vendorId,
            "Amount": parseFloat(i.amount),
            "Invoice Date": i.invoiceDate ? new Date(i.invoiceDate).toLocaleDateString() : '',
            "Status": i.status,
            "Processed Date": i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Non-Duplicate Invoices");
        XLSX.writeFile(wb, `Non_Duplicate_Batch_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Exported ${rows.length} non-duplicate records to Excel.`);
    };

    // Export selected to Excel
    const handleExportSelected = () => {
        const exportList = filteredList.filter(i => selectedIds.has(i.id));
        if (exportList.length === 0) {
            toast.error("No records selected for export.");
            return;
        }

        const rows = exportList.map(i => ({
            "Invoice Number": i.invoiceNumber,
            "Vendor ID": i.vendorId,
            "Amount": parseFloat(i.amount),
            "Invoice Date": i.invoiceDate ? new Date(i.invoiceDate).toLocaleDateString() : '',
            "Status": i.status,
            "Is Duplicate": i.isDuplicate ? "Yes" : "No",
            "Similarity Score": i.similarityScore || 0,
            "Signals": i.signals?.join(', ') || '',
            "Notes": i.investigationNotes || '',
            "Processed Date": i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Selected Records");
        XLSX.writeFile(wb, `Resolved_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Exported ${rows.length} records to Excel.`);
    };

    const getStatusBadge = (inv: ResolvedInvoice) => {
        if (inv.status === 'CLEARED') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold">Released</Badge>;
        if (inv.status === 'UPLOADED' && !inv.isDuplicate) return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] font-bold">Not Duplicate</Badge>;
        if (inv.status === 'BLOCKED') return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] font-bold">Confirmed Duplicate</Badge>;
        if (inv.status === 'RECOVERY_REQUIRED' || inv.status === 'PAID_DUPLICATE') return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] font-bold">Recovery</Badge>;
        return <Badge variant="outline" className="text-[10px] font-bold">{inv.status}</Badge>;
    };

    const sumAmounts = (list: ResolvedInvoice[]): number => {
        return list.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    };

    const formatAmount = (v: string | number) => {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold font-heading text-foreground tracking-tight">Duplicate Resolved</h1>
                <p className="text-sm text-muted-foreground">
                    View all resolved invoices — released, confirmed not duplicate, and confirmed duplicates.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategory('released')}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Released for Payment</p>
                                <p className="text-2xl font-black text-emerald-500">{categorized.released.length} <span className="text-sm font-bold text-emerald-400">invoices</span></p>
                                <p className="text-sm font-black font-mono text-emerald-600 mt-1">{formatAmount(sumAmounts(categorized.released))}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategory('not_duplicate')}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Not Duplicate</p>
                                <p className="text-2xl font-black text-blue-500">{categorized.notDuplicate.length} <span className="text-sm font-bold text-blue-400">invoices</span></p>
                                <p className="text-sm font-black font-mono text-blue-600 mt-1">{formatAmount(sumAmounts(categorized.notDuplicate))}</p>
                            </div>
                            <XCircle className="h-8 w-8 text-blue-500/30" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategory('confirmed_duplicate')}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirmed Duplicates</p>
                                <p className="text-2xl font-black text-red-500">{categorized.confirmedDuplicate.length} <span className="text-sm font-bold text-red-400">invoices</span></p>
                                <p className="text-sm font-black font-mono text-red-600 mt-1">{formatAmount(sumAmounts(categorized.confirmedDuplicate))}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-500/30" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by invoice number, vendor ID, or amount..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 h-9 text-sm"
                            />
                        </div>

                        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                            <SelectTrigger className="w-[180px] h-9 text-xs font-bold">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="released">Released for Payment</SelectItem>
                                <SelectItem value="not_duplicate">Not Duplicate</SelectItem>
                                <SelectItem value="confirmed_duplicate">Confirmed Duplicates</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-9 w-[140px] text-xs"
                                placeholder="From"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-9 w-[140px] text-xs"
                                placeholder="To"
                            />
                        </div>

                        <Button variant="outline" size="sm" className="h-9 text-xs font-bold gap-1.5" onClick={handleExportBatch}>
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            Export Non-Duplicates
                        </Button>

                        {selectedIds.size > 0 && (
                            <Button variant="default" size="sm" className="h-9 text-xs font-bold gap-1.5" onClick={handleExportSelected}>
                                <Download className="h-3.5 w-3.5" />
                                Export Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold">
                            {category === 'all' ? 'All Resolved' :
                                category === 'released' ? 'Released for Payment' :
                                    category === 'not_duplicate' ? 'Not Duplicate' : 'Confirmed Duplicates'}
                            <span className="ml-2 text-muted-foreground font-normal">({filteredList.length} records)</span>
                        </CardTitle>
                        {category !== 'all' && (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCategory('all')}>
                                Show All
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">No resolved records found</p>
                            <p className="text-xs mt-1">Records will appear here after invoices are processed through the Payment Gate.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="w-[40px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === filteredList.length && filteredList.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-border"
                                            />
                                        </TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Invoice #</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Vendor</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Amount</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Invoice Date</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Status</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Score</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Signals</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-wider">Processed</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredList.map(inv => (
                                        <TableRow key={inv.id} className="hover:bg-muted/20">
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(inv.id)}
                                                    onChange={() => toggleSelect(inv.id)}
                                                    className="rounded border-border"
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs font-bold">{inv.invoiceNumber}</TableCell>
                                            <TableCell className="text-xs">{inv.vendorId}</TableCell>
                                            <TableCell className="text-xs text-right font-mono font-bold">{formatAmount(inv.amount)}</TableCell>
                                            <TableCell className="text-xs">
                                                {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(inv)}</TableCell>
                                            <TableCell className="text-center">
                                                {inv.similarityScore > 0 ? (
                                                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                                                        inv.similarityScore >= 85 ? "bg-red-500/10 text-red-500" :
                                                            inv.similarityScore >= 50 ? "bg-amber-500/10 text-amber-500" :
                                                                "bg-slate-500/10 text-slate-500"
                                                    )}>
                                                        {inv.similarityScore}%
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {inv.signals && inv.signals.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {inv.signals.map((s, i) => (
                                                            <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">{s}</Badge>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
