'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Key,
  ExternalLink,
  Plus,
  Copy,
  Shield,
  Code,
  Lock,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

const integrationCategories = [
  {
    name: "Enterprise ERP",
    integrations: [
      { name: "SAP S/4HANA", status: "Connected", icon: Database },
      { name: "Oracle NetSuite", status: "Not Connected", icon: Database },
      { name: "Microsoft Dynamics", status: "Connected", icon: Database },
    ]
  },
  {
    name: "Banking & Payment",
    integrations: [
      { name: "J.P. Morgan Chase", status: "Connected", icon: ExternalLink },
      { name: "HSBC Global", status: "Connected", icon: ExternalLink },
      { name: "Swift GPI", status: "Not Connected", icon: ExternalLink },
    ]
  }
];

export default function IntegrationPage() {
  const { data: dbTokens, refetch } = useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      const res = await fetch('/api/integrations');
      if (!res.ok) throw new Error("Failed to fetch tokens");
      return res.json();
    }
  });

  const tokens = (Array.isArray(dbTokens) ? dbTokens : [])?.map((t: any) => ({
    id: t.id,
    name: t.name,
    key: t.maskedToken,
    created: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
    lastUsed: t.lastUsed ? new Date(t.lastUsed).toLocaleDateString() : 'Never'
  })) || [];

  const handleGenerateToken = async () => {
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New API Token' }) // Simplified for UI
      });
      toast.success("New token generated");
      refetch();
    } catch {
      toast.error("Failed to generate token");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("API Key copied to clipboard");
  };

  return (

    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight">Integrations & API</h1>
          <p className="text-muted-foreground mt-2">
            Manage secure connections and developer access tokens.
          </p>
        </div>
        <Button className="font-bold shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Tabs defaultValue="tokens" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 border">
          <TabsTrigger value="tokens" className="font-bold data-[state=active]:shadow-sm">
            <Key className="h-4 w-4 mr-2" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="connections" className="font-bold data-[state=active]:shadow-sm">
            <Database className="h-4 w-4 mr-2" />
            Direct Connections
          </TabsTrigger>
          <TabsTrigger value="docs" className="font-bold data-[state=active]:shadow-sm">
            <Code className="h-4 w-4 mr-2" />
            API Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-6">
          <Card className="border-2 border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/[0.02] border-b py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Active Authorization Tokens
                  </CardTitle>
                  <CardDescription>Use these tokens to authorize your external ERP systems</CardDescription>
                </div>
                <Button size="sm" className="font-bold" onClick={handleGenerateToken}>Generate New Token</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tokens.map((token: any) => (
                  <div key={token.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">{token.name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          Last used: {token.lastUsed}
                        </span>
                        <span>Created: {token.created}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted px-3 py-1.5 rounded-md font-mono text-xs border flex items-center gap-2">
                        {token.key}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard("sk_live_8a92b3c4d5e6f7g8h9i0")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs font-bold text-destructive hover:bg-destructive/5 border-destructive/20">
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Security Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>• Never share your secret keys in publicly accessible areas.</p>
                <p>• Use environment variables for storing tokens in your backend.</p>
                <p>• Regularly rotate keys to maintain high security standards.</p>
              </CardContent>
            </Card>
            <Card className="bg-[#121c26] text-white border-none">
              <CardHeader>
                <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-400" />
                  Quick Start Header
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-[11px] font-mono text-blue-300 bg-black/30 p-4 rounded-lg overflow-x-auto">
                  {`curl -X GET "https://api.dpps.enterprise/v1/cases" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json"`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <div className="grid gap-6">
            {integrationCategories.map((category) => (
              <div key={category.name} className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider pl-1">
                  {category.name}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.integrations.map((integration) => (
                    <Card key={integration.name} className="hover:border-primary/50 transition-colors cursor-pointer group">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <integration.icon className="h-5 w-5" />
                          </div>
                          <Badge variant={integration.status === "Connected" ? "default" : "secondary"}>
                            {integration.status}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-foreground">{integration.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">Enterprise Data Bridge</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-foreground">API Documentation</h3>
              <p className="max-w-md mx-auto mt-2">
                Complete technical specifications for the DPPS REST API, including endpoint schemas and rate limiting policies.
              </p>
              <Button variant="outline" className="mt-6 font-bold">
                Download SDK (TypeScript)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

  );
}