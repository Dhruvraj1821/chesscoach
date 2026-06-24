const THRESHOLDS = {
  EXCELLENT: 10,
  GOOD: 50,
  INACCURACY: 100,
  MISTAKE: 300,
  // anything above MISTAKE threshold = blunder
};

export function classifyMove(centipawnLoss) {
  if (centipawnLoss <= THRESHOLDS.EXCELLENT) return "excellent";
  if (centipawnLoss <= THRESHOLDS.GOOD) return "good";
  if (centipawnLoss <= THRESHOLDS.INACCURACY) return "inaccuracy";
  if (centipawnLoss <= THRESHOLDS.MISTAKE) return "mistake";
  return "blunder";
}

export function isCritical(classification) {
  return classification === "blunder" || classification === "mistake";
}