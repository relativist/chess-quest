export function getMapCompletionPercent(completedCards: number, totalCards: number) {
  if (totalCards <= 0) return 0;

  return Math.min(100, Math.floor((completedCards / totalCards) * 100));
}

export function canOpenNextMapFromCards(completedCards: number, totalCards: number) {
  return totalCards > 0 && completedCards >= totalCards;
}
