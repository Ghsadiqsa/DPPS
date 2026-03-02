'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Search, Filter, ArrowRight, AlertCircle, MoreHorizontal, Lock } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BrainCircuit, LineChart, History, Building2 } from "lucide-react";

export default function BlockedPaymentsCockpit() {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<string>("All");

  // Fetch invoices from API in targeted states
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ["blocked-invoices", filterType],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?status=BLOCKED`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    }
  });

  interface InvoiceItem {
    id: string;
    invoiceNumber: string;
    amount: string;
    similarityScore: number;
    status: string;
    vendor: {
      name: string;
      id: string;
    };
    signals: string[];
    investigationNotes?: string;
  }

  const invoicesList = (Array.isArray(invoicesData) ? invoicesData : []) as InvoiceItem[];

  const duplicateTypes = [
    { label: "Exact Match", count: 12, color: "bg-blue-500" },
    { label: "Fuzzy (Name/Amt)", count: 8, color: "bg-amber-500" },
    { label: "Transposed Digits", count: 4, color: "bg-purple-500" },
    { label: "Vndr Master Error", count: 3, color: "bg-rose-500" },
  ];

  return (

    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight flex items-center gap-3">
            <Lock className="text-destructive h-8 w-8" /> Blocked for Payment
          </h1>
          <p className="text-muted-foreground mt-2">
            Audit view of all invoices currently held by the system or analysts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-bold">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search invoices, vendors, or IDs..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          {duplicateTypes.map((type) => (
            <Button
              key={type.label}
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-[10px] font-bold border-dashed",
                filterType === type.label && "bg-primary/5 border-primary/50"
              )}
              onClick={() => setFilterType(type.label)}
            >
              <div className={cn("h-1.5 w-1.5 rounded-full mr-2", type.color)} />
              {type.label}
              <Badge variant="secondary" className="ml-2 h-4 min-w-[18px] p-0 text-[9px] flex items-center justify-center">
                {type.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px]">Invoice ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="w-[300px]">Block Reason / Notes</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : invoicesList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No blocked payments found
                </TableCell>
              </TableRow>
            ) : invoicesList.map((c: InvoiceItem) => (
              <TableRow key={c.id} className="group hover:bg-red-50/30 transition-colors">
                <TableCell className="font-mono text-[10px] font-bold">{c.id.slice(0, 8)}</TableCell>
                <TableCell className="font-semibold text-sm">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="link" className="p-0 h-auto font-semibold text-foreground underline-offset-4 decoration-dashed decoration-muted-foreground/50">
                        {c.vendor?.name || 'Unknown Vendor'}
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex justify-between space-x-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {c.vendor?.name || 'Unknown Vendor'}
                          </h4>
                          <p className="text-xs text-muted-foreground">Vendor ID: {c.vendor?.id || 'N/A'}</p>
                          <div className="flex items-center pt-2">
                            <Badge variant="outline" className="text-[10px] mr-1">Active</Badge>
                            <Badge variant={(c.similarityScore || 0) > 80 ? "destructive" : "secondary"} className="text-[10px]">
                              Risk: {(c.similarityScore || 0) > 80 ? "High" : "Medium"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell className="font-mono text-xs">{c.invoiceNumber || 'N/A'}</TableCell>
                <TableCell className="font-mono text-xs font-bold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(c.amount) || 0)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent justify-start">
                          <Badge variant="outline" className="text-[9px] w-fit font-mono uppercase bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer transition-colors group">
                            {(c.similarityScore || 0) > 90 ? "High Confidence AI" : "Pattern Match"}
                            <BrainCircuit className="ml-1 h-3 w-3 group-hover:text-indigo-500" />
                          </Badge>
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="sm:max-w-xl">
                        <SheetHeader>
                          <SheetTitle className="flex items-center gap-2 text-xl">
                            <BrainCircuit className="h-6 w-6 text-indigo-600" />
                            AI Forensics Analysis
                          </SheetTitle>
                          <SheetDescription>
                            Deep learning model explanation for Invoice #{c.invoiceNumber}
                          </SheetDescription>
                        </SheetHeader>

                        <div className="mt-8 space-y-6">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-sm text-slate-700">Similarity Confidence</h4>
                              <span className="text-2xl font-black text-indigo-600">{c.similarityScore || 0}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.similarityScore || 0}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              The model is {c.similarityScore || 0}% confident this is a true duplicate.
                            </p>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span>{c.signals?.join(", ") || "Anomaly Detected"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Textarea
                    placeholder="Add detailed analyst notes..."
                    className="min-h-[32px] text-xs bg-transparent border-transparent hover:border-input focus:bg-background transition-all resize-y overflow-hidden focus:overflow-auto py-1"
                    rows={1}
                    value={comments[c.id] || c.investigationNotes || ''}
                    onChange={(e) => {
                      setComments(prev => ({ ...prev, [c.id]: e.target.value }));
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full ${(c.similarityScore || 0) > 80 ? 'bg-destructive' : 'bg-amber-500'}`}
                        style={{ width: `${c.similarityScore || 0}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-black ${(c.similarityScore || 0) > 80 ? 'text-destructive' : 'text-amber-600'}`}>
                      {c.similarityScore || 0}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive" className="bg-red-600 hover:bg-red-700 text-[10px] font-bold uppercase tracking-tighter shadow-sm flex items-center gap-1 w-fit">
                    <Lock className="h-3 w-3" />
                    {c.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>

  );
}
