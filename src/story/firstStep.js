// Role 4: the story around the first step on Mars (spec §11.7). Role 2 plays the moment itself in SURFACE (the head
// bows, a boot print, "your first words on Mars") and exposes getFirstWords(). Story keeps the radio silent while it
// happens (§11.6, silence as a tool), then Earth answers the words, eleven minutes late, and only after that does HQ
// give the first EVA orders. Pure logic, no DOM: tested in firstStep.test.mjs.

/** Role 2 shows the words on screen for 4.5 s; the answer arrives after that. */
export const ANSWER_PAUSE_MS = 5500;
/** The Guidebook card opens once the radio line has been on screen for a while, so both can be read. */
export const GUIDE_DELAY_MS = 9000;

/**
 * getWords() returns the first words, or null while the moment is still playing (or a function that is missing).
 * onWords(words) runs once per mission with the words. onPlain() runs when there are no words to answer
 * (a debug start straight into SURFACE, a missing Role 2 API, or a later EVA).
 */
export function createFirstStepWatcher({ getWords, onWords, onPlain }) {
  let waiting = false;
  let answered = false;
  const read = () => {
    try {
      const w = typeof getWords === 'function' ? getWords() : null;
      return typeof w === 'string' && w.trim() ? w.trim() : null;
    } catch {
      return null;
    }
  };
  const answer = (words) => {
    answered = true;
    waiting = false;
    onWords(words);
  };
  return {
    get waiting() { return waiting; },
    get answered() { return answered; },
    /** A new mission. */
    reset() { waiting = false; answered = false; },
    /** state:changed to SURFACE. Through the airlock (from INTERIOR) the first step may be playing: wait for it. */
    surface(from) {
      if (answered) return onPlain();
      const words = read();
      if (words) return answer(words);
      if (from === 'INTERIOR' && typeof getWords === 'function') { waiting = true; return; }
      onPlain();
    },
    /** Call often while in SURFACE. */
    tick() {
      if (!waiting) return;
      const words = read();
      if (words) answer(words);
    },
    /** Left SURFACE before the words came (should not happen): ask again next time. */
    leave() { waiting = false; },
  };
}
