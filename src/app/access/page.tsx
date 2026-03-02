'use client';

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Fingerprint,
  Key,
  Plus,
  ExternalLink,
  Shield,
  Settings,
  RefreshCw
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function AccessManagement() {
  const { data: session } = useSession();
  const isAdministrator = (session?.user as any)?.role === 'ADMINISTRATOR';

  /* import { useQuery } from "@tanstack/react-query"; */ // Added top level import in full file replacement if needed, 
  // but here I need to be careful with imports. I'll invoke useQuery here.
  const { data: dbUsers, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    }
  });

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("Viewer");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole
        })
      });

      if (res.ok) {
        toast.success("User created successfully.");
        setIsInviteOpen(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("Viewer");
        refetch(); // Refresh table
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to create user.");
      }
    } catch (error) {
      toast.error("An error occurred.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole })
      });

      if (res.ok) {
        toast.success("User role updated successfully.");
        refetch(); // Refresh table
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update user role.");
      }
    } catch (error) {
      toast.error("An error occurred.");
    }
  };

  const users = dbUsers?.map((u: any) => ({
    id: u.id,
    name: u.fullName || u.username,
    email: u.email || `${u.username}@enterprise.com`,
    role: u.role || 'Viewer',
    status: u.status || 'Active',
    method: u.authMethod || 'Email'
  })) || [];

  const [roles] = React.useState([
    { id: "admin", name: "Administrator", permissions: "Full system access", color: "bg-purple-500", exactName: "ADMINISTRATOR" },
    { id: "ap_mgr", name: "AP Manager", permissions: "Review & Release payments", color: "bg-blue-500", exactName: "AP Manager" },
    { id: "auditor", name: "Auditor", permissions: "Read-only audit logs", color: "bg-slate-500", exactName: "Auditor" },
    { id: "viewer", name: "Viewer", permissions: "Basic view access", color: "bg-emerald-500", exactName: "Viewer" },
  ]);

  // Role Permissions Dialog State
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [isConfigRoleOpen, setIsConfigRoleOpen] = useState(false);
  const [roleToConfig, setRoleToConfig] = useState("");
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const availableTabs = [
    "Dashboard", "Open Potential Duplicates", "Payment Gate", "Recovery",
    "Reports", "Historical Data Load", "Documentation"
  ];

  React.useEffect(() => {
    if (isAdministrator) {
      fetchRolePermissions();
    }
  }, [isAdministrator]);

  const fetchRolePermissions = async () => {
    try {
      const res = await fetch('/api/settings/permissions');
      if (res.ok) {
        setRolePermissions(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
    }
  };

  const toggleTabPermission = (tab: string) => {
    setRolePermissions(prev => {
      const existingRoleIndex = prev.findIndex(p => p.role === roleToConfig);
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
        updatedPerms.push({ role: roleToConfig, allowedTabs: [tab] });
      }
      return updatedPerms;
    });
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
      const currentPerms = rolePermissions.find(p => p.role === roleToConfig)?.allowedTabs || [];
      const res = await fetch('/api/settings/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleToConfig, allowedTabs: currentPerms }),
      });
      if (res.ok) {
        toast.success(`Permissions updated successfully.`);
        fetchRolePermissions();
        setIsConfigRoleOpen(false);
      } else {
        toast.error("Failed to update role permissions.");
      }
    } catch {
      toast.error("An error occurred while saving permissions.");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const openRoleConfig = (exactName: string) => {
    setRoleToConfig(exactName);
    setIsConfigRoleOpen(true);
  };

  return (

    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">Access Control Cockpit</h1>
          <p className="text-muted-foreground mt-2">
            Provision user roles, manage RBAC policies, and configure SSO endpoints.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-slate-300">
            <Settings className="mr-2 h-4 w-4" /> Policy Config
          </Button>
          {isAdministrator && (
            <Button
              className="bg-[#3498db] hover:bg-[#2980b9]"
              onClick={() => setIsInviteOpen(!isInviteOpen)}
            >
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          )}
        </div>
      </div>

      {isInviteOpen && (
        <Card className="border-2 border-[#3498db]">
          <CardHeader>
            <CardTitle>Create New User Account</CardTitle>
            <CardDescription>Manually provision a user profile for clients to test the demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid md:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Jane Doe" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="jane@example.com" required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger>
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
              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#3498db] hover:bg-[#2980b9]" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enterprise Roles (RBAC)</CardTitle>
            <CardDescription>Available roles and their default permission sets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-3 rounded border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${role.color}`} />
                    <div>
                      <p className="text-sm font-bold">{role.name}</p>
                      <p className="text-xs text-muted-foreground">{role.permissions}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openRoleConfig(role.exactName)}
                    className="border"
                  >
                    Configure
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" /> Define Custom Role
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-t-4 border-t-[#3498db]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SSO Provider Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#3498db]/10 rounded-lg">
                    <Fingerprint className="h-5 w-5 text-[#3498db]" />
                  </div>
                  <span className="font-bold">Okta Enterprise</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500">Connected</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Directory Sync Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="mr-2 h-4 w-4" /> Force SCIM Resync
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
                <Shield className="mr-2 h-4 w-4" /> Revoke All External Sessions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>Managed via Single Sign-On directory synchronization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Auth Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: any) => (
                <TableRow key={user.email}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isAdministrator ? (
                      <Select value={user.role} onValueChange={(val) => handleRoleChange(user.id, val)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
                          <SelectItem value="AP Manager">AP Manager</SelectItem>
                          <SelectItem value="Auditor">Auditor</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="font-semibold">{user.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <Key className="h-3 w-3 text-muted-foreground" />
                      {user.method}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-sm">{user.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openRoleConfig(user.role)}>Manage Output</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SSO Configuration</CardTitle>
          <CardDescription>Configure SAML 2.0 or OIDC for enterprise identity providers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Entity ID / Issuer URL</Label>
              <div className="flex gap-2">
                <input readOnly value="https://sso.enterprise.com/saml/metadata" className="flex-1 p-2 rounded border bg-muted font-mono text-xs" />
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ACS URL (Callback)</Label>
              <div className="flex gap-2">
                <input readOnly value="https://api.dpps.enterprise.com/v1/auth/sso/callback" className="flex-1 p-2 rounded border bg-muted font-mono text-xs" />
                <Button variant="outline" size="sm">Copy</Button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Shield className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Automated Provisioning Enabled</h4>
                <p className="text-slate-400 text-xs mt-1">
                  SCIM 2.0 is active. Users added to the &apos;DPPS-Users&apos; group in Okta will be automatically provisioned.
                </p>
                <Button variant="link" className="text-[#3498db] h-auto p-0 mt-2 text-xs">
                  View Mapping Rules <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Configuration Dialog */}
      <Dialog open={isConfigRoleOpen} onOpenChange={setIsConfigRoleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{roleToConfig} Tab Permissions</DialogTitle>
            <DialogDescription>Select which navigation tabs this role is allowed to see.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {availableTabs.map(tab => {
              const currentRoleData = rolePermissions.find(p => p.role === roleToConfig);
              const isAllowed = currentRoleData
                ? currentRoleData.allowedTabs.includes(tab)
                : (roleToConfig === 'Auditor' && tab === 'Payment Gate' ? false : true);

              return (
                <div key={tab} className="flex items-center space-x-2 border p-3 rounded-lg shadow-sm">
                  <Switch
                    checked={isAllowed}
                    onCheckedChange={() => toggleTabPermission(tab)}
                    disabled={roleToConfig === 'ADMINISTRATOR'}
                  />
                  <Label className="text-sm font-medium leading-none">
                    {tab}
                  </Label>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigRoleOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSavePermissions}
              disabled={isSavingPermissions || roleToConfig === 'ADMINISTRATOR'}
              className="bg-[#3498db] hover:bg-[#2980b9]"
            >
              {isSavingPermissions && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
