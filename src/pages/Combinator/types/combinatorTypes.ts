export interface Combination {
  id: number;
  patternName: string;
  slots: string[];
}

export const MAX_COMBINATION_SLOTS = 10;

let combinationIdCounter = 0;

export function nextCombinationId(): number {
  combinationIdCounter += 1;
  return combinationIdCounter;
}

export function emptySlots(): string[] {
  return Array(MAX_COMBINATION_SLOTS).fill('');
}
