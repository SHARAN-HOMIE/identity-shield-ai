/**
 * Central model status tracker.
 *
 * Each module updates its status after attempting to load real models.
 * The UI reads this to display "using mock data" badges.
 * This avoids changing any module return types or function signatures.
 */

export type ModuleStatus = "loading" | "real" | "mock";

interface ModelStatusState {
  ocr: ModuleStatus;
  validation: ModuleStatus;
  tampering: ModuleStatus;
  faceVerification: ModuleStatus;
  riskScoring: ModuleStatus;
}

const state: ModelStatusState = {
  ocr: "loading",
  validation: "loading",
  tampering: "loading",
  faceVerification: "loading",
  riskScoring: "loading",
};

const listeners = new Set<() => void>();

export function getModuleStatus(): Readonly<ModelStatusState> {
  return state;
}

export function setModuleStatus(
  module: keyof ModelStatusState,
  status: ModuleStatus
): void {
  if (state[module] !== status) {
    state[module] = status;
    listeners.forEach((l) => l());
  }
}

export function onModuleStatusChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Check if all modules have finished loading */
export function allModulesReady(): boolean {
  return Object.values(state).every((s) => s !== "loading");
}

/** Check if any module is using mock data */
export function hasMockModules(): boolean {
  return Object.values(state).some((s) => s === "mock");
}

/** Get the list of modules currently in mock mode */
export function getMockModules(): string[] {
  return Object.entries(state)
    .filter(([, s]) => s === "mock")
    .map(([k]) => k);
}
