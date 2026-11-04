# Four Square

A visual curriculum planner by Alberta Aligned. This working, local-first prototype connects **curriculum, time, resources, and assessment** without making teachers enter the same plan twice.

Built with React 19, TypeScript, and Vite. No API keys, account, database server, or Google account connection is needed.

## Run locally

Use **Node.js 24** (see `.node-version`) and npm:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Vite reports the selected port; its default is 5173. The existing cloud checkout is `/workspace/four-square`. Work in that checkout; cloud tasks are already isolated and do not need a separate Git worktree.

```sh
npm run lint
npm test
npm run build
npm run test:e2e
npm run format:check
```

The model suite exercises capacity, relationships, backups, dates, and safe resource links. Browser tests cover shared-card edits across views, drag scheduling, calendar changes, curriculum creation, local persistence, corrupt-backup recovery, and mobile layouts. Tests use installed `/usr/bin/chromium` when available; otherwise run `npx playwright install chromium` first. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another Chromium binary. Browser tests start a separate server on port 5174. `npm run preview -- --host 0.0.0.0` serves the production build after building.

## Try the workflow

1. Open a unit on the **Curriculum tabletop**, then an outcome to unfold its planning stack. Add, edit, or remove units and outcomes. Removing curriculum keeps the planning cards and removes only the affected connections.
2. Create or edit a planning card. Connect it to several outcomes, enter notes and assessment prompts, choose its learning stage, and attach existing resource URLs with page or slide notes.
3. Set **Calendar & timetable**: term boundaries, period length, weekly subject periods, holidays, and PD days.
4. In **Weekly planner**, drag cards from the unscheduled tray onto a teaching day or between days. Keyboard and touch users can set dates in the card editor. Dropping back in the tray clears the date. Capacity warnings are calculated per subject, not just by the daily total.
5. See the whole term and instructional capacity in **Term overview**. Open any week or card to adjust it. Calendar changes preserve cards and flag dates that need review.
6. Use **Teaching mode** to see one day's notes, assessment prompts, and original resource links. Changing a learning stage updates the shared card everywhere.
7. Export a JSON backup. Import validates the file and asks before replacing the browser's current plan.

## Data and prototype boundaries

- Plans are saved in this browser's `localStorage` under `four-square.plan.v1`. Sample data is displayed until the first change; edits then persist automatically. Storage failure is shown explicitly. Unreadable existing data is preserved until the teacher explicitly chooses recovery.
- Browser storage is specific to an origin and browser profile. There is no account, server persistence, cross-device sync, or collaboration. Back up regularly; clearing browser data removes local plans. Do not store student information.
- The starting units, outcomes, lessons, dates, and timetable are **illustrative Grade 3-inspired examples, not verified Alberta curriculum or an official district calendar**. Replace them with verified wording and actual school dates.
- The prototype has three subjects: Science, Mathematics, and Language Arts. It models one term at a time, five-day weeks, and a common period length. Recurring multiweek timetables, other subjects, monthly views, and multiple classes are future work.
- Resource attachments store a URL, title, kind, and selection note. Google file IDs can be recognized from URLs. Files are never fetched, moved, renamed, or edited. Existing permissions still apply; unavailable-file detection is not implemented. Page and slide notes do not extract pages or automatically navigate into a file.
- There is no Google OAuth/Picker integration, PDF Print Pack, slideshow generation, AI processing, publisher integration, or automatic pacing. These are explicitly deferred, not simulated.
- The current app has been built and tested here. No public deployment or fresh-environment restoration is implied.

Read [the founder's vision](docs/founders-vision.md) and [the product blueprint](docs/product-blueprint.md) for the reasoning and next phases.

## Publish a GitHub Pages preview

The `main` branch contains source. The `gh-pages` branch contains only the built site. The `Publish web preview` workflow rebuilds and updates that branch after source changes to `main`; it can also be run manually from GitHub Actions. Relative asset paths let the same build run at the repository's Pages subpath.

For the first publication, open the repository's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **gh-pages** and **/ (root)**, and save. GitHub then builds and publishes the static site. Once GitHub reports success, the expected URL is `https://reneeolafson-cell.github.io/four-square/`. This URL is a target until GitHub has successfully enabled and published Pages.

This is a public app preview. Plans remain in each visitor's own browser; deploying the app does not upload local plans. The new hosted origin starts with sample cards, not plans saved on the development origin. Export/import a backup to transfer a plan.

The initial publish workflow may need a rerun if it started before the `gh-pages` branch existed. Future source pushes update the branch without rewriting its history. The workflow needs repository Actions to be enabled and its requested contents-write permission to be permitted by repository policy.
