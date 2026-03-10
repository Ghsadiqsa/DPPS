import { toast } from 'sonner';
import { Terminal, Lightbulb } from 'lucide-react';
import React from 'react';

/**
 * Universal Intelligent API Error Handling Pipeline
 * Parses frontend and backend exceptions and presents actionable solutions.
 */
export function handleApiError(err: any, customTitle: string = "Operation Failed", toastId?: string | number) {
    const rawMsg = err?.message || err?.error || (typeof err === 'string' ? err : "Unknown execution error");
    const lowerMsg = String(rawMsg).toLowerCase();

    let solution = "Please try again or contact support if the problem persists.";

    // Global generic parser
    if (lowerMsg.includes("no data rows") || lowerMsg.includes("empty")) solution = "Ensure your file contains data starting from row 3, and the file is not empty.";
    else if (lowerMsg.includes("missing") || lowerMsg.includes("required")) solution = "Make sure all required form fields or dropdowns are selected before submitting.";
    else if (lowerMsg.includes("invalid json") || lowerMsg.includes("json at position")) solution = "The JSON provided is malformed. Ensure syntax is valid.";
    else if (lowerMsg.includes("fetch") || lowerMsg.includes("network")) solution = "Network connection failed. Verify your internet connection or backend server status.";
    else if (lowerMsg.includes("stage records") || lowerMsg.includes("staging")) solution = "Database staging failed. Ensure data schema exactly matches template requirements.";
    else if (lowerMsg.includes("properties") || lowerMsg.includes("undefined") || lowerMsg.includes("reading")) solution = "Frontend rendering failed due to missing payload data. Try doing a hard refresh of the page.";
    else if (lowerMsg.includes("duplicate")) solution = "A record with this unique identifier already exists in the registry. Try modifying your entry.";
    else if (lowerMsg.includes("unauthorized") || lowerMsg.includes("401") || lowerMsg.includes("403") || lowerMsg.includes("invalid credentials")) solution = "Your session has expired, you lack permissions, or credentials are bad. Try logging out and back in.";
    else if (lowerMsg.includes("timeout") || lowerMsg.includes("504") || lowerMsg.includes("signal")) solution = "The mathematical matching engine or data query took too long to complete. Try filtering your date range tightly.";
    else if (lowerMsg.includes("500") || lowerMsg.includes("internal") || lowerMsg.includes("database")) solution = "The server countered a fatal API or Database SQL fault. Check system logs for stack traces.";
    else if (lowerMsg.includes("transition failed") || lowerMsg.includes("illegal state")) solution = "The requested lifecycle movement is mathematically forbidden by workflow rules. Refresh the grid.";

    const Component = () => (
        <div className="w-[356px] bg-white rounded-2xl border border-rose-200 shadow-2xl overflow-hidden flex flex-col font-sans -ml-4">
            <div className="bg-rose-50/80 border-b border-rose-100 p-4 flex gap-3">
                <div className="mt-0.5 p-1.5 bg-rose-100 rounded-lg shrink-0 h-fit">
                    <Terminal className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                    <h3 className="font-bold text-sm text-slate-900 tracking-tight">{customTitle}</h3>
                    <p className="text-[11px] text-rose-700 font-medium font-mono mt-1 w-full whitespace-pre-wrap break-words leading-relaxed">
                        {rawMsg}
                    </p>
                </div>
            </div>
            <div className="p-4 bg-slate-50/80">
                <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                        <Lightbulb className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800/60 mb-1">Recommended Action</h4>
                        <p className="text-[11px] text-emerald-950 leading-relaxed font-semibold">
                            {solution}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const options = toastId ? { id: toastId, duration: 8000 } : { duration: 8000 };
    toast.custom((t) => <Component />, options);
}
