export const NEXT_MAP_UNLOCK_PERCENT = 90;

export function getMapCompletionPercent(earnedScore: number, maxScore: number) {
  if (maxScore <= 0) return 0;

  return Math.min(100, Math.floor((earnedScore / maxScore) * 100));
}

export function canOpenNextMapFromScores(earnedScore: number, maxScore: number) {
  return getMapCompletionPercent(earnedScore, maxScore) >= NEXT_MAP_UNLOCK_PERCENT;
}
