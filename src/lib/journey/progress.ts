// How far a couple has come on a journey. Shared by the server and browser.
import { LEVEL_COUNT } from "./content";

export type LevelState =
  /** Both of you finished it. */
  | "together"
  /** You finished it; waiting for your partner. */
  | "you"
  /** Your partner finished it; it's your turn. */
  | "partner"
  /** You can play it now. */
  | "open"
  /** You're a level ahead: wait for your partner first. */
  | "waiting"
  | "locked";

/**
 * Each person plays levels in order, and can be at most one level ahead of
 * the other (the database enforces the same rule in complete_level()).
 */
export function levelStates(mine: number, theirs: number): LevelState[] {
  return Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const level = i + 1;
    if (level <= mine && level <= theirs) return "together";
    if (level <= mine) return "you";
    if (level === mine + 1) {
      if (level > theirs + 1) return "waiting";
      return level <= theirs ? "partner" : "open";
    }
    return "locked";
  });
}

/** The shared scene grows with each level both of you have finished. */
export const sharedStage = (mine: number, theirs: number) =>
  Math.min(mine, theirs);

export const canPlay = (state: LevelState) =>
  state === "open" ||
  state === "partner" ||
  state === "you" ||
  state === "together";
