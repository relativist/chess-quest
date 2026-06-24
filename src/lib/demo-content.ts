export type { DemoQuestCardSeed as QuestCard, Difficulty } from "./demo-seed";
export { demoMapSeed, demoMapSeeds, getCardStartingFen, getDemoCardBySlug, validateDemoSeedData } from "./demo-seed";
export { difficultyLabel, difficultyStars, getEngineDifficulty, starsForDifficulty } from "@/lib/chess/engine-difficulty";

import { demoMapSeed } from "./demo-seed";

export const demoCards = demoMapSeed.cards;
