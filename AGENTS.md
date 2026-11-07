# SpaceB&E: read this first

Four people are building this game at the same time, each with their own AI. Do these steps in order before writing code.

1. **Get onto `dev`:** `git fetch origin && git switch dev && git pull`. `main` only holds code the whole team has approved.
2. **Ask your human which role they have.** Never guess it.
   - Role 1: Rocket Builder
   - Role 2: Flight & Astronaut
   - Role 3: Graphics, Audio & Core
   - Role 4: Story, Cruise & Knowledge
3. **Read `README.md`** from "For AI agents: start here", then `src/core/contract.js`. Follow them. In `docs/TEAM_PROMPT.md`, read only the sections the README lists for your role.
4. **Work on your role's branch,** named in the README. It may not exist yet, so create it from `dev` the first time. Replace the stubs in your own folders and keep their exports. To test, run `npm run dev` and open `/?debug=1&state=<STATE>` to start in any state.
5. **To put finished work on `dev`:** on your role branch, run `git merge origin/dev`, then `npm run check`, fix anything it reports, and then `git push origin HEAD:dev`. Do not push until it passes.

## Never do these

- Never push to `main`, and never force-push.
- Never edit another role's folders. Ask your human instead.
- Never invent an event, state, ending, task or station name. They are all in `src/core/contract.js`. If you need a new one, stop and tell your human, because all four people must agree.
- Never change `src/core/` unless you are Role 3. `src/core/balance.json` is the exception.
- Never set `ALLOW_CONTRACT_CHANGE=1` or `ALLOW_OWNERSHIP_CHANGE=1`, or otherwise work around `npm run check`, unless your human says all four people agreed.
