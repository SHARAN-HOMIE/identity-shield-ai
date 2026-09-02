import type { PipelineProgress } from "@/lib/pipeline";
import {
  ScanLine,
  FileSearch,
  AlertTriangle,
  Eye,
  Shield,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const MODULE_ICONS: Record<string, typeof ScanLine> = {
  "OCR Extraction": ScanLine,
  "Document Validation": FileSearch,
  "Tampering Detection": AlertTriangle,
  "Face Verification": Eye,
  "Risk Scoring": Shield,
};

interface ScanProgressProps {
  progress: PipelineProgress[];
}

export function ScanProgress({ progress }: ScanProgressProps) {
  return (
    <div className="space-y-3">
      {progress.map((p) => {
        const Icon = MODULE_ICONS[p.module] || ScanLine;
        return (
          <div
            key={p.module}
            className="flex items-center gap-3 rounded-xl border border-scanner-border bg-scanner-surface/60 px-4 py-3"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-scanner-accent/10">
              {p.status === "running" ? (
                <Loader2 className="size-4 text-scanner-accent animate-spin" />
              ) : p.status === "complete" ? (
                <CheckCircle2 className="size-4 text-risk-green" />
              ) : (
                <Icon className="size-4 text-scanner-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-scanner-text">{p.module}</p>
              <p className="text-xs text-scanner-muted truncate">{p.message}</p>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                p.status === "running"
                  ? "text-scanner-accent"
                  : p.status === "complete"
                  ? "text-risk-green"
                  : "text-risk-red"
              }`}
            >
              {p.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
