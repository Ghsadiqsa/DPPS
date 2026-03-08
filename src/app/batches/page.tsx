'use client';

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ListOrdered,
    TableProperties,
    Download,
    CalendarDays,
    FileBox,
    ChevronRight,
    ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function PaymentBatchesPage() {
    const [batches, setBatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/batches?includeItems=true');
            if (res.ok) {
                const data = await res.json();
                setBatches(data);
            }
        } catch (error) {
            console.error("Failed to load batches:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                <ListOrdered className="h-5 w-5" />
                            </div>
                            Payment Batch History
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">Historical audit ledger of all generated and released payment exports.</p>
                    </div>
                    <Button variant="outline" className="font-bold border-slate-200 shadow-sm block" onClick={fetchBatches}>
                        Refresh Ledger
                    </Button>
                </div>

                {/* Batches List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-24 text-slate-400 font-bold animate-pulse">Loading Audit Ledger...</div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-16 bg-white border border-slate-200 border-dashed rounded-2xl">
                            <FileBox className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-black text-slate-900">No Payment Batches Found</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">Release approved proposals from the Payment Gate to automatically generate batched export ledgers here.</p>
                        </div>
                    ) : (
                        batches.map((batch) => (
                            <Card key={batch.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200/60">
                                <div
                                    className="bg-white p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/50">
                                            <Download className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-black text-slate-900 text-lg">Batch #{batch.id.substring(0, 8).toUpperCase()}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
                                                    {batch.exportFormat} FORMAT
                                                </Badge>
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] uppercase font-bold border-none">
                                                    {batch.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                                                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(batch.createdAt), "MMM dd, yyyy • HH:mm")}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{batch.totalCount} Proposals Attached</span>
                                                <span className="text-slate-300">•</span>
                                                <span>Generated by {batch.createdBy?.name || 'Administrator'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Payload Value</p>
                                            <p className="text-xl font-black text-emerald-700">{formatCurrency(batch.totalAmount)}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 rounded-full hover:bg-slate-200">
                                            {expandedBatchId === batch.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded Grid View */}
                                <AnimatePresence>
                                    {expandedBatchId === batch.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-slate-100 bg-slate-50/80"
                                        >
                                            <div className="p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                        <TableProperties className="h-4 w-4 text-slate-400" />
                                                        Batch Items Ledger
                                                    </h4>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                    <table className="w-full text-left border-collapse text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200 shadow-sm text-slate-500">
                                                                <th className="p-3 font-bold uppercase tracking-widest text-[10px]">#</th>
                                                                <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Reference ID</th>
                                                                <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Vendor Code</th>
                                                                <th className="p-3 font-bold uppercase tracking-widest text-[10px] text-right">Amount</th>
                                                                <th className="p-3 font-bold uppercase tracking-widest text-[10px]">Currency</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {batch.items?.map((row: any, idx: number) => (
                                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                                    <td className="p-3 text-slate-400 font-medium tabular-nums text-xs">{idx + 1}</td>
                                                                    <td className="p-3 text-slate-900 font-bold">{row.invoiceNumber || row.invoiceId}</td>
                                                                    <td className="p-3 text-slate-600 font-medium">{row.vendorCode}</td>
                                                                    <td className="p-3 text-emerald-700 font-bold tabular-nums text-right text-sm">{formatCurrency(row.amount)}</td>
                                                                    <td className="p-3 text-slate-500 font-bold text-xs">{row.currency}</td>
                                                                </tr>
                                                            ))}
                                                            {(!batch.items || batch.items.length === 0) && (
                                                                <tr>
                                                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No inner line items captured.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
