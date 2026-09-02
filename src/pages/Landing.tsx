import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield,
  ScanLine,
  FileSearch,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Eye,
  Lock,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const modules = [
  {
    icon: ScanLine,
    title: "OCR Extraction",
    description:
      "Machine-readable zone parsing, document type classification, and structured field extraction from passports, visas, IDs, and permits.",
    tag: "Module 1",
  },
  {
    icon: FileSearch,
    title: "Document Validation",
    description:
      "MRZ checksum verification, expiry checks, format validation, cross-field consistency, and database lookup against known registries.",
    tag: "Module 2",
  },
  {
    icon: AlertTriangle,
    title: "Tampering Detection",
    description:
      "Error Level Analysis heatmap, EXIF metadata forensics, and copy-move forgery detection with visual evidence for every finding.",
    tag: "Module 3",
  },
  {
    icon: Eye,
    title: "Face Verification",
    description:
      "Compare the document photo against a live capture to verify the holder's identity with a similarity score and match verdict.",
    tag: "Module 4",
  },
  {
    icon: Shield,
    title: "Risk Scoring",
    description:
      "Composite scoring engine that weighs all module outputs into a single Green/Yellow/Red risk verdict with full transparency.",
    tag: "Module 5",
  },
];

const stats = [
  { value: "5", label: "AI Modules" },
  { value: "<3s", label: "Scan Time" },
  { value: "7", label: "Validation Checks" },
  { value: "3", label: "Tampering Tests" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/auth?returnTo=/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-scanner-bg text-scanner-text overflow-x-hidden">
      {/* ─── Hero Section ──────────────────────────────────────── */}
      <header className="relative">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(76,141,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(76,141,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow orb */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-scanner-accent/5 blur-[120px]" />

        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-scanner-accent/15">
              <Shield className="size-5 text-scanner-accent" />
            </div>
            <span className="text-lg font-bold tracking-tight">DocScreen AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCTA}
              className="rounded-lg bg-scanner-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-scanner-accent/90 hover:shadow-[0_0_20px_rgba(76,141,255,0.3)]"
            >
              {isAuthenticated ? "Open Dashboard" : "Start Scanning"}
            </button>
          </div>
        </nav>

        <div className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center md:pt-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-scanner-border bg-scanner-surface/80 px-4 py-1.5 text-xs font-medium text-scanner-muted backdrop-blur-sm"
          >
            <span className="inline-block size-1.5 rounded-full bg-risk-green animate-pulse" />
            Smart India Hackathon 2026 — Problem SIH26188
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          >
            AI-Based Fake Identity{" "}
            <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-scanner-accent via-[#7C6BFF] to-[#35D0A6] bg-clip-text text-transparent">
              &amp; Document Screening
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-scanner-muted md:text-lg"
          >
            Upload a passport, visa, national ID, driving license, or permit.
            Our 5-module AI pipeline extracts data, validates authenticity,
            detects tampering, verifies identity, and delivers a risk verdict
            — all in under three seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <button
              onClick={handleCTA}
              className="group flex items-center gap-2.5 rounded-xl bg-scanner-accent px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(76,141,255,0.25)] transition-all hover:shadow-[0_0_40px_rgba(76,141,255,0.4)]"
            >
              <Fingerprint className="size-5" />
              Launch Document Scanner
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mx-auto mt-16 grid max-w-lg grid-cols-2 gap-6 sm:grid-cols-4"
          >
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-scanner-text">{s.value}</p>
                <p className="mt-1 text-xs text-scanner-muted">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* ─── How It Works ──────────────────────────────────────── */}
      <section className="relative border-t border-scanner-border bg-scanner-surface/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-xs font-semibold uppercase tracking-widest text-scanner-accent"
            >
              Screening Pipeline
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 text-3xl font-bold tracking-tight md:text-4xl"
            >
              Five Modules. One Verdict.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-4 max-w-xl text-sm text-scanner-muted"
            >
              Each module runs independently and produces structured output.
              Real trained models and databases can be swapped in later
              without changing the architecture.
            </motion.p>
          </motion.div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod, i) => (
              <motion.div
                key={mod.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-2xl border border-scanner-border bg-scanner-surface/60 p-6 backdrop-blur-sm transition-all hover:border-scanner-accent/40 hover:bg-scanner-surface"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-scanner-accent/10 text-scanner-accent transition-colors group-hover:bg-scanner-accent/20">
                    <mod.icon className="size-5" />
                  </div>
                  <span className="rounded-md bg-scanner-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-scanner-accent">
                    {mod.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{mod.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-scanner-muted">
                  {mod.description}
                </p>
              </motion.div>
            ))}

            {/* Architecture card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={modules.length}
              className="group relative rounded-2xl border border-dashed border-scanner-accent/30 bg-scanner-surface/40 p-6 backdrop-blur-sm transition-all hover:border-scanner-accent/50"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-risk-green/10 text-risk-green">
                  <Lock className="size-5" />
                </div>
                <span className="rounded-md bg-risk-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-green">
                  Architecture
                </span>
              </div>
              <h3 className="text-lg font-bold">Mock-First, Real-Ready</h3>
              <p className="mt-2 text-sm leading-relaxed text-scanner-muted">
                Every module exposes a clean API interface. Swap in trained
                models, real databases, and government registries without
                restructuring the application.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Risk Level Explainer ───────────────────────────────── */}
      <section className="border-t border-scanner-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-xs font-semibold uppercase tracking-widest text-scanner-accent"
            >
              Risk Verdict
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 text-3xl font-bold tracking-tight md:text-4xl"
            >
              Three-Tier Risk Classification
            </motion.h2>
          </motion.div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                level: "GREEN",
                score: "0 – 30",
                color: "text-risk-green",
                bg: "bg-risk-green/10",
                border: "border-risk-green/30",
                icon: CheckCircle2,
                desc: "Auto-clear. Document passes all checks with high confidence. No manual review needed.",
              },
              {
                level: "YELLOW",
                score: "31 – 60",
                color: "text-risk-yellow",
                bg: "bg-risk-yellow/10",
                border: "border-risk-yellow/30",
                icon: AlertTriangle,
                desc: "Manual review required. Some checks raised warnings — flag for human inspection.",
              },
              {
                level: "RED",
                score: "61 – 100",
                color: "text-risk-red",
                bg: "bg-risk-red/10",
                border: "border-risk-red/30",
                icon: AlertTriangle,
                desc: "Flagged for investigation. High tampering likelihood, blacklist hit, or multiple failures.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.level}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className={`rounded-2xl border ${item.border} bg-scanner-surface/60 p-6 backdrop-blur-sm`}
              >
                <div className={`mb-4 inline-flex items-center gap-2 rounded-lg ${item.bg} px-3 py-1.5`}>
                  <item.icon className={`size-4 ${item.color}`} />
                  <span className={`text-sm font-bold ${item.color}`}>{item.level}</span>
                </div>
                <p className="text-xs text-scanner-muted">Score {item.score}</p>
                <p className="mt-3 text-sm leading-relaxed text-scanner-text">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Footer ────────────────────────────────────────── */}
      <section className="border-t border-scanner-border bg-scanner-surface/30">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-scanner-accent/15">
              <Zap className="size-7 text-scanner-accent" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl font-bold tracking-tight md:text-4xl">
              Ready to screen a document?
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mx-auto mt-4 max-w-lg text-sm text-scanner-muted">
              Upload any identity or travel document and get a full forensic
              analysis with extracted data, validation results, tampering
              evidence, face verification, and a risk verdict.
            </motion.p>
            <motion.button
              variants={fadeUp}
              custom={3}
              onClick={handleCTA}
              className="mt-10 inline-flex items-center gap-2.5 rounded-xl bg-scanner-accent px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(76,141,255,0.25)] transition-all hover:shadow-[0_0_40px_rgba(76,141,255,0.4)]"
            >
              Start Free Scan
              <ArrowRight className="size-4" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-scanner-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-scanner-accent" />
            <span className="text-sm font-semibold">DocScreen AI</span>
          </div>
          <p className="text-xs text-scanner-muted">
            Smart India Hackathon 2026 — Ministry of Home Affairs
          </p>
        </div>
      </footer>
    </div>
  );
}
