import { listPublicUsers } from "@/lib/auth/auth-store";
import { getAllUserProgressSummaries } from "@/lib/quest/progress-store";

export type LeaderboardUser = {
  completedCards: number;
  displayName: string;
  earnedGold: number;
  earnedScore: number;
  id: string;
  login: string;
  rank: number;
  wins: number;
};

export async function getUsersLeaderboard(): Promise<LeaderboardUser[]> {
  const [users, progress] = await Promise.all([listPublicUsers(), getAllUserProgressSummaries()]);

  return users
    .filter((user) => user.role === "PLAYER")
    .map((user) => {
      const summary = progress.get(user.id) ?? { completedCards: 0, earnedGold: 0, earnedScore: 0, wins: 0 };

      return {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        completedCards: summary.completedCards,
        earnedGold: summary.earnedGold,
        earnedScore: summary.earnedScore,
        rank: 0,
        wins: summary.wins,
      };
    })
    .sort((left, right) => {
      if (right.earnedScore !== left.earnedScore) return right.earnedScore - left.earnedScore;
      if (right.earnedGold !== left.earnedGold) return right.earnedGold - left.earnedGold;
      if (right.wins !== left.wins) return right.wins - left.wins;
      return left.displayName.localeCompare(right.displayName, "ru");
    })
    .map((user, index) => ({ ...user, rank: index + 1 }));
}
