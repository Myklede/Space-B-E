# Decisions

Choices the spec left open. Add a line whenever you pick the simplest option: the date, your role, the decision and why.

- **Branches:** finished work goes to `dev`, and only dtri moves `dev` to `main`, once the whole team has checked it. Nobody else pushes to `main`.
- **Pre-push hook:** `npm install` adds a hook on each person's machine. It runs `npm run check` before a push to `dev` and refuses pushes to `main`, because GitHub can't protect branches on this plan.
- **`src/core/` belongs to Role 3 (dtri),** by the team lead's decision. Requests to change it go through dtri. `src/core/balance.json` is open to everyone.
- **Main menu, content warning, Esc menu and settings are Role 1's,** built in `src/builder/`. Core holds plumbing only, with no game screens.
- **Pre-launch screen and the return and first-step cinematics are Role 4's,** because they tie into the story and the Adrift ending.
- **`ShipSpec` gaps:** `parts` have `x, y, z` so radial symmetry can be expressed, nozzles are only `sl` or `vac`, and `launch: { tempC }` carries the weather for the Cold Morning ending. See `src/core/contract.js`.
- **`flight:telemetry`** was added so the black box can record peak values, and `builder:highlightPart` was added to the event list.
- **Δv per leg (2026-11-07, Role 2, measured with the real flight physics):** `balance.json` `deltaVKmS` is now ascent 4.1, transfer 1.0, landing 0.3, return 2.7 km/s. Ascent and landing are measured: a good gravity turn to a 95 km orbit costs about 4.1 km/s (1/10-size planets with real gravity and real air, like Kerbal's 3.4 km/s), and a chute plus a last-moment retro burn on Mars about 0.25–0.3 km/s. Return is a Mars ascent (measured 1.7) plus the transfer. The true transfer for this scale is about 2.05 km/s, but then no one-stage ship can reach Mars: the core Reliable mock has 5.74 km/s in total (its `stats.deltaV` of 8900 doesn't match its masses and Isp), and 4.1 + 2.05 + 0.3 is 6.45. So the transfer is compressed to 1.0 km/s, the same way the spec compresses distance and time. With it, the Reliable mock reaches Mars and lands with about 0.3 km/s spare when flown well. Revisit if staging or Mars refuelling arrives.
