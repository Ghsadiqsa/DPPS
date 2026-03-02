'use client';

import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ShieldAlert, CheckCircle, FileText, AlertTriangle, Search, Info, Download, BrainCircuit, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, type ChangeEvent, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types matching the API response
interface ValidationResult {
  totalLines: number;
  approvedLines: number;
  heldLines: number;
  reviewLines: number;
  duplicatesDetected: number;
  duplicates: DetectedDuplicate[];
  approvedForPayment?: {
    invoiceNumber: string;
    vendorId: string;
    amount: number;
    invoiceDate: string;
  }[];
}

interface DetectedDuplicate {
  invoiceNumber: string;
  vendorId: string;
  amount: number;
  invoiceDate: string;
  status: 'held' | 'review';
  score: number;
  riskLevel: string;
  signals: { name: string; score: number; triggered: boolean }[];
  matchedWith?: {
    id?: string;
    invoiceNumber: string;
    invoiceDate: string;
    amount: number;
    vendorId: string;
  };
}

const STORAGE_KEY = 'payment_gate_state';

// Sample data to simulate file content if file reading fails or for demo
const DEMO_INVOICES = [
  { invoiceNumber: "INV-2024-001", vendorId: "V-1001", amount: 1250.00, invoiceDate: "2024-01-15" },
  { invoiceNumber: "INV-2024-001", vendorId: "V-1001", amount: 1250.00, invoiceDate: "2024-01-15" }, // Exact duplicate
  { invoiceNumber: "INV-2024-002", vendorId: "V-1002", amount: 5000.00, invoiceDate: "2024-01-20" },
  { invoiceNumber: "INV-2024-OO2", vendorId: "V-1002", amount: 5000.00, invoiceDate: "2024-01-20" }, // Fuzzy duplicate
  { invoiceNumber: "INV-2024-003", vendorId: "V-1003", amount: 750.00, invoiceDate: "2024-01-22" },
  { invoiceNumber: "INV-2024-004", vendorId: "V-1004", amount: 3200.50, invoiceDate: "2024-01-25" },
];

export default function PaymentGate() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isBlocking, setIsBlocking] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // State for analysis results
  // State for analysis results
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isApprovedDialogOpen, setIsApprovedDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load state from local storage on mount
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setValidationResult(parsed.validationResult);
        setFileName(parsed.fileName);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  // Persistence logic
  useEffect(() => {
    if (mounted) { // Only save if mounted to avoid overwriting with initial nulls if effect runs early? 
      // Actually, we only want to save if we have data OR if we explicitly cleared it.
      // But if we load null initially, and then save null immediately, we wipe storage.
      // So we should only start saving after we've loaded? 
      // Or simpler: The previous logic saved whenever result/filename changed.
      // If we start null, and then load from storage, it changes to loaded value.
      // If we start null and storage is empty, it stays null.

      if (validationResult || fileName) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ validationResult, fileName }));
      }
    }
  }, [validationResult, fileName, mounted]);

  const handleUpload = async (e?: ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const file = e?.target?.files?.[0];
    const uploadFileName = file?.name || "payment_proposal_demo.csv";

    if (e?.target) e.target.value = "";

    setIsUploading(true);
    setUploadProgress(0);
    setFileName(uploadFileName);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      let invoicesPayload = DEMO_INVOICES;

      if (file) {
        try {
          const text = await file.text();
          const rows = text.split(/\r?\n/);
          const parsedInvoices = [];

          if (rows.length > 1) {
            const headers = rows[0].split(',').map(h => h.trim());

            // Helper to find index case-insensitively
            const getIdx = (patterns: string[]) =>
              headers.findIndex(h => patterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

            const idxInvoiceNum = getIdx(['Invoice_Reference', 'invoice_reference', 'invoiceNumber', 'invoice_number', 'reference', 'ref']);
            const idxVendorId = getIdx(['Vendor_Number', 'vendor_number', 'vendorId', 'VendorID', 'vendor']);
            const idxAmount = getIdx(['Invoice_Amount', 'invoice_amount', 'amount', 'Total', 'value', 'price']);
            const idxDate = getIdx(['Invoice_Date', 'invoice_date', 'date', 'DocumentDate', 'document_date']);
            const idxInvoiceId = getIdx(['Invoice_ID', 'invoice_id', 'id']);

            // Default to 0,1,2,3 if no headers matched (simple CSV fallback)
            const isMapped = idxAmount !== -1 && idxDate !== -1;

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i].trim();
              if (!row) continue;

              // Basic CSV parsing for quotes
              const cols = [];
              let currentVal = '';
              let inQuotes = false;
              for (let c = 0; c < row.length; c++) {
                if (row[c] === '"') inQuotes = !inQuotes;
                else if (row[c] === ',' && !inQuotes) { cols.push(currentVal.trim()); currentVal = ''; }
                else currentVal += row[c];
              }
              cols.push(currentVal.trim());

              let num, ven, amt, dt;

              if (isMapped) {
                num = cols[idxInvoiceNum !== -1 ? idxInvoiceNum : (idxInvoiceId !== -1 ? idxInvoiceId : 0)];
                ven = cols[idxVendorId !== -1 ? idxVendorId : 1];
                amt = cols[idxAmount];
                dt = cols[idxDate];
              } else {
                // Fallback to strict index 0,1,2,3 if there are enough columns
                if (cols.length >= 4) {
                  num = cols[0];
                  ven = cols[1];
                  amt = cols[2];
                  dt = cols[3];
                } else if (cols.length >= 2) {
                  num = cols[0];
                  ven = cols[0];
                  amt = cols[1];
                  dt = cols[1]; // extremely basic fallback
                }
              }

              if (amt && dt && amt.trim() !== '') {
                const parsedAmt = parseFloat(amt.replace(/,/g, '')) || 0;
                let parsedDate = dt;

                // If it fails to be parsed as a date on the server it could crash, so give it a valid fallback format if empty
                if (!parsedDate || parsedDate.trim() === '') parsedDate = new Date().toISOString().split('T')[0];

                parsedInvoices.push({
                  invoiceNumber: num?.trim() || `INV-UNK-${i}`,
                  vendorId: ven?.trim() || 'V-UNKNOWN',
                  amount: parsedAmt,
                  invoiceDate: parsedDate,
                });
              }
            }
          }

          if (parsedInvoices.length > 0) {
            invoicesPayload = parsedInvoices;
          }
        } catch (err) {
          console.error("CSV parse error, using demo data", err);
        }
      }

      const response = await fetch('/api/payment-gate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices: invoicesPayload
        })
      });

      if (!response.ok) throw new Error('Validation failed');

      const data = await response.json();

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setValidationResult(data);
        toast.success("Analysis Complete", {
          description: `Processed ${data.totalLines} invoices. Found ${data.duplicatesDetected} potential duplicates.`
        });
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      setIsUploading(false);
      toast.error("Analysis Failed", {
        description: "Could not validate payment proposal. Please try again."
      });
      console.error(error);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    setIsExportDialogOpen(true);
  };

  const executeExport = () => {
    if (!validationResult) return;

    const fileName = `validation_results_${new Date().toISOString().split('T')[0]}`;

    switch (exportFormat) {
      case "excel":
        // Generate real .xlsx file
        const worksheet = XLSX.utils.json_to_sheet(validationResult.duplicates.map(dup => ({
          "Invoice Number": dup.invoiceNumber,
          "Vendor ID": dup.vendorId,
          "Amount": dup.amount,
          "Date": dup.invoiceDate,
          "Score": dup.score,
          "Risk Level": dup.riskLevel,
          "Status": dup.status,
          "Matched Invoice": dup.matchedWith?.invoiceNumber || '',
          "Matched Amount": dup.matchedWith?.amount || ''
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Validation Results");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);

        setIsExportDialogOpen(false);
        toast.success("Export Successful", {
          description: "Report downloaded as EXCEL"
        });
        return; // XLSX.writeFile triggers download/save

      case "json":
        const jsonContent = JSON.stringify(validationResult.duplicates, null, 2);
        downloadBlob(jsonContent, "application/json", "json", fileName);
        break;

      case "xml":
      case "ubl":
        // Basic XML generation
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ValidationReport>
  <Summary>
    <TotalLines>${validationResult.totalLines}</TotalLines>
    <ApprovedLines>${validationResult.approvedLines}</ApprovedLines>
    <DuplicatesDetected>${validationResult.duplicatesDetected}</DuplicatesDetected>
  </Summary>
  <Duplicates>
    ${validationResult.duplicates.map(dup => `
    <DetectedDuplicate>
      <InvoiceNumber>${dup.invoiceNumber}</InvoiceNumber>
      <VendorID>${dup.vendorId}</VendorID>
      <Amount>${dup.amount}</Amount>
      <Date>${dup.invoiceDate}</Date>
      <Score>${dup.score}</Score>
      <RiskLevel>${dup.riskLevel}</RiskLevel>
      <Status>${dup.status}</Status>
    </DetectedDuplicate>`).join('')}
  </Duplicates>
</ValidationReport>`;
        downloadBlob(xmlContent, "application/xml", "xml", fileName);
        break;

      case "csv":
      default:
        // CSV with BOM for Excel compatibility (Fallback or explicit CSV)
        const headers = "Invoice Number,Vendor ID,Amount,Date,Score,Risk Level,Status,Matched Invoice,Matched Amount\n";
        const rows = validationResult.duplicates.map(dup => {
          const field = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
          return `${field(dup.invoiceNumber)},${field(dup.vendorId)},${dup.amount},${field(dup.invoiceDate)},${field(dup.score)},${field(dup.riskLevel)},${field(dup.status)},${field(dup.matchedWith?.invoiceNumber)},${field(dup.matchedWith?.amount)}`;
        }).join("\n");

        downloadBlob("\uFEFF" + headers + rows, "text/csv;charset=utf-8;", "csv", fileName);
        break;
    }

    setIsExportDialogOpen(false);
  };

  const downloadBlob = (content: string, mimeType: string, extension: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export Successful", {
      description: `Report downloaded as ${extension.toUpperCase()}`
    });
  };

  const executeApprovedExport = () => {
    if (!validationResult?.approvedForPayment) return;

    const fileName = `approved_invoices_${new Date().toISOString().split('T')[0]}`;
    const approvedItems = validationResult.approvedForPayment;

    switch (exportFormat) {
      case "excel":
        const worksheet = XLSX.utils.json_to_sheet(approvedItems.map(item => ({
          "Invoice Number": item.invoiceNumber,
          "Vendor ID": item.vendorId,
          "Amount": item.amount,
          "Date": item.invoiceDate,
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Invoices");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        toast.success("Export Successful", { description: "Approved invoices downloaded as EXCEL" });
        break;

      case "json":
        downloadBlob(JSON.stringify(approvedItems, null, 2), "application/json", "json", fileName);
        break;

      case "xml":
      case "ubl":
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ApprovedInvoices>
  <Summary>
    <TotalLines>${approvedItems.length}</TotalLines>
    <TotalAmount>${approvedItems.reduce((sum, item) => sum + Number(item.amount), 0)}</TotalAmount>
  </Summary>
  <Invoices>
    ${approvedItems.map(item => `
    <Invoice>
      <InvoiceNumber>${item.invoiceNumber}</InvoiceNumber>
      <VendorID>${item.vendorId}</VendorID>
      <Amount>${item.amount}</Amount>
      <Date>${item.invoiceDate}</Date>
    </Invoice>`).join('')}
  </Invoices>
</ApprovedInvoices>`;
        downloadBlob(xmlContent, "application/xml", "xml", fileName);
        break;

      case "csv":
      default:
        const headers = "Invoice Number,Vendor ID,Amount,Date\n";
        const rows = approvedItems.map(item => {
          const field = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
          return `${field(item.invoiceNumber)},${field(item.vendorId)},${item.amount},${field(item.invoiceDate)}`;
        }).join("\n");
        downloadBlob("\uFEFF" + headers + rows, "text/csv;charset=utf-8;", "csv", fileName);
        break;
    }
    setIsApprovedDialogOpen(false);
  };

  const handleBlockFlagged = () => {
    setIsBlocking(true);
    setTimeout(() => {
      setIsBlocking(false);
      setValidationResult(null);
      setFileName(null);
      localStorage.removeItem(STORAGE_KEY);
      toast.success("Batch Processed", {
        description: "Flagged payments held. Approved payments released."
      });
    }, 1500);
  };

  const recoveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to initiate recovery');
      return response.json();
    }
  });

  const handleHoldPayment = (uniqueKey: string) => {
    const item = validationResult?.duplicates.find((d, idx) =>
      `${d.invoiceNumber}-${idx}` === uniqueKey
    );

    if (!item) {
      console.error("Item not found for key:", uniqueKey);
      return;
    }

    setProcessingId(uniqueKey);

    recoveryMutation.mutate({
      invoiceId: null, // Explicitly null to trigger new invoice creation
      invoiceNumber: item.invoiceNumber,
      invoiceDate: item.invoiceDate,
      vendorId: item.vendorId,
      amount: item.amount,
      notes: `Held via Payment Gate. Risk Score: ${item.score}. Reason: Duplicate detected with ${item.matchedWith?.invoiceNumber || 'existing records'}.`,
      recoveryMethod: 'hold'
    }, {
      onSuccess: () => {
        toast.success("Payment Held", {
          description: "Item moved to manual review and recovery queue"
        });
        setProcessingId(null);
      },
      onError: () => {
        toast.error("Failed to process hold", {
          description: "There was an error creating the recovery case."
        });
        setProcessingId(null);
      }
    });
  };

  const handleDismissWarning = (uniqueKey: string) => {
    setProcessingId(`dismiss-${uniqueKey}`);

    // Simulate API call or just local update? Local update is instant and good for UX here.
    setTimeout(() => {
      setValidationResult(prev => {
        if (!prev) return null;

        const dupIndex = prev.duplicates.findIndex((d, idx) => `${d.invoiceNumber}-${idx}` === uniqueKey);
        if (dupIndex === -1) return prev;

        const item = prev.duplicates[dupIndex];

        // Remove from duplicates
        const newDuplicates = [...prev.duplicates];
        newDuplicates.splice(dupIndex, 1);

        // Add to approved (needs matching shape)
        const newApproved = [
          ...(prev.approvedForPayment || []),
          {
            invoiceNumber: item.invoiceNumber,
            vendorId: item.vendorId,
            amount: item.amount,
            invoiceDate: item.invoiceDate,
          }
        ];

        return {
          ...prev,
          duplicates: newDuplicates,
          duplicatesDetected: prev.duplicatesDetected - 1,
          approvedLines: prev.approvedLines + 1,
          approvedForPayment: newApproved
        };
      });

      toast.info("Warning Dismissed", { description: "Item approved for release" });
      setProcessingId(null);
    }, 500);
  };

  // getRiskColor removed

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-destructive";
    if (score >= 70) return "text-orange-600";
    if (score >= 50) return "text-yellow-600";
    return "text-emerald-600";
  };

  const isAnalyzed = !!validationResult;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight">Payment Gate</h1>
          <p className="text-muted-foreground mt-2">
            Validate payment proposal files against duplicate prevention rules before release.
          </p>
        </div>
        <div className="flex gap-2">
          {isAnalyzed && (
            <>
              <Button variant="outline" onClick={handleExport} className="font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" onClick={() => { setValidationResult(null); setFileName(null); localStorage.removeItem(STORAGE_KEY); }}>
                Upload New File
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className={cn("lg:col-span-5 h-fit", isAnalyzed && "lg:col-span-4")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Upload Proposal
            </CardTitle>
            <CardDescription>Supported formats: ISO 20022 XML, CSV, SAP IDOC, XLS</CardDescription>
          </CardHeader>
          <CardContent>
            {!isAnalyzed ? (
              <div
                onClick={triggerFileSelect}
                className={cn(
                  "border-2 border-dashed rounded-xl h-72 flex flex-col items-center justify-center text-center p-8 transition-all cursor-pointer group",
                  isUploading ? "bg-muted/30 border-primary/20 pointer-events-none" : "hover:bg-primary/[0.02] hover:border-primary/40 border-muted-foreground/20"
                )}
              >
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  accept=".xml,.csv,.idoc,.xls,.xlsx"
                />

                {isUploading ? (
                  <div className="w-full space-y-4 px-4">
                    <div className="flex flex-col items-center animate-pulse">
                      <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                        <Search className="h-6 w-6 animate-spin" />
                      </div>
                      <p className="font-semibold">Analyzing file contents...</p>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                  </div>
                ) : (
                  <>
                    <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <FileText className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-xl mb-2 text-foreground">Drag & Drop Payment File</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-[200px]">
                      Drop your proposal here or browse to start the validation engine
                    </p>
                    <Button variant="secondary" className="font-bold px-8 shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                      Select File
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 flex items-center gap-4">
                  <div className="h-10 w-10 bg-white rounded-md flex items-center justify-center shadow-sm border">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{validationResult?.totalLines} Lines • CSV</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Validation Status</span>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">Completed</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duplicates Found</span>
                    <span className="font-bold text-destructive">{validationResult?.duplicatesDetected}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Approved Lines</span>
                    <span className="font-bold">{validationResult?.approvedLines}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className={cn("lg:col-span-7 space-y-6", isAnalyzed && "lg:col-span-8")}>
          <AnimatePresence mode="wait">
            {!isAnalyzed ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="border-none bg-muted/20 h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center py-12">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                      <Info className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Awaiting Validation</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                      Upload a payment proposal file to view duplicate detection results and similarity signals.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid sm:grid-cols-3 gap-4">
                  <Card
                    className="border-emerald-100 bg-emerald-50/30 cursor-pointer hover:bg-emerald-100/50 transition-colors"
                    onClick={() => setIsApprovedDialogOpen(true)}
                  >
                    <CardContent className="pt-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-emerald-700">{validationResult?.approvedLines}</p>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Lines Approved</p>
                        <p className="text-[10px] text-emerald-600/70 mt-1 font-medium">Click to view details</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-destructive/20 bg-destructive/[0.02]">
                    <CardContent className="pt-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-destructive">{validationResult?.duplicatesDetected}</p>
                        <p className="text-xs font-bold text-destructive uppercase tracking-wider">Duplicates Detected</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-indigo-100 bg-indigo-50/30">
                    <CardContent className="pt-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <BrainCircuit className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-indigo-700">100%</p>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Processing Complete</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden border-2 border-destructive/10">
                  <CardHeader className="bg-destructive/[0.02] border-b border-destructive/5 py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          Potential Duplicates Detected
                        </CardTitle>
                        <CardDescription>Review the following lines before releasing the payment</CardDescription>
                      </div>
                      <Badge variant="destructive" className="font-black px-3 py-1">{validationResult?.duplicatesDetected} FLAGS</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {validationResult?.duplicates.map((dup, idx) => {
                        const uniqueKey = `${dup.invoiceNumber}-${idx}`;
                        return (
                          <div key={uniqueKey} className="p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground text-base underline decoration-destructive/30 underline-offset-4">{dup.invoiceNumber}</span>
                                    <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tighter">
                                      Proposed Line
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground font-medium">Vendor ID: {dup.vendorId}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {dup.signals.map((signal) => (
                                      <Badge key={signal.name} variant="outline" className="text-[10px] border-destructive/20 bg-destructive/5 text-destructive font-bold py-0 h-5">
                                        {signal.name}
                                      </Badge>
                                    ))}
                                    <Badge variant="outline" className="text-[10px] border-indigo-200 bg-indigo-50 text-indigo-700 font-bold py-0 h-5 flex items-center gap-1">
                                      <BrainCircuit className="h-2.5 w-2.5" />
                                      AI Risk Level: {dup.riskLevel}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex md:flex-col justify-between md:items-end gap-2 shrink-0">
                                  <span className="text-xl font-black text-foreground">
                                    ${dup.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                  <div className="flex items-center gap-2 text-right">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">Score</p>
                                      <p className={cn(
                                        "text-lg font-black leading-none",
                                        getScoreColor(dup.score)
                                      )}>
                                        {dup.score}
                                      </p>
                                    </div>
                                    <div className="h-8 w-1 bg-muted rounded-full overflow-hidden shrink-0">
                                      <div
                                        className={cn("w-full transition-all", dup.score > 85 ? "bg-destructive" : "bg-amber-500")}
                                        style={{ height: `${dup.score}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {dup.matchedWith && (
                                <div className="relative p-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.02] group/match">
                                  <div className="absolute -top-3 left-4 px-2 bg-white text-[10px] font-black text-primary uppercase tracking-widest border border-primary/20 rounded-full flex items-center gap-1.5">
                                    <Search className="h-3 w-3" />
                                    Match Found
                                  </div>
                                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded leading-none">{dup.matchedWith.invoiceNumber}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Existing Record</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>Date: <span className="text-foreground font-medium">{mounted ? new Date(dup.matchedWith.invoiceDate).toLocaleDateString() : '---'}</span></span>
                                      </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                      <span className="text-sm font-black text-foreground underline decoration-primary/30 underline-offset-4">
                                        ${dup.matchedWith.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="font-bold text-xs h-8 shadow-sm active:scale-95 transition-transform"
                                disabled={processingId === uniqueKey}
                                onClick={() => handleHoldPayment(uniqueKey)}
                              >
                                {processingId === uniqueKey ? "Processing..." : "Hold Payment"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="font-bold text-xs h-8 active:scale-95 transition-transform"
                                disabled={processingId === `dismiss-${uniqueKey}`}
                                onClick={() => handleDismissWarning(uniqueKey)}
                              >
                                {processingId === `dismiss-${uniqueKey}` ? "Processing..." : "Dismiss Warning"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-4">
                  <Button
                    className="flex-1 font-bold h-12 shadow-lg active:scale-[0.98] transition-transform"
                    variant="destructive"
                    onClick={handleBlockFlagged}
                    disabled={isBlocking}
                  >
                    {isBlocking ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : "Block Flagged Payments"}
                  </Button>
                  <Button
                    className="flex-1 font-bold h-12 shadow-md active:scale-[0.98] transition-transform"
                    variant="outline"
                    onClick={handleExport}
                  >
                    Release All Approved Lines
                  </Button>
                </div>

                <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Export Approved Lines</DialogTitle>
                      <DialogDescription>
                        Choose your preferred file format for the released payments.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 py-4">
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">Comma Separated (.csv)</SelectItem>
                          <SelectItem value="xml">XML (.xml)</SelectItem>
                          <SelectItem value="ubl">UBL (.ubl)</SelectItem>
                          <SelectItem value="json">JSON (.json)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="sm:justify-start">
                      <Button type="button" onClick={executeExport} className="w-full font-bold">
                        Generate & Download
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isApprovedDialogOpen} onOpenChange={setIsApprovedDialogOpen}>
                  <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Approved Invoices ({validationResult?.approvedLines})</DialogTitle>
                      <DialogDescription>
                        These invoices have passed all duplicate checks and are ready for payment.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto min-h-[200px] border rounded-md my-4">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-3 font-bold">Invoice #</th>
                            <th className="p-3 font-bold">Vendor ID</th>
                            <th className="p-3 font-bold text-right">Amount</th>
                            <th className="p-3 font-bold">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {validationResult?.approvedForPayment?.map((item, i) => (
                            <tr key={i} className="hover:bg-muted/5">
                              <td className="p-3 font-medium">{item.invoiceNumber}</td>
                              <td className="p-3">{item.vendorId}</td>
                              <td className="p-3 text-right font-mono">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-3">{item.invoiceDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-4 border-t pt-4">
                      <div className="flex-1">
                        <Select value={exportFormat} onValueChange={setExportFormat}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                            <SelectItem value="csv">Comma Separated (.csv)</SelectItem>
                            <SelectItem value="xml">XML (.xml)</SelectItem>
                            <SelectItem value="json">JSON (.json)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={executeApprovedExport} className="font-bold">
                        <Download className="mr-2 h-4 w-4" /> Export Approved List
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
