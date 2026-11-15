# Four Square

A visual curriculum planner by Alberta Aligned. This working, local-first prototype connects **curriculum, time, resources, and assessment** without making teachers enter the same plan twice.

Built with React 19, TypeScript, and Vite. No account is required to plan. Optional Google sign-in shows your Google profile; plans remain in this browser.

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
- Browser storage is specific to an origin and browser profile. Google sign-in does not add server persistence, cross-device sync, or collaboration. Back up regularly; clearing browser data removes local plans. Do not store student information.
- The starting units, outcomes, lessons, dates, and timetable are **illustrative Grade 3-inspired examples, not verified Alberta curriculum or an official district calendar**. Replace them with verified wording and actual school dates.
- The prototype has three subjects: Science, Mathematics, and Language Arts. It models one term at a time, five-day weeks, and a common period length. Recurring multiweek timetables, other subjects, monthly views, and multiple classes are future work.
- Resource attachments store a URL, title, kind, and selection note. Google file IDs can be recognized from URLs. Files are never fetched, moved, renamed, or edited. Existing permissions still apply; unavailable-file detection is not implemented. Page and slide notes do not extract pages or automatically navigate into a file.
- There is no Google Drive/Picker integration, PDF Print Pack, slideshow generation, AI processing, publisher integration, or automatic pacing. These are explicitly deferred, not simulated.
- The current app has been built and tested here. No public deployment or fresh-environment restoration is implied.

Read [the founder's vision](docs/founders-vision.md) and [the product blueprint](docs/product-blueprint.md) for the reasoning and next phases.

## Publish a GitHub Pages preview

The `main` branch contains source. The `Publish web preview` workflow builds and deploys it with the official GitHub Pages artifact/deployment actions. Relative asset paths let the build run at the repository's Pages subpath. An initial built-site snapshot is also available on `gh-pages`; the workflow deploys fresh artifacts rather than using that branch.

For the first publication:

1. Open the repository's **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
2. Open **Actions → Publish web preview → Run workflow** and run it on `main`. A workflow started before Pages was enabled may need to be rerun.
3. Wait for the job to succeed. Its deployment link is the confirmed live address. The expected URL is `https://reneeolafson-cell.github.io/four-square/`; it is only a target until GitHub successfully publishes Pages.

Subsequent pushes to `main` rebuild and deploy automatically. Repository policy must allow Actions and Pages, including the requested Pages-write and identity-token permissions. No hosting credential is stored in the project; GitHub provides the job's short-lived token.

This is a public app preview. Plans remain in each visitor's own browser; deploying the app does not upload local plans. The hosted origin starts with sample cards, not plans saved on the development origin. Export/import a backup to transfer a plan.

## Enable Google login

1. In Google Cloud Console, configure the Google Auth Platform consent screen and create an OAuth client with application type **Web application**. Configure the audience and test users as needed.
2. Add the app's exact origins to **Authorized JavaScript origins**, for example `http://localhost:5173` and `https://reneeolafson-cell.github.io`. Origins have no path; do not add `/four-square/`. This popup flow does not need a redirect URI.
3. Copy `.env.example` to `.env.local`, set `VITE_GOOGLE_CLIENT_ID` to the web client ID, and restart Vite. Never add a client secret to the browser app.
4. For GitHub Pages, set the repository Actions **variable** `VITE_GOOGLE_CLIENT_ID` and rerun the publishing workflow. Vite embeds this public ID at build time.

The Google Identity Services popup requests only `openid email profile`. The app retrieves your profile from Google's authenticated userinfo endpoint. Access tokens are used transiently and are never saved to browser storage. The displayed session ends on sign-out, reload, or expiry. Signing out clears the app's profile without signing you out of Google or deleting local plans. This is optional browser profile sign-in, not server-side authorization: no backend or protected account data exists yet. A future server must validate identity independently before serving private data.

Without a configured client ID, the sign-in button explains the setup requirement. Real Google sign-in requires a valid client ID and authorized origin; automated tests use a mocked Google response.
