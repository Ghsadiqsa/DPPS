"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, DownloadCloud, Database } from "lucide-react";
import { ERPType, EntityType } from "@/lib/erp-templates";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export default function HistoricalLoadPage() {
    const [erpType, setErpType] = useState<ERPType>("SAP");
    const [entityType, setEntityType] = useState<EntityType>("Vendors");
    const [file, setFile] = useState<File | null>(null);
    const [isSimulation, setIsSimulation] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [downloadFormat, setDownloadFormat] = useState("csv");

    // Data Preview States
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [activeTab, setActiveTab] = useState("upload");

    const [stagedRecords, setStagedRecords] = useState<any[]>([]);
    const [isFetchingStaged, setIsFetchingStaged] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // Batch History States
    const [batches, setBatches] = useState<any[]>([]);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [isDeletingBatches, setIsDeletingBatches] = useState(false);

    const fetchStagedRecords = async (batchId: string) => {
        setIsFetchingStaged(true);
        try {
            const res = await fetch(`/api/upload/preview?batchId=${batchId}`);
            if (res.ok) {
                const data = await res.json();
                setStagedRecords(data.records || []);
            }
        } catch (error) {
            console.error("Failed to fetch staged records", error);
        } finally {
            setIsFetchingStaged(false);
        }
    };

    const fetchBatches = async () => {
        setIsLoadingBatches(true);
        try {
            const res = await fetch("/api/upload/batches");
            if (res.ok) {
                const data = await res.json();
                setBatches(data);
            }
        } catch (error) {
            console.error("Failed to fetch batches", error);
            toast.error("Failed to load batch history");
        } finally {
            setIsLoadingBatches(false);
        }
    };

    const handleDeleteBatches = async () => {
        if (selectedBatchIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedBatchIds.length} batch records?`)) return;

        setIsDeletingBatches(true);
        console.log("Initiating deletion for batches:", selectedBatchIds);
        try {
            const res = await fetch("/api/upload/batches", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedBatchIds }),
            });

            if (res.ok) {
                const data = await res.json();
                console.log("Delete response:", data);
                toast.success(`Successfully deleted ${selectedBatchIds.length} batches`);
                setSelectedBatchIds([]);
                await fetchBatches();
            } else {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                console.error("Delete failed:", errorData);
                toast.error(`Deletion failed: ${errorData.error || res.statusText}`);
            }
        } catch (error) {
            console.error("Error deleting batches", error);
            toast.error("An error occurred during deletion. See console for details.");
        } finally {
            setIsDeletingBatches(false);
        }
    };

    const fetchPreviewData = async (type: string) => {
        setIsLoadingPreview(true);
        try {
            const res = await fetch(`/api/data/preview?type=${type}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            }
        } catch (error) {
            console.error("Failed to fetch preview data", error);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const exportToExcel = (data: any[], fileName: string) => {
        if (!data || data.length === 0) {
            toast.error("No data available to export");
            return;
        }

        try {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            XLSX.writeFile(workbook, `${fileName}.xlsx`);
            toast.success("Excel file exported successfully");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export Excel file");
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === "vendors" || value === "customers" || value === "financial-documents") {
            fetchPreviewData(value);
        } else if (value === "history") {
            fetchBatches();
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (uploadResult?.success && uploadResult?.batchId && !uploadResult?.completed) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/upload/status/${uploadResult.batchId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setUploadResult((prev: any) => {
                            // Only update if there is a change to avoid unnecessary re-renders
                            if (prev.status === data.status && prev.completed === data.completed) return prev;

                            if (data.completed) {
                                if (data.status === 'pending_review') {
                                    toast.success("Batch Parsed Successfully", {
                                        description: `Processed ${data.totalRows} rows. Awaiting your review before saving.`
                                    });
                                    fetchStagedRecords(data.id);
                                } else if (data.success) {
                                    toast.success("Batch Processing Complete", {
                                        description: `Processed ${data.totalRows} rows successfully.`
                                    });
                                } else {
                                    toast.error("Batch Processing Failed", {
                                        description: `Batch finished with ${data.errorRows} failed rows.`
                                    });
                                }
                            }

                            return {
                                ...prev,
                                status: data.status,
                                completed: data.completed,
                                errorRows: data.errorRows,
                                message: data.completed ? (data.status === 'pending_review' ? "Awaiting Review to Save." : (data.success ? "Upload completely processed!" : "Upload processed with errors.")) : prev.message
                            };
                        });
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 2000); // Poll every 2 seconds
        }
        return () => clearInterval(interval);
    }, [uploadResult?.success, uploadResult?.batchId, uploadResult?.completed]);

    const handleDownloadTemplate = () => {
        window.open(`/api/upload/template?erp=${erpType}&entityType=${entityType}&format=${downloadFormat}`, '_blank');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setUploadResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setUploadResult(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("erp", erpType);
        formData.append("entityType", entityType);
        formData.append("isSimulation", isSimulation.toString());

        try {
            const res = await fetch("/api/upload/process", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                setUploadResult({ success: true, ...data });
                setFile(null); // Reset after successful upload
            } else {
                setUploadResult({ success: false, ...data });
            }
        } catch (error) {
            setUploadResult({ success: false, error: "An unexpected error occurred during upload." });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCommit = async () => {
        if (!uploadResult?.batchId) return;
        setIsCommitting(true);
        try {
            const res = await fetch("/api/upload/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId: uploadResult.batchId })
            });

            if (res.ok) {
                toast.success("Records saved to the database successfully!");
                setUploadResult((prev: any) => ({ ...prev, status: "completed", message: "Successfully saved to database! Duplicates (if any) were skipped." }));
                setStagedRecords([]);
            } else {
                const data = await res.json();
                toast.error("Commit Failed", { description: data.error || "Failed to commit records." });
            }
        } catch (error) {
            toast.error("Error committing records.");
        } finally {
            setIsCommitting(false);
        }
    };

    const handleCancel = async () => {
        if (!uploadResult?.batchId) return;
        setIsCancelling(true);
        try {
            const res = await fetch(`/api/upload/commit?batchId=${uploadResult.batchId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                toast.success("Upload Cancelled", { description: "The staged data has been deleted." });
                setUploadResult(null);
                setStagedRecords([]);
                setFile(null);
            } else {
                toast.error("Cancellation Failed");
            }
        } catch (error) {
            toast.error("Error cancelling upload.");
        } finally {
            setIsCancelling(false);
        }
    };

    // Derived Headers for Excel View
    const previewHeaders = stagedRecords.length > 0 && stagedRecords[0]?.rowData ? Object.keys(stagedRecords[0].rowData) : [];

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Historical Data Load</h2>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="upload" className="flex items-center gap-2">
                            <UploadCloud className="h-4 w-4" /> Load Data
                        </TabsTrigger>
                        <TabsTrigger value="vendors" className="flex items-center gap-2">
                            <Database className="h-4 w-4" /> Vendor Catalog
                        </TabsTrigger>
                        <TabsTrigger value="customers" className="flex items-center gap-2">
                            <Database className="h-4 w-4" /> Customer Catalog
                        </TabsTrigger>
                        <TabsTrigger value="financial-documents" className="flex items-center gap-2">
                            <Database className="h-4 w-4" /> Financial Documents
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <DownloadCloud className="h-4 w-4" /> Batch History
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="upload" className="mt-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="col-span-2">
                            <CardHeader>
                                <CardTitle>Batch Upload Configuration</CardTitle>
                                <CardDescription>
                                    Select your ERP system and the type of data to upload. Download the strict CSV template before uploading data.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>ERP System</Label>
                                        <Select value={erpType} onValueChange={(v: ERPType) => setErpType(v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select ERP" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SAP">SAP</SelectItem>
                                                <SelectItem value="Dynamics">Microsoft Dynamics</SelectItem>
                                                <SelectItem value="Oracle">Oracle</SelectItem>
                                                <SelectItem value="Sage">Sage</SelectItem>
                                                <SelectItem value="Other">Other / Custom</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Data Entity</Label>
                                        <Select value={entityType} onValueChange={(v: EntityType) => setEntityType(v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Data Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Vendors">Vendors</SelectItem>
                                                <SelectItem value="Customers">Customers</SelectItem>
                                                <SelectItem value="Financial Documents">Financial Documents</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 border rounded-lg p-4 bg-muted/10">
                                    <Checkbox
                                        id="simulation-mode"
                                        checked={isSimulation}
                                        onCheckedChange={(checked) => setIsSimulation(checked as boolean)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <label
                                            htmlFor="simulation-mode"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Enable Simulation Mode
                                        </label>
                                        <p className="text-sm text-muted-foreground">
                                            Validates the structural integrity of the file against the schema without actively saving data to the database.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/20">
                                    <div>
                                        <h4 className="font-semibold">Step 1: Download Template</h4>
                                        <p className="text-sm text-muted-foreground">Download the exact format required for {erpType} {entityType}.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue placeholder="Format" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="csv">CSV (.csv)</SelectItem>
                                                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" onClick={handleDownloadTemplate}>
                                            <DownloadCloud className="mr-2 h-4 w-4" />
                                            Download
                                        </Button>
                                    </div>
                                </div>

                                <div className="border border-dashed rounded-lg p-8 hover:bg-muted/10 transition-colors text-center relative">
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isUploading}
                                    />

                                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                                        <UploadCloud className="h-10 w-10 text-muted-foreground" />
                                        <h4 className="font-semibold">Step 2: Upload Populated Template</h4>
                                        <p className="text-sm text-muted-foreground max-w-sm">
                                            {file ? (
                                                <span className="text-primary font-medium">{file.name}</span>
                                            ) : (
                                                "Drag and drop your generated CSV file here, or click to browse."
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    className="w-full"
                                    disabled={!file || isUploading}
                                    onClick={handleUpload}
                                >
                                    {isUploading ? "Processing..." : "Submit File"}
                                </Button>

                                {/* Results UI */}
                                {uploadResult && (
                                    <div className={`mt-6 p-4 rounded-lg border ${uploadResult.success ? (uploadResult.completed && uploadResult.status !== 'error' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900') : 'bg-red-50 border-red-200 text-red-900'}`}>
                                        <div className="flex items-center gap-2 font-semibold text-lg mb-2">
                                            {uploadResult.success ? (
                                                uploadResult.completed ? (
                                                    uploadResult.status === 'pending_review'
                                                        ? <Database className="h-5 w-5 text-amber-600" />
                                                        : <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                                ) : <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                            ) : <AlertCircle className="h-5 w-5 text-red-600" />}

                                            {uploadResult.success ? (uploadResult.completed ? (uploadResult.status === 'pending_review' ? 'Data Staged for Review' : 'Upload Processing Finished') : 'Processing Upload in Background') : 'Upload Failed'}
                                        </div>
                                        <p className="mb-4">{uploadResult.message || uploadResult.error}</p>

                                        {uploadResult.success && uploadResult.batchId !== undefined && (
                                            <div className="bg-white p-4 rounded shadow-sm border border-indigo-100 flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-500">Batch ID</div>
                                                    <div className="font-mono text-sm font-bold text-slate-700">{uploadResult.batchId}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-slate-500">Total Rows Enqueued</div>
                                                    <div className="text-xl font-bold text-indigo-600">{uploadResult.totalRows}</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Validation Errors Table (Only on pre-upload failure) */}
                                        {uploadResult.validationErrors && uploadResult.validationErrors.length > 0 && (
                                            <div className="mt-4">
                                                <h4 className="font-semibold mb-2">Validation Errors ({uploadResult.validationErrors.length} rows)</h4>
                                                <div className="max-h-60 overflow-y-auto bg-white rounded border">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-muted">
                                                            <tr>
                                                                <th className="px-4 py-2">Row</th>
                                                                <th className="px-4 py-2">Errors</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {uploadResult.validationErrors.map((err: any, idx: number) => (
                                                                <tr key={idx} className="border-t">
                                                                    <td className="px-4 py-2 font-medium">{err.row}</td>
                                                                    <td className="px-4 py-2 text-red-600">
                                                                        <ul className="list-disc pl-4">
                                                                            {err.errors.map((e: string, i: number) => (
                                                                                <li key={i}>{e}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Preview Staging Data */}
                                {uploadResult?.status === 'pending_review' && (
                                    <div className="mt-8 border rounded-lg p-6 bg-amber-50/50">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                                                    <Database className="h-5 w-5" />
                                                    Preview Parsed Data
                                                </h3>
                                                <p className="text-amber-700 text-sm mt-1">Review the {stagedRecords.length} parsed records before permanently saving them to the database.</p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                                                <Button
                                                    variant="outline"
                                                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                                                    onClick={handleCancel}
                                                    disabled={isCancelling || isCommitting}
                                                >
                                                    {isCancelling ? "Cancelling..." : "Cancel Upload"}
                                                </Button>
                                                <Button
                                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                                    onClick={handleCommit}
                                                    disabled={isCommitting || isFetchingStaged || isCancelling}
                                                >
                                                    {isCommitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                    {isCommitting ? "Saving..." : "Save to Database"}
                                                </Button>
                                            </div>
                                        </div>

                                        {isFetchingStaged ? (
                                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-md border border-amber-300 bg-white shadow-sm max-h-[600px] overflow-y-auto">
                                                <Table className="relative w-full">
                                                    <TableHeader className="bg-amber-100/80 sticky top-0 z-10 shadow-sm shadow-amber-200/50 backdrop-blur-sm">
                                                        <TableRow className="hover:bg-amber-100/90 border-amber-200">
                                                            <TableHead className="text-amber-900 font-bold whitespace-nowrap bg-amber-200/50 sticky left-0 z-20 shadow-[1px_0_0_0_#fbd38d]"># / Type</TableHead>
                                                            {previewHeaders.map((header, i) => (
                                                                <TableHead key={i} className="text-amber-900 font-bold whitespace-nowrap border-l border-amber-200/50">
                                                                    {header}
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {stagedRecords.length > 0 ? stagedRecords.map((r, i) => (
                                                            <TableRow key={r.id || i} className="hover:bg-amber-50/50 border-amber-100 transition-colors">
                                                                <TableCell className="font-medium whitespace-nowrap bg-white/90 sticky left-0 z-10 shadow-[1px_0_0_0_#fef3c7] text-xs">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-muted-foreground text-[10px] leading-none">Row {i + 1}</span>
                                                                    </div>
                                                                </TableCell>
                                                                {previewHeaders.map((header, idx) => (
                                                                    <TableCell key={idx} className="font-mono text-xs text-slate-700 py-3 border-l border-amber-100 whitespace-nowrap max-w-[300px] truncate" title={String(r.rowData[header] || '')}>
                                                                        {String(r.rowData[header] || '')}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        )) : (
                                                            <TableRow><TableCell colSpan={previewHeaders.length + 1} className="text-center py-6 text-muted-foreground">No valid records to preview.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="vendors" className="mt-0">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle>Recent Vendors (Top 50)</CardTitle>
                                <CardDescription>A preview of the most recently uploaded vendors.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportToExcel(previewData, "Recent_Vendors")}
                                disabled={previewData.length === 0}
                                className="flex items-center gap-2"
                            >
                                <DownloadCloud className="h-4 w-4" />
                                Export to Excel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingPreview ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>Vendor Name</TableHead>
                                                <TableHead>Vendor Code</TableHead>
                                                <TableHead>Tax ID</TableHead>
                                                <TableHead>Company Code</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.length > 0 ? previewData.map((v, i) => (
                                                <TableRow key={v.id || i}>
                                                    <TableCell className="font-medium">{v.name}</TableCell>
                                                    <TableCell className="font-mono text-xs">{v.vendorCode || '-'}</TableCell>
                                                    <TableCell>{v.taxId}</TableCell>
                                                    <TableCell>{v.companyCode || '-'}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No vendors found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="customers" className="mt-0">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle>Recent Customers (Top 50)</CardTitle>
                                <CardDescription>A preview of the most recently uploaded customers.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportToExcel(previewData, "Recent_Customers")}
                                disabled={previewData.length === 0}
                                className="flex items-center gap-2"
                            >
                                <DownloadCloud className="h-4 w-4" />
                                Export to Excel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingPreview ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>Customer Number</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Tax ID</TableHead>
                                                <TableHead>Company Code</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.length > 0 ? previewData.map((c, i) => (
                                                <TableRow key={c.id || i}>
                                                    <TableCell className="font-medium">{c.customerNumber}</TableCell>
                                                    <TableCell>{c.name}</TableCell>
                                                    <TableCell>{c.taxId}</TableCell>
                                                    <TableCell>{c.companyCode || '-'}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No customers found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="financial-documents" className="mt-0">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle>Recent Financial Documents (Top 50)</CardTitle>
                                <CardDescription>A preview of the most recently uploaded historical invoices and documents.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportToExcel(previewData, "Recent_Financial_Documents")}
                                disabled={previewData.length === 0}
                                className="flex items-center gap-2"
                            >
                                <DownloadCloud className="h-4 w-4" />
                                Export to Excel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingPreview ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>Document No.</TableHead>
                                                <TableHead>Reference/Invoice No.</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.length > 0 ? previewData.map((d, i) => (
                                                <TableRow key={d.id || i}>
                                                    <TableCell className="font-medium">{d.documentNumber}</TableCell>
                                                    <TableCell>{d.invoiceNumber}</TableCell>
                                                    <TableCell>{new Date(d.invoiceDate).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: d.currency || 'USD' }).format(Number(d.amount))}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No financial documents found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle>Batch Upload History</CardTitle>
                                <CardDescription>A complete log of all historical data load batches and their statuses.</CardDescription>
                            </div>
                            {selectedBatchIds.length > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteBatches}
                                    disabled={isDeletingBatches}
                                    className="flex items-center gap-2"
                                >
                                    {isDeletingBatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                                    Delete Selected ({selectedBatchIds.length})
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exportToExcel(batches, "Batch_History")}
                                disabled={batches.length === 0}
                                className="flex items-center gap-2"
                            >
                                <DownloadCloud className="h-4 w-4" />
                                Export to Excel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingBatches ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead className="w-[50px]">
                                                    <Checkbox
                                                        checked={selectedBatchIds.length === batches.length && batches.length > 0}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedBatchIds(batches.map(b => b.id));
                                                            } else {
                                                                setSelectedBatchIds([]);
                                                            }
                                                        }}
                                                    />
                                                </TableHead>
                                                <TableHead>Batch ID</TableHead>
                                                <TableHead>ERP Type</TableHead>
                                                <TableHead>Entity Type</TableHead>
                                                <TableHead className="text-right">Total Rows</TableHead>
                                                <TableHead className="text-right">Error Rows</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {batches.length > 0 ? batches.map((b, i) => (
                                                <TableRow key={b.id || i}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedBatchIds.includes(b.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedBatchIds(prev => [...prev, b.id]);
                                                                } else {
                                                                    setSelectedBatchIds(prev => prev.filter(id => id !== b.id));
                                                                }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{b.id.substring(0, 8)}...</TableCell>
                                                    <TableCell>{b.erpType}</TableCell>
                                                    <TableCell>{b.entityType}</TableCell>
                                                    <TableCell className="text-right">{b.totalRows}</TableCell>
                                                    <TableCell className="text-right text-red-600">{b.errorRows}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${b.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            b.status === 'error' ? 'bg-red-100 text-red-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {b.status.replace('_', ' ')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">{new Date(b.createdAt).toLocaleString()}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No batch history found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
