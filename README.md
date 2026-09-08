# AI-Based Fake Identity & Document Screening System

**Smart India Hackathon 2026** — Problem Statement SIH26188  
**Ministry of Home Affairs** — Software Category

A functional web application prototype that lets users upload identity/travel documents, runs them through a 5-module AI screening pipeline, and returns a structured risk report with extracted data, validation results, tampering-detection evidence, face-match score, and a final Green/Yellow/Red risk verdict.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + Shadcn UI
- **Backend:** Convex (database + auth)
- **AI/ML:** TensorFlow.js (tampering CNN), face-api.js (face verification), Tesseract.js (OCR)
- **Animations:** Framer Motion
- **Package Manager:** Bun

## Architecture

### Mock-First, Real-Ready Design

Every detection module is implemented behind a clean function API interface. Each currently contains working logic with real libraries where feasible (Tesseract.js OCR, face-api.js ArcFace, TensorFlow.js CNN), marked with `// TODO: replace with trained model / real DB` for easy swapping when trained models become available.

### 5 Detection Modules

| Module | File | Description |
|--------|------|-------------|
| **M1 — OCR Extraction** | `src/lib/modules/ocr.ts` | Tesseract.js OCR with ICAO 9303 MRZ parser, document type detection, field extraction |
| **M2 — Document Validation** | `src/lib/modules/validation.ts` | MRZ checksum validation, expiry checks, DOB plausibility, blacklist/registry lookup |
| **M3 — Tampering Detection** | `src/lib/modules/tampering.ts` | ELA heatmap, EXIF metadata forensics, copy-move forgery detection, CNN patch classification |
| **M4 — Face Verification** | `src/lib/modules/face-verify.ts` | face-api.js TinyFaceDetector + ArcFace 128-d embeddings, cosine similarity matching |
| **M5 — Risk Scoring** | `src/lib/modules/risk-score.ts` | Weighted composite scoring → Green (0–30) / Yellow (31–60) / Red (61–100) verdict |

### Supporting Files

| File | Purpose |
|------|---------|
| `src/lib/tampering-cnn.ts` | Tampering detection CNN: synthetic data generator, 4-block CNN architecture, in-browser training |
| `src/lib/model-status.ts` | Central mock/real status tracker for UI badges |
| `src/lib/pipeline.ts` | Orchestrator that runs all 5 modules sequentially with progress callbacks |
| `src/lib/mock-db.ts` | Mock database with sample valid/blacklisted documents |
| `src/lib/types.ts` | Shared TypeScript types for all modules |

### Model Files

Pre-trained face-api.js models are in `public/models/face-api/`:
- TinyFaceDetector (face detection)
- FaceRecognitionNet (128-d ArcFace embeddings)
- FaceLandmark68TinyNet (68-point landmarks)

The tampering CNN trains in-browser via IndexedDB and persists across sessions.

### Component Structure

```
src/
├── assets/              # Static assets (logo)
├── components/
│   ├── scanner/         # Scanner UI (ModuleResults, RiskVerdict, ScanProgress)
│   ├── ui/              # Shadcn UI primitives (40+ components)
│   ├── LogoDropdown.tsx
│   └── RequireAuth.tsx  # Auth route guard
├── convex/              # Convex backend (auth, users, schema)
├── hooks/               # Custom React hooks (use-auth, use-mobile)
├── lib/
│   ├── modules/         # 5 detection modules
│   ├── model-status.ts  # Mock/real status tracking
│   ├── tampering-cnn.ts # CNN model (train + infer)
│   ├── pipeline.ts      # Module orchestrator
│   ├── mock-db.ts       # Mock database
│   ├── types.ts         # Shared types
│   └── utils.ts         # Utility functions
├── pages/               # Route pages (Landing, Auth, Dashboard, NotFound)
├── types/               # Global type declarations
├── main.tsx             # App entry point
└── index.css            # Global styles + Tailwind config
```

## Setup

```bash
# Install dependencies
bun install

# Start development server (runs automatically on Freebuff)
bun run dev
```

## Environment Variables

The project uses Convex for backend/database. Environment variables are managed through the Keys/API keys UI in the Freebuff platform.

- `CONVEX_DEPLOYMENT` / `VITE_CONVEX_URL` — Convex connection (client)
- Convex backend has separate auth keys (JWKS, JWT_PRIVATE_KEY, SITE_URL)

## Training the Tampering CNN

The tampering detection CNN can be trained entirely in-browser:

1. Navigate to the Dashboard
2. Click "Train CNN Model" button
3. The system generates 800 synthetic patches (400 genuine + 400 tampered)
4. Trains for 15 epochs with precision/recall/F1 tracking
5. Model persists in IndexedDB across sessions

## Key Features

- **Drag-and-drop document upload** with live photo capture
- **Real-time module-by-module progress** during scanning
- **Visual tampering evidence** with ELA heatmap display
- **Editable OCR fields** for manual verification/correction
- **Mock-mode badges** in UI when models haven't loaded yet
- **Graceful degradation** — missing model weights fall back to mock logic per-module

## License

Built for Smart India Hackathon 2026.
