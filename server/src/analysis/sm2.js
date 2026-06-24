/**
 * SM-2 Spaced Repetition Algorithm
 *
 * quality: 0-5 rating of how well the user recalled the answer
 *   0-1: complete failure (didn't solve)
 *   2:   solved with significant difficulty
 *   3:   solved with some difficulty
 *   4:   solved correctly with minor hesitation
 *   5:   solved perfectly
 *
 * Returns updated { easeFactor, intervalDays, nextDueAt }
 */
export function calculateNextReview({ easeFactor, intervalDays, quality }) {
  // Clamp quality to 0-5
  quality = Math.max(0, Math.min(5, quality));

  let newEaseFactor = easeFactor;
  let newIntervalDays = intervalDays;

  if (quality < 3) {
    // Failed review — reset interval, keep ease factor
    newIntervalDays = 0;
  } else {
    // Successful review — advance interval
    if (intervalDays === 0) {
      newIntervalDays = 1;
    } else if (intervalDays === 1) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.round(intervalDays * newEaseFactor);
    }
  }

  // Update ease factor based on performance quality
  // SM-2 formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ease factor floor at 1.3 (SM-2 spec)
  newEaseFactor = Math.max(1.3, newEaseFactor);

  // Calculate next due date
  const nextDueAt = new Date();
  nextDueAt.setDate(nextDueAt.getDate() + newIntervalDays);

  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100, // round to 2dp
    intervalDays: newIntervalDays,
    nextDueAt,
  };
}

/**
 * Maps puzzle solve outcome to SM-2 quality score
 * solved: whether the user got the correct answer
 * attempts: how many tries it took
 * timeTakenSeconds: how long they spent
 */
export function outcomeToQuality({ solved, attempts, timeTakenSeconds }) {
  if (!solved) return 1; // failed

  if (attempts === 1 && timeTakenSeconds < 10) return 5; // perfect
  if (attempts === 1 && timeTakenSeconds < 30) return 4; // good
  if (attempts === 1) return 3;                          // solved but slow
  if (attempts === 2) return 2;                          // needed a hint
  return 1;                                              // multiple attempts = near-fail
}