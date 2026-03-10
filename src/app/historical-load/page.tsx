'use client';

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    UploadCloud,
    Download,
    History,
    Users,
    UserCircle,
    FileText,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Eye,
    DatabaseZap,
    RefreshCw,
    Trash2,
    Terminal,
    Lightbulb
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format as dateFormat } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { useConfig } from "@/components/providers/ConfigProvider";
import { cn } from "@/lib/utils";

type UploadStep = 'configure' | 'processing' | 'preview' | 'committed';

export default function HistoricalLoad() {
    const { reportingCurrency, showSideBySideAmounts } = useConfig();
    const queryClient = useQueryClient();
    const [erpSystem, setErpSystem] = useState("SAP");
    const [dataEntity, setDataEntity] = useState("Vendors");
    const [simulationMode, setSimulationMode] = useState(false);
    const [templateFormat, setTemplateFormat] = useState("CSV (.csv)");
    const [file, setFile] = useState<File | null>(null);
    const [activeTab, setActiveTab] = useState("upload");

    // Upload flow state
    const [step, setStep] = useState<UploadStep>('configure');
    const [batchId, setBatchId] = useState<string | null>(null);
    const [batchStatus, setBatchStatus] = useState<string | null>(null);
    const [previewRows, setPreviewRows] = useState<any[]>([]);
    const [previewColumns, setPreviewColumns] = useState<string[]>([]);
    const [apiError, setApiError] = useState<{ message: string, solution: string } | null>(null);

    // Batch history selection
    const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());

    // ────────────────────────────────────────────────────────
    // Catalog Queries
    // ────────────────────────────────────────────────────────
    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: async () => {
            const res = await fetch('/api/vendors');
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data ?? []);
        },
        enabled: activeTab === 'vendors'
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const res = await fetch('/api/customers');
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data ?? []);
        },
        enabled: activeTab === 'customers'
    });

    const { data: financialResponse } = useQuery({
        queryKey: ['invoices', 'historical'],
        queryFn: async () => {
            const res = await fetch('/api/invoices?lifecycleState=PAID&limit=200');
            if (!res.ok) return { data: [] };
            return res.json();
        },
        enabled: activeTab === 'financials'
    });
    const financialDocs = financialResponse?.data || [];
    const financialMetadata = financialResponse?.metadata || { reportingCurrency: 'USD', showSideBySideAmounts: false };

    const { data: batches = [], refetch: refetchBatches } = useQuery({
        queryKey: ['upload-batches'],
        queryFn: async () => {
            const res = await fetch('/api/upload/batches');
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : [];
        },
        enabled: activeTab === 'history',
        refetchInterval: activeTab === 'history' ? 5000 : false
    });

    const deleteBatchesMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await fetch('/api/upload/batches', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete batches');
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`${data.deletedCount} batch${data.deletedCount !== 1 ? 'es' : ''} deleted`);
            setSelectedBatches(new Set());
            queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
        },
        onError: (err: any) => {
            toast.error('Delete failed', { description: err.message });
        }
    });

    const toggleSelectBatch = (id: string) => {
        setSelectedBatches(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedBatches.size === batches.length) {
            setSelectedBatches(new Set());
        } else {
            setSelectedBatches(new Set(batches.map((b: any) => b.id)));
        }
    };

    // ────────────────────────────────────────────────────────
    // Upload flow
    // ────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!file) { toast.error("Please select a file first"); return; }

        setStep('processing');
        setBatchStatus('Uploading and validating...');
        setApiError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("erp", erpSystem);
            formData.append("entityType", dataEntity);
            formData.append("isSimulation", String(simulationMode));

            const res = await fetch("/api/upload/process", { method: "POST", body: formData });
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Upload failed");
            }

            const newBatchId = result.batchId;
            setBatchId(newBatchId);

            if (simulationMode) {
                toast.success("Simulation Complete", { description: "File structure is valid. No records were saved." });
                setStep('configure');
                return;
            }

            // Load preview from staging
            setBatchStatus('Loading preview...');
            const prevRes = await fetch(`/api/upload/preview?batchId=${newBatchId}`);
            if (!prevRes.ok) throw new Error("Failed to load preview");
            const { records } = await prevRes.json();

            if (!records || records.length === 0) {
                toast.warning("No valid records found to preview. Check your file format.");
                setStep('configure');
                return;
            }

            // Extract columns from first row
            const firstRow = records[0]?.rowData ?? {};
            setPreviewColumns(Object.keys(firstRow).filter(k => firstRow[k] !== undefined && firstRow[k] !== ""));
            setPreviewRows(records.map((r: any) => r.rowData));
            setStep('preview');
            toast.success(`${records.length} records ready for review`);

            toast.success(`${records.length} records ready for review`);

        } catch (err: any) {
            const msg = err.message || "Unknown error";
            let solution = "Please try again or contact support.";

            if (msg.includes("no data rows")) solution = "Ensure your file contains data starting from row 3 (after the header and conceptual mapping rows), and the file is not empty.";
            else if (msg.includes("Missing required fields")) solution = "Make sure an ERP system and Data Entity are selected before uploading the file.";
            else if (msg.includes("Invalid JSON format")) solution = "The JSON file uploaded is malformed. Ensure it is a valid array of objects.";
            else if (msg.includes("Failed to fetch")) solution = "Network connection failed. Verify your internet connection or backend server status.";
            else if (msg.includes("stage records") || msg.includes("staging")) solution = "Database staging failed. Ensure the column headers exactly match the template requirements.";
            else if (msg.includes("properties") || msg.includes("undefined")) solution = "Frontend rendering failed while trying to process the file structure. Ensure your file has valid column headers.";

            setApiError({ message: msg, solution });
            setStep('configure');
            toast.error("Upload Failed", { description: "Review the diagnostics panel for more information." });
        }
    };

    // ────────────────────────────────────────────────────────
    // Commit
    // ────────────────────────────────────────────────────────
    const commitMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/upload/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Commit failed");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success("Data Committed", { description: data.message });
            setStep('committed');
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
        },
        onError: (err: any) => {
            toast.error("Commit Failed", { description: err.message });
        }
    });

    const resetFlow = () => {
        setStep('configure');
        setFile(null);
        setBatchId(null);
        setBatchStatus(null);
        setApiError(null);
        setPreviewRows([]);
        setPreviewColumns([]);
    };

    // ────────────────────────────────────────────────────────
    // Template Download
    // ────────────────────────────────────────────────────────
    const handleDownloadTemplate = async () => {
        try {
            const fmt = templateFormat.split(' ')[0].toLowerCase();
            const res = await fetch(`/api/upload/template?erp=${erpSystem}&entityType=${dataEntity}&format=${fmt}`);
            if (!res.ok) throw new Error("Server error");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${erpSystem}_${dataEntity.replace(/\s+/g, '_')}_Template.${fmt}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Template Downloaded");
        } catch {
            toast.error("Template Download Failed");
        }
    };

    const statusColor = (s: string) => {
        if (s === 'completed') return 'bg-emerald-100 text-emerald-800';
        if (s === 'pending_review') return 'bg-amber-100 text-amber-800';
        if (s === 'processing') return 'bg-blue-100 text-blue-800';
        if (s?.includes('error') || s === 'failed') return 'bg-red-100 text-red-800';
        return 'bg-slate-100 text-slate-700';
    };

    return (
        <div className="container mx-auto py-10 px-6 max-w-7xl space-y-8">
            <h1 className="text-3xl font-bold text-slate-900">Historical Data Load</h1>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-100 p-1 rounded-xl h-12 flex items-center w-fit border border-slate-200">
                    <TabsTrigger value="upload" className="rounded-lg px-6 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <UploadCloud className="w-4 h-4 mr-2" /> Load Data
                    </TabsTrigger>
                    <TabsTrigger value="vendors" className="rounded-lg px-6 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="w-4 h-4 mr-2" /> Vendor Catalog
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="rounded-lg px-6 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <UserCircle className="w-4 h-4 mr-2" /> Customer Catalog
                    </TabsTrigger>
                    <TabsTrigger value="financials" className="rounded-lg px-6 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <FileText className="w-4 h-4 mr-2" /> Financial Documents
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg px-6 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <History className="w-4 h-4 mr-2" /> Batch History
                    </TabsTrigger>
                </TabsList>

                {/* ── LOAD DATA TAB ── */}
                <TabsContent value="upload">
                    {step === 'configure' && (
                        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b p-8">
                                <CardTitle>Batch Upload Configuration</CardTitle>
                                <CardDescription>
                                    Select your ERP system and the type of data to upload. Download a sample format, or upload your existing data directly (dynamic fuzzy column mapping is enabled).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label>ERP System</Label>
                                        <Select value={erpSystem} onValueChange={setErpSystem}>
                                            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SAP">SAP</SelectItem>
                                                <SelectItem value="Oracle">Oracle</SelectItem>
                                                <SelectItem value="Dynamics">MS Dynamics</SelectItem>
                                                <SelectItem value="Sage">Sage</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Data Entity</Label>
                                        <Select value={dataEntity} onValueChange={setDataEntity}>
                                            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Vendors">Vendors</SelectItem>
                                                <SelectItem value="Customers">Customers</SelectItem>
                                                <SelectItem value="Financial Documents">Financial Documents</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Card className="bg-slate-50/50 border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-start space-x-4">
                                        <Checkbox id="simulation" checked={simulationMode} onCheckedChange={(c) => setSimulationMode(!!c)} className="mt-1" />
                                        <div>
                                            <Label htmlFor="simulation" className="font-bold">Enable Simulation Mode</Label>
                                            <p className="text-sm text-slate-500 mt-1">Validates the structural integrity of the file against the schema without actively saving data to the database.</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold">Step 1: Download Sample Template</h3>
                                            <p className="text-sm text-slate-500 mt-1">Download a flexible, suggested format for {erpSystem} {dataEntity} (all columns are dynamically mapped).</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Select value={templateFormat} onValueChange={setTemplateFormat}>
                                                <SelectTrigger className="w-[160px] h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CSV (.csv)">CSV (.csv)</SelectItem>
                                                    <SelectItem value="Excel (.xlsx)">Excel (.xlsx)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" onClick={handleDownloadTemplate} className="h-11 rounded-xl px-6 font-semibold border-2">
                                                <Download className="w-4 h-4 mr-2" /> Download
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <div
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                                        <UploadCloud className="w-8 h-8 text-slate-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">Step 2: Upload Data File</h3>
                                        <p className="text-slate-500">Drag and drop your data file here. The engine will auto-detect and map your columns.</p>
                                        {file && <p className="text-indigo-600 font-bold mt-2">✓ {file.name}</p>}
                                    </div>
                                    <input type="file" id="file-upload" className="hidden" accept=".csv,.xlsx,.xls,.xml,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                </div>

                                {apiError && (
                                    <div className="rounded-[24px] border-rose-200/50 shadow-2xl shadow-rose-900/5 bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-rose-50/50 border-b border-rose-100/60 p-5 flex flex-col gap-2">
                                            <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2">
                                                <Terminal className="h-4 w-4" /> Diagnostic API Error
                                            </span>
                                            <p className="font-mono text-sm text-rose-900 font-bold bg-white p-4 rounded-xl border border-rose-100 shadow-sm break-all">
                                                {apiError.message}
                                            </p>
                                        </div>
                                        <div className="p-5">
                                            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4 relative overflow-hidden shadow-sm">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2 bg-emerald-100 rounded-lg shrink-0 mt-0.5">
                                                        <Lightbulb className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-1.5">Automated Solution</h3>
                                                        <p className="text-emerald-950 font-medium text-xs leading-relaxed">
                                                            {apiError.solution}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleSubmit}
                                    disabled={!file}
                                    className="w-full h-14 rounded-xl text-base font-bold bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-40 transition-all shadow-xl shadow-slate-200"
                                >
                                    Submit File
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {step === 'processing' && (
                        <Card className="border-slate-200 rounded-2xl p-16 flex flex-col items-center gap-6">
                            <Loader2 className="w-14 h-14 text-indigo-500 animate-spin" />
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-slate-900">Processing Batch</h3>
                                <p className="text-slate-500 mt-1">{batchStatus}</p>
                                <p className="text-xs text-slate-400 mt-2 font-mono">{batchId}</p>
                            </div>
                        </Card>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Preview — {previewRows.length} Records</h2>
                                    <p className="text-slate-500 text-sm mt-1">Review the data below before committing to the database.</p>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={resetFlow} className="h-11 rounded-xl px-6 font-semibold">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => commitMutation.mutate()}
                                        disabled={commitMutation.isPending}
                                        className="h-11 rounded-xl px-8 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        {commitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DatabaseZap className="w-4 h-4 mr-2" />}
                                        Commit to Database
                                    </Button>
                                </div>
                            </div>

                            <Card className="border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead className="w-10 text-center">#</TableHead>
                                                {previewColumns.map(col => (
                                                    <TableHead key={col} className="whitespace-nowrap font-bold text-slate-700">{col}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewRows.map((row, i) => (
                                                <TableRow key={i} className="hover:bg-slate-50">
                                                    <TableCell className="text-center text-slate-400 text-xs font-mono">{i + 1}</TableCell>
                                                    {previewColumns.map(col => (
                                                        <TableCell key={col} className="max-w-[200px] truncate text-sm">
                                                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span className="text-slate-300">—</span>}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {step === 'committed' && (
                        <Card className="border-emerald-200 bg-emerald-50 rounded-2xl p-16 flex flex-col items-center gap-6">
                            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-emerald-900">Data Committed Successfully</h3>
                                <p className="text-emerald-700 mt-2">{previewRows.length} records have been saved to the database.</p>
                            </div>
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={resetFlow} className="h-11 rounded-xl px-8">
                                    Load Another File
                                </Button>
                                <Button onClick={() => setActiveTab('history')} className="h-11 rounded-xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                                    <History className="w-4 h-4 mr-2" /> View Batch History
                                </Button>
                            </div>
                        </Card>
                    )}
                </TabsContent>

                {/* ── VENDOR CATALOG ── */}
                <TabsContent value="vendors">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/80">
                                <TableRow>
                                    <TableHead>Vendor Code</TableHead>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead>Company Code</TableHead>
                                    <TableHead>Tax ID</TableHead>
                                    <TableHead>ERP</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendors.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-slate-400 italic">No vendor records. Use the Load Data tab to ingest.</TableCell></TableRow>
                                ) : vendors.map((v: any) => (
                                    <TableRow key={v.id}>
                                        <TableCell className="font-mono">{v.vendorCode}</TableCell>
                                        <TableCell className="font-semibold">{v.name}</TableCell>
                                        <TableCell>{v.companyCode}</TableCell>
                                        <TableCell>{v.taxId}</TableCell>
                                        <TableCell><span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{v.erpType}</span></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* ── CUSTOMER CATALOG ── */}
                <TabsContent value="customers">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/80">
                                <TableRow>
                                    <TableHead>Customer #</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Tax ID</TableHead>
                                    <TableHead>Email</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-slate-400 italic">No customer records found.</TableCell></TableRow>
                                ) : customers.map((c: any) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-mono">{c.customerNumber}</TableCell>
                                        <TableCell className="font-semibold">{c.name}</TableCell>
                                        <TableCell>{c.taxId}</TableCell>
                                        <TableCell>{c.email}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* ── FINANCIAL DOCUMENTS ── */}
                <TabsContent value="financials">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/80">
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Invoice Date</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {financialDocs.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 italic">No historical financial documents found.</TableCell></TableRow>
                                ) : financialDocs.map((f: any) => (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-bold whitespace-nowrap">{f.invoiceNumber}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold">
                                                    {formatCurrency(Number(financialMetadata.showSideBySideAmounts ? f.amountInReportingCurrency : f.grossAmount), financialMetadata.reportingCurrency || f.currency || 'USD')}
                                                </span>
                                                {financialMetadata.showSideBySideAmounts && (
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                                                        Local: {formatCurrency(Number(f.grossAmount), f.currency || 'USD')}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{f.currency}</TableCell>
                                        <TableCell>{f.invoiceDate ? dateFormat(new Date(f.invoiceDate), 'MMM dd, yyyy') : '—'}</TableCell>
                                        <TableCell className="font-mono text-xs">{f.vendorCode}</TableCell>
                                        <TableCell><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">PAID</span></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* ── BATCH HISTORY ── */}
                <TabsContent value="history">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-slate-800">Upload Batches</h3>
                                {selectedBatches.size > 0 && (
                                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                        {selectedBatches.size} selected
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedBatches.size > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => deleteBatchesMutation.mutate(Array.from(selectedBatches))}
                                        disabled={deleteBatchesMutation.isPending}
                                        className="h-9 px-4 rounded-xl font-semibold"
                                    >
                                        {deleteBatchesMutation.isPending
                                            ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                            : <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        }
                                        Delete {selectedBatches.size === 1 ? 'Batch' : `${selectedBatches.size} Batches`}
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => refetchBatches()} className="h-9 px-4 rounded-xl">
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
                                </Button>
                            </div>
                        </div>
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="w-10 pl-4">
                                        <Checkbox
                                            checked={batches.length > 0 && selectedBatches.size === batches.length}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                            className="border-slate-300"
                                        />
                                    </TableHead>
                                    <TableHead className="w-[240px]">Batch ID</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>ERP</TableHead>
                                    <TableHead>Total Rows</TableHead>
                                    <TableHead>Errors</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Loaded At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batches.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center text-slate-400 italic">
                                            No batch history found.
                                        </TableCell>
                                    </TableRow>
                                ) : batches.map((b: any) => (
                                    <TableRow
                                        key={b.id}
                                        className={cn(
                                            "hover:bg-slate-50 cursor-pointer",
                                            selectedBatches.has(b.id) && "bg-indigo-50/60 hover:bg-indigo-50"
                                        )}
                                        onClick={() => toggleSelectBatch(b.id)}
                                    >
                                        <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedBatches.has(b.id)}
                                                onCheckedChange={() => toggleSelectBatch(b.id)}
                                                aria-label={`Select batch ${b.id}`}
                                                className="border-slate-300"
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-400">{b.id}</TableCell>
                                        <TableCell className="font-semibold">{b.entityType}</TableCell>
                                        <TableCell>
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{b.erpType}</span>
                                        </TableCell>
                                        <TableCell className="font-bold">{b.totalRows ?? '—'}</TableCell>
                                        <TableCell className={cn("font-bold", (b.errorRows ?? 0) > 0 ? "text-red-600" : "text-emerald-600")}>
                                            {b.errorRows ?? 0}
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn("px-2 py-1 rounded-md text-[10px] font-black tracking-tight uppercase", statusColor(b.status))}>
                                                {b.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-sm">
                                            {b.createdAt ? dateFormat(new Date(b.createdAt), 'MMM dd, yyyy HH:mm') : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
