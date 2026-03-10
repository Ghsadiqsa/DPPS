'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, Terminal, Lightbulb, ChevronRight, ServerCrash, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [solution, setSolution] = useState<string>('Analyzing system fault...');

    useEffect(() => {
        // Intelligently parse the error message to provide the user with a direct solution
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
            setSolution('Network Connection Failure: The client lost connection to the backend server or the API endpoint is completely down. Verify your internet connection or check if the Vercel backend service is active.');
        } else if (msg.includes('undefined') || msg.includes('null') || msg.includes('reading properties')) {
            setSolution('Data Reference Error: A user interface component attempted to render data that has not fully loaded or is unexpectedly missing from the API payload. Often caused by corrupted database state or missing foreign keys. Click "Attempt Recovery" below.');
        } else if (msg.includes('api') || msg.includes('500') || msg.includes('400')) {
            setSolution('Backend Service Fault: The server encountered an internal error processing the request. This usually means the API expects dynamic parameters that were not passed correctly, or strict SQL parameters failed.');
        } else if (msg.includes('hydrate') || msg.includes('hydration') || msg.includes('minified react error')) {
            setSolution('Hydration Mismatch / State Error: The server generated different HTML than the client expected. This often happens if browser extensions modify the DOM or browser caches hold onto stale JavaScript chunks. Clearing your cache and doing a hard refresh is strongly recommended.');
        } else if (msg.includes('timeout')) {
            setSolution('Execution Timeout: The mathematical matching engine or data query took too long to complete. Try filtering your dashboard date range to a much smaller window.');
        } else {
            setSolution('Unhandled React Runtime Exception: A generic execution error occurred during component rendering. Our internal telemetry logs have captured this stack trace. Please try attempting a quick recovery or returning to the dashboard.');
        }
    }, [error]);

    return (
        <div className="min-h-[85vh] bg-slate-50/50 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-4xl w-full">
                {/* Error Header */}
                <div className="flex items-center gap-5 mb-8 text-rose-600">
                    <div className="p-4 bg-white rounded-2xl shadow-xl shadow-rose-900/10 border-2 border-rose-100">
                        <ServerCrash className="h-10 w-10 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">UI Thread Crashed</h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Application Runtime Exception</p>
                    </div>
                </div>

                {/* Error Container */}
                <Card className="rounded-[32px] border-rose-200/50 shadow-2xl shadow-rose-900/5 bg-white overflow-hidden">
                    <div className="bg-rose-50/50 border-b border-rose-100/60 p-6 flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-2">
                            <Terminal className="h-4 w-4" /> Diagnostic Error Output
                        </span>
                        <p className="font-mono text-sm text-rose-900 font-bold bg-white p-5 rounded-2xl border border-rose-100 break-all shadow-sm">
                            {error.message || 'Unknown fatal render error occurred during execution cycle.'}
                        </p>
                    </div>

                    <CardContent className="p-8 space-y-8">
                        {/* Proposed Automated Solution */}
                        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0 mt-0.5">
                                    <Lightbulb className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-widest mb-2">Automated Root Cause Analysis & Proposed Solution</h3>
                                    <p className="text-emerald-950 font-medium text-sm leading-relaxed">
                                        {solution}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stack Trace block */}
                        {error.stack && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <Cpu className="h-4 w-4" /> Raw Execution Stack Trace
                                </h4>
                                <div className="bg-[#0f172a] p-6 rounded-3xl overflow-auto max-h-[300px] shadow-inner ring-1 ring-slate-800">
                                    <pre className="text-emerald-400/90 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                                        {error.stack}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Interaction Layer */}
                        <div className="pt-4 flex items-center gap-4 border-t border-slate-100 mt-6">
                            <Button
                                onClick={() => reset()}
                                className="bg-slate-900 hover:bg-black text-white px-8 h-12 rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
                            >
                                <RefreshCcw className="h-4 w-4 mr-2" /> Attempt State Recovery
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/'}
                                variant="outline"
                                className="px-8 h-12 rounded-xl font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                Flush State & Return Home <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
