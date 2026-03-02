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
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, DownloadCloud, Database } from "lucide-react";
import { ERPType, EntityType } from "@/lib/erp-templates";
import { toast } from "sonner";

export default function HistoricalLoadPage() {
    const [erpType, setErpType] = useState<ERPType>("SAP");
    const [entityType, setEntityType] = useState<EntityType>("Vendors");
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [downloadFormat, setDownloadFormat] = useState("csv");

    // Data Preview States
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [activeTab, setActiveTab] = useState("upload");

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

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === "vendors" || value === "customers" || value === "financial-documents") {
            fetchPreviewData(value);
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
                                if (data.success) {
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
                                message: data.completed ? (data.success ? "Upload completely processed!" : "Upload processed with errors.") : prev.message
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
                                                uploadResult.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                            ) : <AlertCircle className="h-5 w-5" />}

                                            {uploadResult.success ? (uploadResult.completed ? 'Upload Processing Finished' : 'Processing Upload in Background') : 'Upload Failed'}
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
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="vendors" className="mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Vendors (Top 50)</CardTitle>
                            <CardDescription>A preview of the most recently uploaded vendors.</CardDescription>
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
                                                <TableHead>Tax ID</TableHead>
                                                <TableHead>Company Code</TableHead>
                                                <TableHead>Risk Level</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.length > 0 ? previewData.map((v, i) => (
                                                <TableRow key={v.id || i}>
                                                    <TableCell className="font-medium">{v.name}</TableCell>
                                                    <TableCell>{v.taxId}</TableCell>
                                                    <TableCell>{v.companyCode || '-'}</TableCell>
                                                    <TableCell>{v.riskLevel}</TableCell>
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
                        <CardHeader>
                            <CardTitle>Recent Customers (Top 50)</CardTitle>
                            <CardDescription>A preview of the most recently uploaded customers.</CardDescription>
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
                        <CardHeader>
                            <CardTitle>Recent Financial Documents (Top 50)</CardTitle>
                            <CardDescription>A preview of the most recently uploaded historical invoices and documents.</CardDescription>
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
            </Tabs>
        </div>
    );
}
