// Pure decisions for the PRELAUNCH ritual (no DOM, no core imports, so Node can test it).

/**
 * Can the player skip the ritual and go straight to the countdown?
 * visits = how many times PRELAUNCH has been entered this session (1 on the first).
 * Yes from the 2nd visit in this session.
 */
export function canQuickStart({ visits = 1 } = {}) {
  return visits >= 2;
}

/** What the next state receives. Role 2's LAUNCH reads data.quickStart to skip its own Phase 0 steps. */
export const quickStartData = () => ({ quickStart: true });

/** The text that is saved and sent: the player's words, or the default. */
export const finalMessage = (text, fallback) => (String(text ?? '').trim() || fallback);

/** Wrap-around photo selection for arrow keys. */
export const stepIndex = (index, delta, count) => (index + delta + count) % count;
