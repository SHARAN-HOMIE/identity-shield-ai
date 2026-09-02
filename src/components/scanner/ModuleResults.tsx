import type {
  OCRResult,
  ValidationResult,
  TamperingResult,
  FaceVerificationResult,
} from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ScanLine,
  FileSearch,
  AlertOctagon,
  Eye,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { getModuleStatus, type ModuleStatus } from "@/lib/model-status";

// ─── Mock Mode Badge ────────────────────────────────────────────────────

function MockBadge({ module }: { module: keyof ReturnType<typeof getModuleStatus> }) {
  const status = getModuleStatus()[module];
  if (status === "real") return null;
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-scanner-muted/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-scanner-muted">
        <Loader2 className="size-2.5 animate-spin" /> loading
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-risk-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-yellow">
      <Cpu className="size-2.5" /> mock mode
    </span>
  );
}

// ─── Status Icon Helper ─────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="size-4 text-risk-green" />;
    case "fail":
      return <XCircle className="size-4 text-risk-red" />;
    case "warning":
      return <AlertTriangle className="size-4 text-risk-yellow" />;
    default:
      return <HelpCircle className="size-4 text-scanner-muted" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: "bg-risk-green/10 text-risk-green border-risk-green/20",
    fail: "bg-risk-red/10 text-risk-red border-risk-red/20",
    warning: "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/20",
    unknown: "bg-scanner-muted/10 text-scanner-muted border-scanner-muted/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[status] || colors.unknown}`}>
      {status}
    </span>
  );
}

// ─── Section Wrapper ────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  tag,
  children,
  defaultOpen = true,
}: {
  icon: typeof ScanLine;
  title: string;
  tag?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-scanner-border bg-scanner-surface/60 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-scanner-surface/80"
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-scanner-accent/10">
          <Icon className="size-4 text-scanner-accent" />
        </div>
        <span className="flex-1 text-sm font-bold text-scanner-text">{title}</span>
        {tag && (
          <span className="rounded-md bg-scanner-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-scanner-accent">
            {tag}
          </span>
        )}
        {open ? (
          <ChevronUp className="size-4 text-scanner-muted" />
        ) : (
          <ChevronDown className="size-4 text-scanner-muted" />
        )}
      </button>
      {open && <div className="border-t border-scanner-border px-5 py-4">{children}</div>}
    </div>
  );
}

// ─── OCR Results ────────────────────────────────────────────────────────

export function OCRResults({ ocr }: { ocr: OCRResult }) {
  return (
    <Section icon={ScanLine} title="Module 1 — OCR Extraction" tag={`${ocr.confidence}% confidence`}>
      <div className="mb-3"><MockBadge module="ocr" /></div>
      {/* Detected type */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-scanner-muted">Detected type:</span>
        <span className="rounded-md bg-scanner-accent/10 px-2 py-0.5 text-xs font-bold text-scanner-accent uppercase">
          {ocr.detectedType.replace("_", " ")}
        </span>
        {ocr.mrzDetected && (
          <span className="rounded-md bg-risk-green/10 px-2 py-0.5 text-xs font-bold text-risk-green">
            MRZ Detected
          </span>
        )}
      </div>

      {/* Extracted fields */}
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ocr.fields).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-scanner-bg/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-scanner-muted">
              {key}
            </p>
            <p className="mt-0.5 text-sm font-mono text-scanner-text">{value}</p>
          </div>
        ))}
      </div>

      {/* MRZ Data */}
      {ocr.mrzData && (
        <div className="mt-4 rounded-lg bg-scanner-bg/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-scanner-muted mb-2">
            Raw MRZ
          </p>
          <pre className="text-[10px] font-mono text-scanner-text/70 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {ocr.mrzData.rawLine1}
            {"\n"}
            {ocr.mrzData.rawLine2}
          </pre>
        </div>
      )}

      {/* Warnings */}
      {ocr.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {ocr.warnings.map((w, i) => (
            <p key={i} className="text-xs text-risk-yellow flex items-start gap-2">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-scanner-muted">
        Processing time: {ocr.processingTime}ms
      </p>
    </Section>
  );
}

// ─── Validation Results ─────────────────────────────────────────────────

export function ValidationResults({ validation }: { validation: ValidationResult }) {
  return (
    <Section icon={FileSearch} title="Module 2 — Document Validation" tag={`${validation.passRate}% pass rate`}>
      <div className="mb-3"><MockBadge module="validation" /></div>
      <div className="space-y-2">
        {validation.checks.map((check) => (
          <div
            key={check.name}
            className="flex items-start gap-3 rounded-lg bg-scanner-bg/50 px-3 py-2.5"
          >
            <StatusIcon status={check.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-scanner-text">{check.name}</p>
                <StatusBadge status={check.status} />
              </div>
              <p className="mt-0.5 text-xs text-scanner-muted">{check.description}</p>
              <p className="mt-1 text-xs font-mono text-scanner-text/70">{check.details}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-scanner-muted">
        <span>Processing time: {validation.processingTime}ms</span>
        {validation.blacklistHit && (
          <span className="text-risk-red font-bold">⚠ BLACKLIST HIT</span>
        )}
        {validation.validRegistryHit && (
          <span className="text-risk-green font-bold">✓ Registry verified</span>
        )}
      </div>
    </Section>
  );
}

// ─── Tampering Results ──────────────────────────────────────────────────

export function TamperingResults({ tampering }: { tampering: TamperingResult }) {
  const scoreColor =
    tampering.overallScore < 25
      ? "text-risk-green"
      : tampering.overallScore < 50
      ? "text-risk-yellow"
      : "text-risk-red";

  return (
    <Section icon={AlertOctagon} title="Module 3 — Tampering Detection" tag={`Score: ${tampering.overallScore}/100`}>
      <div className="mb-3"><MockBadge module="tampering" /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ELA Heatmap */}
        {tampering.elaHeatmap && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-scanner-muted mb-2">
              Error Level Analysis Heatmap
            </p>
            <div className="rounded-xl border border-scanner-border overflow-hidden bg-scanner-bg">
              <img
                src={tampering.elaHeatmap}
                alt="ELA Heatmap"
                className="w-full h-auto"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-scanner-muted">
              Brighter regions indicate higher compression error — potential edit zones.
            </p>
          </div>
        )}

        {/* Sub-checks */}
        <div className="space-y-2">
          {tampering.subChecks.map((check) => (
            <div
              key={check.name}
              className="rounded-lg bg-scanner-bg/50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-scanner-text">{check.name}</p>
                <span className={`text-xs font-bold ${scoreColor}`}>
                  {check.score}/100
                </span>
              </div>
              <p className="mt-1 text-xs text-scanner-muted">{check.details}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata flags */}
      {tampering.metadataFlags.length > 0 && (
        <div className="mt-4 rounded-lg bg-risk-yellow/5 border border-risk-yellow/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-risk-yellow mb-1.5">
            Metadata Flags
          </p>
          <div className="space-y-1">
            {tampering.metadataFlags.map((flag, i) => (
              <p key={i} className="text-xs text-scanner-text/80 flex items-start gap-2">
                <AlertTriangle className="size-3 mt-0.5 shrink-0 text-risk-yellow" />
                {flag}
              </p>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-scanner-muted">
        Processing time: {tampering.processingTime}ms
      </p>
    </Section>
  );
}

// ─── Face Verification Results ──────────────────────────────────────────

export function FaceVerificationResults({
  faceVerification,
}: {
  faceVerification: FaceVerificationResult;
}) {
  const verdictConfig = {
    match: { color: "text-risk-green", bg: "bg-risk-green/10", label: "MATCH" },
    no_match: { color: "text-risk-red", bg: "bg-risk-red/10", label: "NO MATCH" },
    insufficient_data: {
      color: "text-scanner-muted",
      bg: "bg-scanner-muted/10",
      label: "INSUFFICIENT DATA",
    },
  };

  const vc = verdictConfig[faceVerification.verdict];

  return (
    <Section icon={Eye} title="Module 4 — Face Verification" tag={`${faceVerification.matchScore}% match`}>
      <div className="mb-3"><MockBadge module="faceVerification" /></div>
      <div className="flex items-center gap-4">
        <div className={`rounded-xl ${vc.bg} px-4 py-3 text-center`}>
          <p className={`text-2xl font-bold ${vc.color}`}>{faceVerification.matchScore}%</p>
          <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${vc.color}`}>
            {vc.label}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-sm text-scanner-text">{faceVerification.details}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-scanner-muted">
            <span>
              Doc face: {faceVerification.documentFaceDetected ? "✓ detected" : "✗ not found"}
            </span>
            <span>
              Live face: {faceVerification.liveFaceDetected ? "✓ detected" : "✗ not found"}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-scanner-muted">
        Processing time: {faceVerification.processingTime}ms
      </p>
    </Section>
  );
}
