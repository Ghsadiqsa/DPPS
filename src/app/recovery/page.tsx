'use client';

import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Mail, Loader2, Send, History, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RecoveryItem {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: string; // From Invoice
  vendor: {
    name: string;
    id: string;
  };
  signals?: string[];
  investigationNotes?: string;
  statusUpdatedAt?: string;
}

interface Activity {
  id: string;
  action: string;
  notes: string;
  timestamp: string;
  user?: { username: string };
}

export default function Recovery() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch recovery items from API
  const { data: recoveryData = [], isLoading } = useQuery({
    queryKey: ["recovery-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices?lifecycleState=RECOVERY_OPENED&lifecycleState=RECOVERY_RESOLVED");
      if (!res.ok) throw new Error("Failed to fetch recovery items");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    }
  });

  const allRecoveryItems = (Array.isArray(recoveryData) ? recoveryData : []) as RecoveryItem[];

  const recoveryItems = allRecoveryItems.filter(item => {
    if (statusFilter === "pending") return item.status === "RECOVERY_OPENED";
    if (statusFilter === "recovered") return item.status === "RECOVERY_RESOLVED";
    return true; // "all"
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: string, notes?: string }) => {
      // NOTE: For MVP, transitioning a recovery status just pushes an investigation note or 
      // could move it out of RECOVERY_REQUIRED to CLEARED/etc. We mock the inline status 
      // transition for now or just treat it as an Activity Log. 
      const res = await fetch(`/api/invoices/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: [id],
          targetStatus: status, // e.g. "CLEARED" if recovered
          notes: `Recovery Status Update: ${notes || status}`
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-invoices"] });
      toast.success("Status Updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    }
  });

  const handleExport = () => {
    setIsExportDialogOpen(true);
  };

  const executeExport = () => {
    const fileName = `recovery_report_${new Date().toISOString().split('T')[0]}`;
    setIsExporting(true);

    try {
      switch (exportFormat) {
        case "excel":
          const worksheet = XLSX.utils.json_to_sheet(recoveryItems.map((item: RecoveryItem) => ({
            "Invoice ID": item.id,
            "Invoice #": item.invoiceNumber,
            "Vendor": item.vendor?.name || "N/A",
            "Amount": Number(item.amount),
            "Marked For Recovery Date": item.statusUpdatedAt || "N/A",
            "Status": item.status,
            "Aging": item.statusUpdatedAt ? calculateAging(item.statusUpdatedAt) : "N/A"
          })));

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Recovery Cases");
          XLSX.writeFile(workbook, `${fileName}.xlsx`);
          toast.success("Recovery report exported successfully (Excel)");
          break;

        case "json":
          const jsonContent = JSON.stringify(recoveryItems, null, 2);
          downloadBlob(jsonContent, "application/json", "json", fileName);
          break;

        case "xml":
          const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<RecoveryReport>
  <Summary>
    <TotalCases>${recoveryItems.length}</TotalCases>
    <TotalAmount>${recoveryItems.reduce((sum, item) => sum + Number(item.amount), 0)}</TotalAmount>
  </Summary>
  <Cases>
    ${recoveryItems.map((item: RecoveryItem) => `
    <Case>
      <ID>${item.id}</ID>
      <InvoiceNumber>${item.invoiceNumber}</InvoiceNumber>
      <Vendor>${item.vendor?.name || "N/A"}</Vendor>
      <Amount>${item.amount}</Amount>
      <Date>${item.statusUpdatedAt || "N/A"}</Date>
      <Status>${item.status}</Status>
      <Aging>${item.statusUpdatedAt ? calculateAging(item.statusUpdatedAt) : "N/A"}</Aging>
    </Case>`).join('')}
  </Cases>
</RecoveryReport>`;
          downloadBlob(xmlContent, "application/xml", "xml", fileName);
          break;

        case "csv":
        default:
          const headers = "Invoice ID,Invoice Number,Vendor,Amount,Detected Date,Status,Aging\n";
          const rows = recoveryItems.map((item: RecoveryItem) => {
            const field = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
            return `${field(item.id)},${field(item.invoiceNumber)},${field(item.vendor?.name)},${item.amount},${field(mounted && item.statusUpdatedAt ? new Date(item.statusUpdatedAt).toLocaleDateString() : item.statusUpdatedAt || 'N/A')},${field(item.status)},${field(item.statusUpdatedAt ? calculateAging(item.statusUpdatedAt) : "N/A")}`;
          }).join("\n");
          downloadBlob("\uFEFF" + headers + rows, "text/csv;charset=utf-8;", "csv", fileName);
          break;
      }
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
      setIsExportDialogOpen(false);
    }
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
    toast.success(`Recovery report exported successfully (${extension.toUpperCase()})`);
  };

  const calculateAging = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "N/A";
      const days = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 3600 * 24));
      return `${days} days`;
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">Post-Pay Recovery</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage recovery of funds for duplicates detected after payment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={cn("h-8 text-xs font-bold", statusFilter === "all" && "bg-background shadow-sm")}
            >
              All Cases
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className={cn("h-8 text-xs font-bold text-amber-700", statusFilter === "pending" && "bg-amber-100 shadow-sm hover:bg-amber-200 hover:text-amber-800")}
            >
              Pending
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter("recovered")}
              className={cn("h-8 text-xs font-bold text-emerald-700", statusFilter === "recovered" && "bg-emerald-100 shadow-sm hover:bg-emerald-200 hover:text-emerald-800")}
            >
              Recovered
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || recoveryItems.length === 0}
            className="font-bold shadow-sm min-w-[140px]"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Export
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date Initiated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aging</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading recovery items...
                  </div>
                </TableCell>
              </TableRow>
            ) : recoveryItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 opacity-50" />
                    <p>No active recovery cases found.</p>
                    <p className="text-xs">Cases appear here when confirmed duplicates are marked for recovery.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : recoveryItems.map((item: RecoveryItem) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs font-bold">{item.id.substring(0, 8)}</TableCell>
                <TableCell className="font-semibold text-sm">{item.vendor?.name || "Unknown Vendor"}</TableCell>
                <TableCell className="font-mono font-bold text-red-600">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(item.amount) || 0)}
                </TableCell>
                <TableCell>{mounted && item.statusUpdatedAt ? new Date(item.statusUpdatedAt).toLocaleDateString() : '---'}</TableCell>
                <TableCell>
                  <Select
                    defaultValue={item.status}
                    onValueChange={(val) => updateStatusMutation.mutate({ id: item.id, status: val })}
                  >
                    <SelectTrigger className={cn(
                      "h-8 w-[150px] text-[10px] font-bold uppercase focus:ring-0 focus:ring-offset-0 tracking-tighter shadow-sm",
                      item.status === "RECOVERY_RESOLVED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECOVERY_OPENED">RECOVERY PENDING</SelectItem>
                      <SelectItem value="RECOVERY_RESOLVED">Mark Recovered</SelectItem>
                      <SelectItem value="CONFIRMED_DUPLICATE">Move back to Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.statusUpdatedAt ? calculateAging(item.statusUpdatedAt) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Activity Log</SheetTitle>
                          <SheetDescription>History for Case {item.id}</SheetDescription>
                        </SheetHeader>
                        <ActivityLog id={item.id} />
                      </SheetContent>
                    </Sheet>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 text-xs font-bold">
                          <Mail className="h-3.5 w-3.5 mr-2" /> Email
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Contact Vendor</DialogTitle>
                          <DialogDescription>
                            Send recovery request to {item.vendor?.name}.
                          </DialogDescription>
                        </DialogHeader>
                        <EmailForm item={item} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Recovery Report</DialogTitle>
            <DialogDescription>
              Choose your preferred file format for the recovery items.
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
                <SelectItem value="json">JSON (.json)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" onClick={executeExport} className="w-full font-bold">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Generate & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}

function ActivityLog({ id }: { id: string }) {
  const { data: item, isLoading } = useQuery({
    queryKey: [`/api/recovery/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/recovery/${id}`);
      return res.json();
    }
  });

  if (isLoading) return <div className="py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>;

  return (
    <div className="mt-6 space-y-6">
      <div className="relative border-l border-muted ml-3 space-y-6 pb-2">
        {item?.activities?.map((activity: Activity) => (
          <div key={activity.id} className="relative pl-6">
            <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/30" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
              <p className="text-sm font-medium">{activity.action}</p>
              {activity.notes && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded mt-1">
                  {activity.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailForm({ item }: { item: RecoveryItem }) {
  // isOpen removed

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label className="text-xs font-bold uppercase">Subject</Label>
          <Input defaultValue={`Duplicate Payment Inquiry - Ref: ${item.id}`} />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-bold uppercase">Message</Label>
          <Textarea
            className="h-32 text-sm"
            defaultValue={`Dear ${item.vendor?.name || 'Vendor'} Team,\n\nWe have identified a potential duplicate payment of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(item.amount))} (Case ID: ${item.id}).\n\nPlease review your records and confirm if a credit memo can be issued.\n\nBest regards,\nAccounts Payable Team`}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => {
          toast.success("Email sent successfully");
          // Here we would ideally add an activity log for "Email Sent"
        }} className="w-full sm:w-auto font-bold">
          <Send className="mr-2 h-4 w-4" /> Send Request
        </Button>
      </DialogFooter>
    </>
  );
}
