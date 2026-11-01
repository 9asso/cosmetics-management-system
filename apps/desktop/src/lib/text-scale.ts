export const textScaleSteps = [0.9, 1, 1.1, 1.2, 1.3, 1.4];
export const defaultTextScale = 1;

const textScaleStorageKey = "onight-text-scale";

function textScaleStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readTextScale() {
  try {
    const saved = Number(textScaleStorage()?.getItem(textScaleStorageKey));
    return textScaleSteps.includes(saved) ? saved : defaultTextScale;
  } catch {
    return defaultTextScale;
  }
}

export function applyTextScale(scale: number) {
  document.documentElement.style.setProperty("--ui-text-scale", String(scale));
}

export function saveTextScale(scale: number) {
  applyTextScale(scale);
  try {
    textScaleStorage()?.setItem(textScaleStorageKey, String(scale));
  } catch {
    // The chosen size still applies until the app is closed.
  }
}

export function nextTextScale(scale: number, direction: 1 | -1) {
  const index = textScaleSteps.indexOf(scale);
  const next = (index < 0 ? textScaleSteps.indexOf(defaultTextScale) : index) + direction;
  return textScaleSteps[Math.min(textScaleSteps.length - 1, Math.max(0, next))]!;
}
