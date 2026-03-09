'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Info, Target, Zap, Shield, AlertTriangle, RefreshCw, Save, KeyRound, Loader2, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getSupportedCurrencies, getExchangeRate } from "@/lib/currency";

interface DppsConfig {
  id: string;
  criticalThreshold: number;
  highThreshold: number;
  mediumThreshold: number;
  invoicePatternTrigger: number;
  dateProximityDays: number;
  fuzzyAmountTolerance: string;
  legalEntityScope: string;
  enableFuzzyLogic: boolean;
  useCompositeKeys: boolean;
  reportingCurrency: string;
  showSideBySideAmounts: boolean;
}

const DEFAULT_CONFIG: DppsConfig = {
  id: 'default',
  criticalThreshold: 85,
  highThreshold: 70,
  mediumThreshold: 50,
  invoicePatternTrigger: 80,
  dateProximityDays: 7,
  fuzzyAmountTolerance: "0.5",
  legalEntityScope: "within",
  enableFuzzyLogic: true,
  useCompositeKeys: true,
  reportingCurrency: 'USD',
  showSideBySideAmounts: false,
};

export default function SettingsPage() {
  const [config, setConfig] = useState<DppsConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // RBAC State
  const { data: session } = useSession();
  const isAdministrator = (session?.user as any)?.role === 'ADMINISTRATOR';
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState("Auditor");
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const availableTabs = [
    "Dashboard", "Open Potential Duplicates", "Payment Gate", "Recovery",
    "Reports", "Historical Data Load", "Documentation"
  ];

  useEffect(() => {
    fetchConfig();
    if (isAdministrator) {
      fetchRolePermissions();
    }
  }, [isAdministrator]);

  const fetchRolePermissions = async () => {
    try {
      const res = await fetch('/api/settings/permissions');
      if (res.ok) {
        const data = await res.json();
        setRolePermissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          fuzzyAmountTolerance: String(parseFloat(data.fuzzyAmountTolerance || "0.005") * 100),
        });
      }
      // If not OK, fall through to finally with DEFAULT_CONFIG still set
    } catch (error) {
      console.error('Failed to fetch config:', error);
      // Keep DEFAULT_CONFIG — settings page will still render
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          fuzzyAmountTolerance: (parseFloat(config.fuzzyAmountTolerance) / 100).toFixed(3),
        }),
      });

      if (res.ok) {
        toast.success("Configuration saved successfully", {
          description: "Changes are applied to all new payment validations.",
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error("Failed to save configuration", {
        description: "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/config', { method: 'POST' });
      if (res.ok) {
        await fetchConfig();
        toast.success("Configuration reset to defaults");
      }
    } catch {
      toast.error("Failed to reset configuration");
    } finally {
      setIsResetting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to change password.");
      }
    } catch (error) {
      toast.error("An error occurred while changing password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
      const currentPerms = rolePermissions.find(p => p.role === selectedRoleForPermissions)?.allowedTabs || [];
      const res = await fetch('/api/settings/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRoleForPermissions, allowedTabs: currentPerms }),
      });
      if (res.ok) {
        toast.success(`Permissions for ${selectedRoleForPermissions} updated successfully.`);
        fetchRolePermissions();
      } else {
        toast.error("Failed to update role permissions.");
      }
    } catch (error) {
      toast.error("An error occurred while saving permissions.");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const toggleTabPermission = (tab: string) => {
    setRolePermissions(prev => {
      const existingRoleIndex = prev.findIndex(p => p.role === selectedRoleForPermissions);
      let updatedPerms = [...prev];

      if (existingRoleIndex >= 0) {
        const roleData = { ...updatedPerms[existingRoleIndex] };
        if (roleData.allowedTabs.includes(tab)) {
          roleData.allowedTabs = roleData.allowedTabs.filter((t: string) => t !== tab);
        } else {
          roleData.allowedTabs = [...roleData.allowedTabs, tab];
        }
        updatedPerms[existingRoleIndex] = roleData;
      } else {
        updatedPerms.push({
          role: selectedRoleForPermissions,
          allowedTabs: [tab] // Initializing with the toggled tab
        });
      }
      return updatedPerms;
    });
  };

  const getRiskBadge = (value: number, type: 'critical' | 'high' | 'medium') => {
    const styles = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    const labels = {
      critical: 'Auto-Hold',
      high: 'Review',
      medium: 'Flag',
    };
    return (
      <Badge variant="outline" className={`${styles[type]} text-xs font-bold`}>
        {labels[type]}: {value}+
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight">DPPS Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Manage duplicate detection thresholds, signals, and policy settings.
          </p>
        </div>
        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3 max-w-[250px]">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <p className="text-[10px] leading-tight text-muted-foreground">
            Changes apply to all new payment validations immediately.
          </p>
        </div>
      </div>

      {/* Risk Threshold Visualization */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Risk Score Thresholds
          </CardTitle>
          <CardDescription>
            Based on formula: Amount(40%) + Vendor(30%) + Invoice Pattern(30%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            {getRiskBadge(config.criticalThreshold, 'critical')}
            {getRiskBadge(config.highThreshold, 'high')}
            {getRiskBadge(config.mediumThreshold, 'medium')}
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-bold">
              Low: 0-{config.mediumThreshold - 1}
            </Badge>
          </div>
          <div className="relative h-8 bg-gradient-to-r from-emerald-100 via-yellow-100 via-orange-100 to-red-200 rounded-lg overflow-hidden">
            <div
              className="absolute h-full w-1 bg-red-600"
              style={{ left: `${config.criticalThreshold}%` }}
            />
            <div
              className="absolute h-full w-1 bg-orange-500"
              style={{ left: `${config.highThreshold}%` }}
            />
            <div
              className="absolute h-full w-1 bg-yellow-500"
              style={{ left: `${config.mediumThreshold}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-4 text-[10px] font-bold">
              <span className="text-emerald-700">LOW</span>
              <span className="text-yellow-700">MEDIUM</span>
              <span className="text-orange-700">HIGH</span>
              <span className="text-red-700">CRITICAL</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {/* Detection Thresholds Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>Risk Classification Thresholds</CardTitle>
                <CardDescription>Score ranges that determine action requirements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Critical Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Critical</Badge>
                    <Label className="text-base font-bold">Auto-Hold Threshold</Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[400px]">
                    Scores ≥ {config.criticalThreshold}: Automatically held. Manager approval required to release.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="w-20 font-mono font-bold"
                    value={config.criticalThreshold}
                    onChange={(e) => setConfig(prev => ({ ...prev, criticalThreshold: parseInt(e.target.value) || 85 }))}
                    min={70}
                    max={100}
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* High Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>
                    <Label className="text-base font-bold">Review Threshold</Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[400px]">
                    Scores {config.highThreshold}-{config.criticalThreshold - 1}: Held for analyst review. Notes required to release.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="w-20 font-mono font-bold"
                    value={config.highThreshold}
                    onChange={(e) => setConfig(prev => ({ ...prev, highThreshold: parseInt(e.target.value) || 70 }))}
                    min={50}
                    max={84}
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Medium Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Medium</Badge>
                    <Label className="text-base font-bold">Flag Threshold</Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[400px]">
                    Scores {config.mediumThreshold}-{config.highThreshold - 1}: Flagged for awareness. Can proceed with override.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="w-20 font-mono font-bold"
                    value={config.mediumThreshold}
                    onChange={(e) => setConfig(prev => ({ ...prev, mediumThreshold: parseInt(e.target.value) || 50 }))}
                    min={30}
                    max={69}
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signal Configuration Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle>Detection Signals</CardTitle>
                <CardDescription>Fine-tune when each signal triggers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Invoice Pattern Trigger */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Invoice Pattern (Fuzzy) Trigger</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        Levenshtein similarity percentage above which the Invoice Pattern signal fires. Catches OCR errors like O vs 0.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Similarity threshold: {config.invoicePatternTrigger}%</p>
              </div>
              <div className="flex items-center gap-3 w-32">
                <Slider
                  value={[config.invoicePatternTrigger]}
                  onValueChange={([v]) => setConfig(prev => ({ ...prev, invoicePatternTrigger: v }))}
                  min={60}
                  max={95}
                  step={5}
                  className="w-24"
                />
                <span className="text-sm font-mono font-bold w-10">{config.invoicePatternTrigger}%</span>
              </div>
            </div>

            <Separator />

            {/* Date Proximity */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Date Proximity Window</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        Signal fires when invoice dates are within this many days. Catches re-submitted invoices.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Invoices within {config.dateProximityDays} days apart</p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={String(config.dateProximityDays)}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, dateProximityDays: parseInt(v) }))}
                >
                  <SelectTrigger className="w-24 font-mono font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 14, 30].map(d => (
                      <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Fuzzy Amount Tolerance */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Fuzzy Amount Tolerance</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        Signal fires when amounts differ by less than this percentage. Catches discount/rounding duplicates.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Amount difference &lt; {config.fuzzyAmountTolerance}%</p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={config.fuzzyAmountTolerance}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, fuzzyAmountTolerance: v }))}
                >
                  <SelectTrigger className="w-24 font-mono font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["0.1", "0.25", "0.5", "1.0", "2.0"].map(t => (
                      <SelectItem key={t} value={t}>{t}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Legal Entity Scope */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Legal Entity Scope</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        Whether to match duplicates only within the same legal entity, or across all entities.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.legalEntityScope === 'within'
                    ? 'Match within same legal entity only'
                    : 'Match across all legal entities'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={config.legalEntityScope}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, legalEntityScope: v }))}
                >
                  <SelectTrigger className="w-40 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="within">Within Entity</SelectItem>
                    <SelectItem value="cross">Cross-Entity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />

            {/* Strict / Fuzzy Toggle */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Enable Fuzzy Logic Module</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        When disabled, only exact matches are processed. Fuzzy algorithms (Levenshtein, trigrams) will be skipped to save compute resources.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Currently: {config.enableFuzzyLogic ? 'Enabled' : 'Strict Mode (Disabled)'}</p>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={config.enableFuzzyLogic}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableFuzzyLogic: checked }))}
                />
              </div>
            </div>

            <Separator />

            {/* Composite Keys Toggle */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Use Composite Key Enforcement</Label>
                </div>
                <p className="text-xs text-muted-foreground">Boost score heavily if Vendor + Company Code + Reference Number all match</p>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={config.useCompositeKeys}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, useCompositeKeys: checked }))}
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Currency & Reporting Configuration Card */}
        <Card className="overflow-hidden border-emerald-100">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-500" />
              <div>
                <CardTitle>Currency & Reporting Base</CardTitle>
                <CardDescription>Configure global reporting currency and multi-currency display</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Global Reporting Currency */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Base Reporting Currency</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        The primary currency used for all dashboard KPIs and global calculations.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Select from supported global currencies (USD, CAD, GBP, EUR, etc.)</p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={config.reportingCurrency || 'USD'}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, reportingCurrency: v }))}
                >
                  <SelectTrigger className="w-32 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {getSupportedCurrencies().sort().map(curr => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Side-by-Side Display Toggle */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-bold">Dual-Currency Display</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        Show both the original invoice amount AND the reporting base amount side-by-side in grid views.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">Enable visual reconciliation between Local and Global base amounts</p>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={config.showSideBySideAmounts}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showSideBySideAmounts: checked }))}
                />
              </div>
            </div>

            <Separator />

            {/* Reference Exchange Rates (Read-only for transparency) */}
            <div className="space-y-3">
              <Label className="text-sm font-black uppercase text-slate-400 tracking-widest">Active Reference FX Rates (per {config.reportingCurrency || 'USD'})</Label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {['USD', 'EUR', 'GBP', 'CAD', 'GHS', 'NGN', 'ZAR', 'XOF'].filter(c => c !== (config.reportingCurrency || 'USD')).map(curr => {
                  const rate = getExchangeRate(config.reportingCurrency || 'USD', curr).toFixed(4);

                  return (
                    <div key={curr} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center group hover:bg-white transition-colors">
                      <span className="text-xs font-black text-slate-500">{curr}</span>
                      <span className="font-mono text-xs font-bold text-emerald-600">{rate}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium italic">
                * FX rates are synchronized globally and updated daily in real-time.
              </p>
            </div>

          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="overflow-hidden border-indigo-100">
          <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-500" />
              <div>
                <CardTitle>Account Security</CardTitle>
                <CardDescription>Update your personal login credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Dynamic RBAC Configuration Card (Admin Only) */}
        {isAdministrator && (
          <Card className="overflow-hidden border-indigo-100">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <div>
                  <CardTitle>Role Permissions Configuration</CardTitle>
                  <CardDescription>Dynamically manage which navigation tabs are visible for each role.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Label className="w-24">Select Role:</Label>
                <Select value={selectedRoleForPermissions} onValueChange={setSelectedRoleForPermissions}>
                  <SelectTrigger className="w-64 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
                    <SelectItem value="AP Manager">AP Manager</SelectItem>
                    <SelectItem value="Auditor">Auditor</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-xl bg-slate-50">
                {availableTabs.map(tab => {
                  const currentRoleData = rolePermissions.find(p => p.role === selectedRoleForPermissions);
                  // If no specific override exists, assume everything is permitted except Auditor to Payment Gate as a default implicit behavior.
                  // But for strict RBAC, an empty config means NO access unless checked. 
                  const isAllowed = currentRoleData
                    ? currentRoleData.allowedTabs.includes(tab)
                    : (selectedRoleForPermissions === 'Auditor' && tab === 'Payment Gate' ? false : true); // Default UX

                  return (
                    <div key={tab} className="flex items-center space-x-2 bg-white p-3 rounded-lg border shadow-sm">
                      <Switch
                        checked={isAllowed}
                        onCheckedChange={() => toggleTabPermission(tab)}
                        disabled={selectedRoleForPermissions === 'ADMINISTRATOR'} // Cannot lock admins out
                      />
                      <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {tab}
                      </Label>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePermissions} disabled={isSavingPermissions || selectedRoleForPermissions === 'ADMINISTRATOR'} className="bg-indigo-600 hover:bg-indigo-700">
                  {isSavingPermissions && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save {selectedRoleForPermissions} Permissions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            className="font-bold"
            onClick={resetToDefaults}
            disabled={isResetting}
          >
            {isResetting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Defaults
              </>
            )}
          </Button>
          <Button
            className="font-bold px-8 shadow-lg"
            onClick={saveConfig}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
