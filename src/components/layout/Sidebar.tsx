'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShieldAlert,
  FileCheck,
  History,
  BarChart3,
  Settings,
  ShieldCheck as ShieldIcon,
  Shield,
  BookOpen,
  UploadCloud,
  CheckCircle2,
  Database
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Open Potential Duplicates", href: "/pre-pay", icon: ShieldAlert },
  { name: "Payment Gate", href: "/gate", icon: FileCheck },
  { name: "Recovery", href: "/recovery", icon: History },
  { name: "Duplicate Resolved", href: "/resolved", icon: CheckCircle2 },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Historical Data Load", href: "/historical-load", icon: UploadCloud },
  { name: "Documentation", href: "/docs", icon: BookOpen },
  { name: "Access Control", href: "/access", icon: Shield },
  { name: "Integrations", href: "/integrations", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdministrator = user?.role === 'ADMINISTRATOR';
  const role = user?.role || "Viewer";

  const [rolePermissions, setRolePermissions] = useState<any[]>([]);

  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await fetch('/api/settings/permissions');
        if (res.ok) {
          const data = await res.json();
          setRolePermissions(data);
        }
      } catch (err) {
        console.error("Failed to load permissions", err);
      }
    };
    fetchPerms();
  }, []);

  const filteredNavigation = navigation.filter(item => {
    // If Administrator, show everything
    if (isAdministrator) return true;

    // Check dynamic DB permissions for current user's role
    const specificPerms = rolePermissions.find(p => p.role === role);
    if (specificPerms) {
      return specificPerms.allowedTabs.includes(item.name);
    }

    // Default implicit fallback if not yet configured in DB
    if (['Access Control', 'Integrations', 'Settings'].includes(item.name)) {
      return false; // Still lock out core admin stuff
    }

    // Hardcoded fallback for user request during DB transition: Auditor cannot see Payment Gate
    if (role === 'Auditor' && item.name === 'Payment Gate') {
      return false;
    }

    return true;
  });

  const userName = user?.name || "Jane Doe";
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('') || "JD";
  const userRole = user?.role || "Viewer";

  return (
    <div className="flex h-screen w-64 flex-col bg-[#1c2d3d] text-white border-r border-[#2c3e50] transition-all duration-300 ease-in-out z-20 shadow-xl">
      <div className="flex h-12 items-center px-4 bg-[#121c26] border-b border-[#2c3e50]/50">
        <ShieldIcon className="h-6 w-6 text-[#3498db] shrink-0" />
        <span className="text-sm font-bold font-heading tracking-tight ml-4 whitespace-nowrap text-white">Financial Control Tower</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <TooltipProvider key={item.name} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={item.href} className={cn(
                      "group/item flex items-center h-10 px-3 py-2 text-sm font-bold rounded-sm transition-all",
                      isActive
                        ? "bg-[#3498db] text-white shadow-sm"
                        : "text-slate-100 hover:bg-[#2c3e50] hover:text-white"
                    )}>
                      <item.icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0 transition-colors",
                          isActive ? "text-white" : "text-slate-300 group-hover/item:text-white"
                        )}
                      />
                      <span className="ml-4 whitespace-nowrap">{item.name}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#121c26] border-[#2c3e50] text-white text-[10px] font-bold">
                    {item.name === "Reports" ? "View system efficiency and prevention metrics" : `Go to ${item.name}`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </div>

      <div className="bg-[#121c26] p-4 overflow-hidden border-t border-[#2c3e50]">
        <div className="flex items-center">
          <div className="h-9 w-9 rounded-sm bg-[#3498db] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner">
            {userInitials}
          </div>
          <div className="ml-4 whitespace-nowrap">
            <p className="text-sm font-bold text-white">{userName}</p>
            <p className="text-xs text-slate-300 font-semibold uppercase tracking-tighter">{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
