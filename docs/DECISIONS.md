# Decisions

Choices the spec left open. Add a line whenever you pick the simplest option: the date, your role, the decision and why.

- **Branches:** finished work goes to `dev`, and only dtri moves `dev` to `main`, once the whole team has checked it. Nobody else pushes to `main`.
- **Pre-push hook:** `npm install` adds a hook on each person's machine. It runs `npm run check` before a push to `dev` and refuses pushes to `main`, because GitHub can't protect branches on this plan.
- **`src/core/` belongs to Role 3 (dtri),** by the team lead's decision. Requests to change it go through dtri. `src/core/balance.json` is open to everyone.
- **Main menu, content warning, Esc menu and settings are Role 1's,** built in `src/builder/`. Core holds plumbing only, with no game screens.
- **Pre-launch screen and the return and first-step cinematics are Role 4's,** because they tie into the story and the Adrift ending.
- **`ShipSpec` gaps:** `parts` have `x, y, z` so radial symmetry can be expressed, nozzles are only `sl` or `vac`, and `launch: { tempC }` carries the weather for the Cold Morning ending. See `src/core/contract.js`.
- **`flight:telemetry`** was added so the black box can record peak values, and `builder:highlightPart` was added to the event list.
