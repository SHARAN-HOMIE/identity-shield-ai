import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Upload,
  Camera,
  X,
  LogOut,
  Clock,
  History,
  ChevronLeft,
  FileText,
  Trash2,
} from "lucide-react";
import { runPipeline, type PipelineProgress } from "@/lib/pipeline";
import { ScanProgress } from "@/components/scanner/ScanProgress";
import { RiskVerdict } from "@/components/scanner/RiskVerdict";
import {
  OCRResults,
  ValidationResults,
  TamperingResults,
  FaceVerificationResults,
} from "@/components/scanner/ModuleResults";
import type { ScanResult, AuditEntry } from "@/lib/types";
import {
  storeScanResult,
  getAuditTrail,
  getScanResult,
  clearAuditTrail,
} from "@/lib/mock-db";

type View = "upload" | "scanning" | "results" | "history";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const [progress, setProgress] = useState<PipelineProgress[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(getAuditTrail());
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported file type. Please upload JPG, PNG, WebP, or PDF.");
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    if (file.type !== "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleLivePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setLivePhoto(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleScan = async () => {
    if (!selectedFile) return;

    setView("scanning");
    setProgress([]);
    setError(null);

    try {
      const result = await runPipeline(
        selectedFile,
        livePhoto,
        (p) => setProgress((prev) => {
          // Update or add progress entry
          const idx = prev.findIndex((x) => x.module === p.module);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = p;
            return updated;
          }
          return [...prev, p];
        })
      );

      setScanResult(result);
      storeScanResult(result);
      setAuditTrail(getAuditTrail());
      setView("results");
    } catch (err) {
      console.error("Scan failed:", err);
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
      setView("upload");
    }
  };

  const resetScan = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setLivePhoto(null);
    setProgress([]);
    setScanResult(null);
    setError(null);
    setView("upload");
  };

  const viewHistoryItem = (entry: AuditEntry) => {
    const fullResult = getScanResult(entry.id);
    if (fullResult) {
      setScanResult(fullResult);
      setSelectedFile(null);
      setPreviewUrl(fullResult.originalImage);
      setView("results");
    }
  };

  return (
    <main className="min-h-screen bg-scanner-bg text-scanner-text">
      {/* ─── Top Bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-scanner-border bg-scanner-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-scanner-accent/15">
              <Shield className="size-4 text-scanner-accent" />
            </div>
            <span className="text-sm font-bold">DocScreen AI</span>
            {view === "results" && (
              <button
                onClick={resetScan}
                className="ml-3 flex items-center gap-1.5 rounded-lg border border-scanner-border px-3 py-1.5 text-xs text-scanner-muted transition-colors hover:border-scanner-accent/40 hover:text-scanner-text"
              >
                <ChevronLeft className="size-3" />
                New Scan
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAuditTrail(getAuditTrail());
                setView("history");
              }}
              className="flex items-center gap-1.5 rounded-lg border border-scanner-border px-3 py-1.5 text-xs text-scanner-muted transition-colors hover:border-scanner-accent/40 hover:text-scanner-text"
            >
              <History className="size-3" />
              History
            </button>
            <span className="text-xs text-scanner-muted hidden sm:block">
              {user?.name || user?.email || "User"}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-scanner-border px-3 py-1.5 text-xs text-scanner-muted transition-colors hover:border-scanner-accent/40 hover:text-scanner-text"
            >
              <LogOut className="size-3" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Content ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ─── Upload View ──────────────────────────────────── */}
        {view === "upload" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Document Scanner</h1>
              <p className="mt-1 text-sm text-scanner-muted">
                Upload an identity or travel document for forensic analysis.
              </p>
            </div>

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all ${
                selectedFile
                  ? "border-scanner-accent/50 bg-scanner-surface/60"
                  : "border-scanner-border bg-scanner-surface/30 hover:border-scanner-accent/40 hover:bg-scanner-surface/50"
              } p-12 text-center`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="mx-auto max-h-64 rounded-xl border border-scanner-border object-contain"
                  />
                  <p className="text-sm text-scanner-text font-medium">{selectedFile?.name}</p>
                  <p className="text-xs text-scanner-muted">
                    {selectedFile && `${(selectedFile.size / 1024).toFixed(1)} KB`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-scanner-accent/10 text-scanner-accent transition-colors group-hover:bg-scanner-accent/15">
                    <Upload className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-scanner-text">
                    Drop a document here or click to browse
                  </p>
                  <p className="text-xs text-scanner-muted">
                    Supports passport, visa, national ID, driving license, or permit (JPG, PNG, WebP, PDF)
                  </p>
                </div>
              )}
            </div>

            {/* Live photo (optional) */}
            <div className="rounded-2xl border border-scanner-border bg-scanner-surface/40 p-5">
              <div className="flex items-center gap-3">
                <Camera className="size-5 text-scanner-accent" />
                <div>
                  <p className="text-sm font-medium text-scanner-text">
                    Live Photo (Optional)
                  </p>
                  <p className="text-xs text-scanner-muted">
                    Upload a live photo to compare against the document photo for face verification.
                  </p>
                </div>
              </div>

              {livePhoto ? (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={livePhoto}
                    alt="Live photo"
                    className="size-16 rounded-lg border border-scanner-border object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-risk-green font-medium">✓ Live photo loaded</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLivePhoto(null);
                    }}
                    className="flex size-7 items-center justify-center rounded-lg bg-scanner-bg text-scanner-muted transition-colors hover:text-risk-red"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="mt-3 w-full rounded-xl border border-dashed border-scanner-border bg-scanner-bg/50 px-4 py-3 text-xs text-scanner-muted transition-colors hover:border-scanner-accent/40 hover:text-scanner-text"
                >
                  Click to upload live photo
                </button>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLivePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-risk-red/30 bg-risk-red/5 px-4 py-3 text-sm text-risk-red">
                {error}
              </div>
            )}

            {/* Scan button */}
            <Button
              onClick={handleScan}
              disabled={!selectedFile}
              className="w-full rounded-xl bg-scanner-accent py-6 text-base font-semibold text-white shadow-[0_0_30px_rgba(76,141,255,0.2)] transition-all hover:shadow-[0_0_40px_rgba(76,141,255,0.35)] disabled:opacity-40 disabled:shadow-none"
            >
              <Shield className="mr-2 size-5" />
              Run Full Screening Pipeline
            </Button>
          </div>
        )}

        {/* ─── Scanning View ─────────────────────────────────── */}
        {view === "scanning" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Scanning Document...</h1>
              <p className="mt-1 text-sm text-scanner-muted">
                Running all 5 modules on {selectedFile?.name}
              </p>
            </div>

            {/* Scanning animation */}
            <div className="relative rounded-2xl border border-scanner-border bg-scanner-surface/60 p-8 overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="scan-line absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-scanner-accent to-transparent" />
              </div>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Document being scanned"
                  className="mx-auto max-h-48 rounded-xl border border-scanner-border object-contain opacity-60"
                />
              )}
            </div>

            <ScanProgress progress={progress} />

            <p className="text-center text-xs text-scanner-muted">
              This may take a few seconds while all modules process the document...
            </p>
          </div>
        )}

        {/* ─── Results View ──────────────────────────────────── */}
        {view === "results" && scanResult && (
          <div className="space-y-6">
            {/* Header with document info */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Scan Results</h1>
                <div className="mt-1 flex items-center gap-3 text-xs text-scanner-muted">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3" />
                    {scanResult.fileName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(scanResult.timestamp).toLocaleString()}
                  </span>
                  <span className="rounded-md bg-scanner-accent/10 px-2 py-0.5 text-[10px] font-bold text-scanner-accent uppercase">
                    {scanResult.documentType.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-scanner-muted">
                  Total: {scanResult.totalTime}ms
                </span>
              </div>
            </div>

            {/* Document preview + Risk Verdict side by side */}
            <div className="grid gap-6 lg:grid-cols-3">
              {previewUrl && (
                <div className="lg:col-span-1">
                  <div className="sticky top-20 rounded-2xl border border-scanner-border bg-scanner-surface/60 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-scanner-muted mb-2">
                      Original Document
                    </p>
                    <img
                      src={previewUrl}
                      alt="Original document"
                      className="w-full rounded-xl border border-scanner-border object-contain"
                    />
                  </div>
                </div>
              )}
              <div className={previewUrl ? "lg:col-span-2" : "lg:col-span-3"}>
                <RiskVerdict riskScore={scanResult.riskScore} />
              </div>
            </div>

            {/* Module Results */}
            <OCRResults ocr={scanResult.ocr} />
            <ValidationResults validation={scanResult.validation} />
            <TamperingResults tampering={scanResult.tampering} />
            <FaceVerificationResults faceVerification={scanResult.faceVerification} />

            {/* New scan button */}
            <Button
              onClick={resetScan}
              variant="outline"
              className="w-full rounded-xl border-scanner-border py-5 text-sm text-scanner-muted hover:border-scanner-accent/40 hover:text-scanner-text"
            >
              Scan Another Document
            </Button>
          </div>
        )}

        {/* ─── History View ──────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
                <p className="mt-1 text-sm text-scanner-muted">
                  {auditTrail.length} scan{auditTrail.length !== 1 ? "s" : ""} recorded
                </p>
              </div>
              <div className="flex items-center gap-2">
                {auditTrail.length > 0 && (
                  <button
                    onClick={() => {
                      clearAuditTrail();
                      setAuditTrail([]);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-risk-red/30 px-3 py-1.5 text-xs text-risk-red transition-colors hover:bg-risk-red/10"
                  >
                    <Trash2 className="size-3" />
                    Clear All
                  </button>
                )}
                <button
                  onClick={resetScan}
                  className="flex items-center gap-1.5 rounded-lg border border-scanner-border px-3 py-1.5 text-xs text-scanner-muted transition-colors hover:border-scanner-accent/40 hover:text-scanner-text"
                >
                  <ChevronLeft className="size-3" />
                  Back
                </button>
              </div>
            </div>

            {auditTrail.length === 0 ? (
              <div className="rounded-2xl border border-scanner-border bg-scanner-surface/40 p-12 text-center">
                <History className="mx-auto size-10 text-scanner-muted/50" />
                <p className="mt-3 text-sm text-scanner-muted">No scans yet</p>
                <p className="mt-1 text-xs text-scanner-muted/60">
                  Scan a document to see it appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditTrail.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => viewHistoryItem(entry)}
                    className="flex w-full items-center gap-4 rounded-xl border border-scanner-border bg-scanner-surface/40 p-4 text-left transition-all hover:border-scanner-accent/30 hover:bg-scanner-surface/60"
                  >
                    <img
                      src={entry.thumbnail}
                      alt={entry.fileName}
                      className="size-12 rounded-lg border border-scanner-border object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-scanner-text truncate">
                        {entry.fileName}
                      </p>
                      <p className="text-xs text-scanner-muted">
                        {new Date(entry.timestamp).toLocaleString()} •{" "}
                        {entry.documentType.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          entry.riskLevel === "green"
                            ? "bg-risk-green/10 text-risk-green"
                            : entry.riskLevel === "yellow"
                            ? "bg-risk-yellow/10 text-risk-yellow"
                            : "bg-risk-red/10 text-risk-red"
                        }`}
                      >
                        {entry.riskLevel}
                      </span>
                      <p className="mt-0.5 text-xs text-scanner-muted">
                        Score: {entry.compositeScore}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
