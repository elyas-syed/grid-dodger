# Public release validation — October 23, 2026

The clean source export passed **68 Node tests and 7 Lambda tests (75 total)**, including a static Pages build/asset-graph check under a project URL prefix. The initial release used a 60-second captioned draft; the owner then supplied an approximately 80-second replacement with audio (79.553 seconds, 1920 × 1080, 60 FPS). Decoded samples confirm non-silent audio. Local browser review of the initial release confirmed the recorded video loads correctly, plays with native controls, and the page has no horizontal overflow or broken visible images at desktop and 390-pixel phone widths. The static showcase makes no live inference calls.

The original private project and recording stack were validated previously; this release does not claim a fresh CPU/CUDA install or a new live 500-point win. AWS was removed after recording. Existing historical evidence below is retained for context.

---

# Clean rebuild and validation — 2026-10-16

## Current state — full teardown on 2026-10-17

The explicitly authorized teardown completed: **55 resources destroyed**, empty Terraform state, GPU terminated and attached root disk deleted. A fresh AWS audit found no project compute, networking, public IP allocations, storage, ECR images, build services, endpoints, WAF, logs, IAM roles or task revisions remaining. The demo is offline. Repository and local article assets are preserved. Detailed private evidence is stored in ignored docs-local/teardown-2026-10-17/. The rebuild and live validation records below are historical.

Date uses America/Chicago. The user explicitly authorized the full project teardown/rebuild and submission improvements, excluded video, and required keeping the repository private.

## Initial rebuild outcome

Historical deployment validated during development; that temporary endpoint has since been removed. See the recorded showcase and local setup guide for current access.

At completion of the rebuild, the previous CloudFront domain was destroyed and the Terraform plan reported no drift. ECS has one healthy running GPU task, zero pending tasks, and a completed deployment. CloudFront is deployed. Health reports CUDA and the expected Decider checkpoint.

GitHub CLI verified `isPrivate=true`, `visibility=PRIVATE`. At this rebuild checkpoint no commit or push had been performed. A later user-authorized Git checkpoint is recorded below. Repository visibility was unchanged; the article remains an unpublished draft and no video was produced.

## Full teardown evidence

- Inspected destroy plan and completed deletion of 54 Terraform-managed resources. Terraform state became empty.
- Removed the pre-management Lambda log group and requested deletion of five inactive task-definition revisions; no active old revisions remained. AWS controls historical task/revision record retention.
- The old GPU remained shutting-down after workloads stopped. A supported force-termination request targeted that disposable instance only; it reached terminated.
- Audit before bootstrap found zero project ECS clusters, ECR repositories, S3 buckets, ALBs, Lambdas, CloudFront distributions, CodeBuild projects, HTTP APIs, VPCs, ASGs, log groups, IAM roles, WAF ACLs, and active task revisions.
- EC2 inventory then had zero allocated Elastic IPs and zero EBS volumes. Unrelated account budgets were not deleted.

## Clean build evidence

- Clean `npm ci` installed locked dependencies; npm audit reported zero vulnerabilities.
- Bootstrap inspected and created 55 new managed resources at desired_count=0. The extra managed resource is the Lambda log group, now included in retention and teardown.
- `make build-image` invoked the new CodeBuild project with `--pull --no-cache` and an empty ECR repository.
- Build succeeded from 20:03:04 to 20:08:32 America/Chicago, approximately 5m28s.
- New image digest: `sha256:08bc86e590604b97041d6ddf72f02c6fe9aeb91565fd67e265332e7e4d916095`; compressed bytes: 3,425,054,894.
- Build fingerprint: Decider 0.1.0, Torch 2.7.1+cu126, Transformers 5.20.1, PEFT 0.21.2, Accelerate 1.15.0. See `benchmarks/BUILD.json` and `built-requirements.txt`.
- `make infra-apply PLAN=rebuild-run.tfplan` applied the inspected digest-pinned task and scaled ECS/ASG to one. Apply waited for ECS stability.
- `make sync-ui` published only browser-required assets and modules and derived the hosted link from Terraform outputs. Private docs, article, benchmark reports, state, environment files, and the server-only recap module are excluded.

## Automated checks at the initial rebuild

| Check | Result |
|---|---|
| Node engine/controller/tool/recap/launcher/local-server tests | 36 passed |
| Lambda origin/grounding/input tests | 5 passed |
| Live GPU movement regressions | 4 passed |
| Generic recipe example | Offline passed; live selected lookup with option probability 0.8793 |
| Hosted smoke | Passed assets/MIME types, root redirect, CUDA health, invalid input, private-path denial, direct API origin denial, direct ALB denial, and real Bedrock recaps for all three modes |
| Terraform | Validate and format passed; final plan exited 0, no changes |
| Syntax and whitespace | JavaScript/shell syntax and git diff whitespace checks passed |

The final account inspection confirmed the task is using the new image digest. WAF is attached with a 1,000-request/IP/300-second dynamic-request limit; recap API rate is 2/sec, burst 5. Configuration was inspected; no public-endpoint stress test was performed.

## Browser checks

Human right-arrow movement registered and a score-15 game-over produced a real Bedrock recap. Autonomous HTTP mode moved both left and right, completed a 75-tick run, and automatically produced a real Bedrock recap. Shadow mode displayed the yellow target and separate model reliability, and logged a right-move suggestion at tick 10 with option probability 0.96. Reset during an in-flight shadow request returned the board to ready/score 0. A final label overlap was corrected and republished.

Browser screenshots are local validation evidence, not a video or public publication.

## Reproducible benchmark

| Controller | Avoidable collisions | Capped mean ticks | Capped runs / 5 | Snapshot median / p95 ms |
|---|---:|---:|---:|---:|
| heuristic | 0/31 | 44.8 | 2 | 0.02 / 0.10 |
| original | 17/31 | 24.2 | 0 | 354.66 / 384.74 |
| grounded | 0/31 | 51.0 | 4 | 422.06 / 519.09 |

The complete run exited 0 with no model-request errors. Forty fixed snapshots included 31 avoidable and nine unavoidable boards. Episodes used five fixed spawn seeds and a 60-tick cap; model inference was not seeded. Latencies in this table compare only the same fixed snapshots. The local heuristic timing is computation, not HTTP inference.

Grounding improved this sample's collision outcomes while increasing request latency. The heuristic also avoided every avoidable snapshot collision. Five capped episodes are exploratory and do not establish general superiority. There is no measured frontier-model baseline or monetary savings claim. See `benchmarks/results/REPORT.md` and raw `report.json`.

## Operational limits

The GPU remains running for the rebuilt demo and continues incurring usage. Scaling desired_count to zero stops GPU capacity but leaves other infrastructure charges; full destroy removes the stack. Request limits and budgets are not automatic spending caps.

The HF checkpoint identifier is recorded, but its repository revision is not pinned. Installed dependency fingerprints improve traceability but are not a portable lockfile. The recap screen catches specific unsupported mechanics and length violations, not every possible factual error. Staying below a probability threshold is a fallback, not a guarantee of safety.


## Gameplay feedback deployment — 2026-10-16

Updated UI and recap Lambda using `make infra-apply PLAN=game-feedback.tfplan` (0 adds, 1 Lambda update, 0 destroys) and `make sync-ui`. Existing ECR image and GPU task reused.

Validation:

- Local Node/Lambda tests cover preserved shadow card/metrics during pending inference, the 500-point goal and its boundary, stop during pending inference, separate last-three histories, exclusion of Shadow runs, stale recap cancellation, normalized outcomes, and real handler prompt/response wiring.
- Hosted smoke suite passed: static assets, CUDA health, private-path/origin restrictions, live Bedrock recaps in all three modes, voluntary stop at 42, victory at 500, and blocked direct ALB access.
- Browser: Human run stopped at 5 and Decider run stopped at 32, each with an actual Bedrock voluntary-stop summary and exact score. Shadow HTTP mode ran eight ticks with a steady status and retained suggestion/metrics. History displayed Human 5 / Decider 32 after reload. Layout checked visually. Screenshot evidence: `/tmp/grid-dodger-stop-recap.png` (local, not published).
- Victory transition was exercised using a controlled 499-point board in the actual browser-controller test harness; a full 500-tick live playthrough was not performed. The live victory narration was verified separately through the hosted API.
- Repository remained private at this gameplay deployment checkpoint; no commit/push had yet been performed. Article publication and video production remained excluded.


## Decision display and difficulty ramp — 2026-10-16

- `make test`: 48 Node checks and 6 Lambda checks passed. New checks exercise increasing seeded spawn density from 150, distinct columns and a maximum of four hazards per new five-column row, explicit spawn overrides, transparent model-versus-applied moves, full probability display, and the unchanged shadow timing.
- Difficulty rises at 150, becomes Hard at 300 and Extreme at 400, and reaches maximum density near 500. Seeded local heuristic simulations (100 seeds, initially empty boards, 100-tick cap) measured mean ticks of 75.97 / 57.77 / 16.23 / 12.86 for starting scores 0 / 150 / 300 / 400; 51 / 8 / 0 / 0 episodes reached the cap. This is a difficulty sanity check using the deterministic baseline, not a live model benchmark or a guarantee of human completion rate.
- UI published through `make sync-ui`; no Decider image rebuild or infrastructure change required. New primary display separates model choice from engine safety facts and threshold-applied actions, without altering probability values or threshold behavior.

Browser verification: a live HTTP Decider run advanced to score 25; the new card displayed the actual model action and engine safety facts. Expanded details displayed left 44.8%, stay 37.0%, right 18.1%, with no unsure badge. Screenshot: `/tmp/grid-dodger-model-display.png` (local only).


## Git checkpoint and documentation consolidation — 2026-10-16

At the user's request, all 65 changed files were committed as `769c77c` (Improve gameplay, Decider visibility, and private AWS deployment) and pushed to `origin/main`. A fresh fetch showed no divergence beforehand; after push, HEAD and origin/main matched and the working tree was clean. GitHub CLI verified the repository remained PRIVATE. A filename-only credential-pattern scan found no matches in the nonignored repository inventory; credentials, state, plans, and local tfvars remained excluded.

The latest local suite is **48 Node + 6 Lambda checks (54 total)**, recorded in the decision-display update above. The initial 45-check total includes four opt-in live tests and is a historical checkpoint, not the current local suite count. Subsequent live checks are reported separately rather than added to that local total.

The subsequent documentation-only pass consolidates the root README, handoff, specification, demo checklist, article, recipe, operations, implementation status, and benchmark guidance. It does not rebuild images, redeploy, or re-run AWS infrastructure checks. The no-drift result above remains dated rebuild evidence. Temporary screenshot paths may expire and are not repository deliverables.


## Responsive arcade redesign on dev — 2026-10-16

- `make test`: **52 Node + 6 Lambda checks passed (58 total)**. Added coverage for mode-button reset/cancellation and pressed state, touch movement/autonomous disabling, editing fields without steering/restarting, and keyboard/native button activation. The controller harness now checks referenced IDs against actual HTML, preventing a missing element from being hidden by a permissive fake DOM.
- Browser sizes: 320×568, 390×844, 768×1024, and 1440×1000. Inspected desktop/mobile rendering, proportional short-phone board sizing, touch targets (at least 44 px), aligned logo, mode buttons, progress, collapsed details, and recap-before-log ordering. Tablet/desktop interactive and panel bounds showed no horizontal overflow; phone layout was inspected visually and by geometry.
- Local human touch input recorded a right move; Pause then Stop produced an exact-score offline recap at 13. Local HTTP Decider play used the existing hosted backend, paused at 9, resumed, then stopped at 21. Shadow produced matching SUGGEST STAY cues beside the board and in the copilot panel after four ticks.
- At 320×568 during play, the board was approximately 214×347 px, vertically centered, with run actions and movement controls visible. Temporary viewport overrides were reset after checks. Preview was left ready in Human mode.
- Local recap was explicitly labeled offline because BEDROCK_MODEL_ID is unset. This task did not revalidate live Bedrock generation or perform a new hosted infrastructure audit. No AWS assets were deployed, and no game-engine, threshold-policy, difficulty, or reaction timing changes were made.
- Screenshot evidence: `/tmp/grid-dodger-arcade-desktop.png` and `/tmp/grid-dodger-arcade-mobile.png`; temporary local files, not durable repo assets.


## Agreed UI refinements and 100-point ramp — 2026-10-16

- `make test`: **53 Node + 6 Lambda checks passed (59 total)**. Added a no-scroll-on-Start regression, while preserving recap reveal on endings. Difficulty tests cover the 100-point boundary, progressive density, unique spawn columns, and unchanged one-row movement.
- Updated the exact requested Strands Decider 2B subtitle. Model details starts open, can be collapsed/reopened, and has a bounded, keyboard-scrollable content region. HTTP model/latency moved directly below the action; blank context space was reduced.
- Local desktop browser used real HTTP Decider inference, paused at score 26, and displayed the full probability breakdown within box 02. Collapsing and reopening details worked. A normal pointer Start click left the headline's vertical position unchanged (113.40 px before and after at 1280×800).
- At 390×844, a normal pointer Start click entered running state at score 1 with the headline unchanged at 121.52 px. Desktop was also checked at the normal 855×889 preview size. The short-phone presentation still permits manual scrolling to keep gameplay readable; Start itself does not jump the viewport. Temporary viewport overrides were reset, and the game was left ready in Human mode.
- Dev difficulty now starts at 100 using progress `(score - 100) / 400`; Hard 300, Extreme 400, and goal 500 remain. Historical seeded density simulations above used the prior 150-point ramp and should not be reused as measurements of this new ramp. The 60-tick model benchmark remains below either ramp.
- Screenshot: `/tmp/grid-dodger-details-refinement.png` (temporary local evidence). No AWS deployment, production UI change, or main-branch update was performed.


## Horizontal flight deck correction on dev — 2026-10-16

Restored horizontal mode tabs, score/progress and run actions above the centered board, retaining the updated subtitle, expanded/collapsible Model details, compact telemetry and 100-point difficulty ramp. Copilot panels move below the game at widths up to 1040px. Browser checks at 1280×900, 855×889 and 390×844 confirmed aligned mode tabs and readable layouts; the phone document had no horizontal overflow. A native Start click preserved the headline position at y=113.3984375 on desktop; Pause and the Model details collapse/reopen control worked. Temporary viewport overrides were reset. Screenshot: `/tmp/grid-dodger-horizontal-flight-deck.png` (temporary local evidence).

`make test`: 53 Node + 6 Lambda checks passed. This is a local/dev layout correction; main and the deployed AWS UI were not updated.


## Visual navigation review on dev — 2026-10-16

Browser review at 1280×900 confirmed sticky headline bottom at 124px and run toolbar top at 134px, resolving the overlap. Recap anchor focus landed on its heading with desktop header clearance. At 390×844, Recap and Details links reached their sections and Advanced settings expanded/collapsed. At 320×740 the document and viewport were both 320px wide, with four 44px-high section links. Mode descriptions now retain full opacity; Model details has a larger touch toggle. `make test` passed 53 Node and 6 Lambda checks. Temporary screenshot evidence: `/tmp/grid-dodger-navigation-polish.png`. Changes remain on dev; production was not deployed.


Compact secondary panels: reduced Advanced settings/Decision log type, padding, field height and log height cap (240px). Browser checked expanded disclosures at 855px and 390px widths; phone document width matched its 390px viewport. Summary targets remain 44px and coarse-pointer fields retain 44px height. CSS-only change; no gameplay logic changed or additional automated tests run. Screenshot: `/tmp/grid-dodger-compact-details.png`.


## Approved viewport-fit arcade on dev — 2026-10-16

Implemented user-approved smaller pilot tabs, blended sticky desktop headline and smooth Start focus. On a 1366×768 viewport after native Start, the flight deck occupied y=100.05–758.13, movement controls ended at y=715.63 and all three sidebar cards ended at y=756.05. At 1280×800, the deck and sidebar ended at y=790.13 and 788.05; movement controls ended at 747.63. At 390×844, the full board ended at y=779.02 and reachable movement controls at y=834; document width matched the 390px viewport. Copilot and recap remain below gameplay on narrower layouts. Extremely short viewports retain scrolling rather than forcing unreadably small controls.

Real HTTP Decider advanced to score 36 before Pause, with live source/latency/probabilities displayed. Shadow displayed SUGGEST LEFT in both board cue and copilot with a matching model result. Model details stays open/collapsible and scrolls within the constrained desktop card. Human Start/Pause was exercised on phone. Local recap results remain labeled offline because BEDROCK_MODEL_ID is unset; these checks do not validate live Bedrock. Temporary viewport overrides were reset. Evidence: `/tmp/grid-dodger-fitted-arcade.png`, `/tmp/grid-dodger-fitted-phone.png`.

`make test`: 54 Node + 6 Lambda checks passed, including actual Start-handler focus, reduced-motion preference and ending recap reveal. No AWS deployment or main-branch updates.


## Original arcade proportions restored — 2026-10-16

User requested restoration of the first arcade headline/board scale after reviewing the compact variant. At 1440×1000, browser inspection confirmed a 320×518.75 displayed canvas and the original responsive headline size (46.91px line box). Copilot height followed its content at 495.41px, with its final detail ending 23px above the card edge rather than leaving a stretched blank area. Model details is lower with 16px separation/padding. Recap and score cards flow naturally below it. A Human run started and progressed through collision; the recap remained the labeled local offline fallback. Phone review at 390×844 confirmed title wrapping and the stacked layout. Original proportions mean shorter viewports require scrolling; previous viewport-fit claims describe the superseded variant. Screenshot: `/tmp/grid-dodger-restored-proportions.png`. Phone document width matched the 390px viewport. `make test`: 54 Node + 6 Lambda checks passed. No gameplay/controller logic changes.


## Final clarity refinements — 2026-10-16

`make test`: 59 Node + 6 Lambda checks passed. Added regression coverage for Resume/Start across pause, restart and reset; Human model placeholders and mode switching; deterministic stopped/won/collision score banners and reset clearing.

Browser reviewed ready, running, paused/resumed and stopped states at 1280×900 and 390×844. Confirmed Resume labeling, concise Human model details, restored metric visibility when selecting Decider, and outcome/score banners above stopped-run narration (score 2 on desktop, 1 on phone). Phone document and viewport widths both measured 390px. Consistent detail spacing uses 8px/16px gaps. Win/collision banners were verified in controller tests, not through a live 500-point run. Local narration is the labeled offline fallback; no new live Bedrock validation. Viewport override reset. Temporary evidence: `/tmp/grid-dodger-final-refinements.png`. No main-branch or production changes.


## Compact recap result and duplicate opening removal — 2026-10-16

`make test`: 63 Node + 6 Lambda checks passed. Added actual-controller response tests for stopped/won/collision recap openings, repeated prefixes, preserved non-leading feedback and source footer, and unchanged banner score. Result banner padding changed to 8px/10px with smaller type; heading, narration type and gameplay score remain unchanged. Browser exercised Stop and Refresh at normal 855px preview and 390×844 phone width; banner showed You stopped / Score 1 while narration began directly with Next time feedback. Offline attribution remains visible. Viewport reset. Temporary proof: `/tmp/grid-dodger-compact-recap.png`. API/server and AWS deployment unchanged.


## Isolated header experiment on feat/ui-header-refinement — 2026-10-16

`make test`: 63 Node + 6 Lambda checks passed. Existing reduced-motion checks now also assert Resume does not scroll and a new run after an ending refocuses the arcade. Browser checked a live Decider run on 1280×900 with the compact logo and headline visible together. Native Pause/Resume preserved board y=428.3046875 before/after. At 855px width the document had no horizontal overflow; at 390×844 the compact logo was hidden and existing phone layout retained. Temporary viewport overrides reset. Proof: `/tmp/grid-dodger-header-experiment.png`. Dev/main remain at a68240d/645440f; no AWS changes or deployment.


## Scrolling-only revision on feat/ui-header-refinement — 2026-10-16

Removed the compact logo and experimental header styling per user feedback. Compared with dev: header HTML and CSS are identical; the only controller change is new-run-only Start scrolling. `make test`: 63 Node + 6 Lambda checks passed. Native browser Pause/Resume left board y unchanged at 521.0078125. Evidence: `/tmp/grid-dodger-scroll-only.png`. Dev/main and deployed assets unchanged.


## User-provided start sound — 2026-10-16

Replaced the selected start sample with the supplied Floraphonic MP3, preserving exact bytes (SHA-256 bcef75d5ffaa0a474fa5c6bb0466281d0c257215f3ffafb2c9c9d8fbc1fd768e). afinfo identified a 2.04-second stereo 48kHz MP3. Actual audio module exercised with an Audio test double: correct MP3 path selected, volume remained 0.6, muted start produced no playback call. Local HTTP verification returned 200/audio/mpeg and byte-for-byte matching content. `make test`: 63 Node + 6 Lambda checks passed. These checks verify wiring and delivery, not subjective listening quality. No AWS deployment.


## Original-logo recording header experiment — 2026-10-16

Accepted scrolling/start-audio changes merged into dev and pushed at 60e3d70; feature branch fast-forwarded to that checkpoint. New layout work remains on feat/ui-header-refinement. `make test`: 63 Node + 6 Lambda checks passed. Browser exercised live Decider and Pause at 1440×1100 and 1920×1080. In the 1080p frame the original logo and headline remained visible in the shared header (116.55px high), the 320×518.75 board retained its scale, full flight deck ended at y=1075.61, movement controls at y=1016.11, and all right-hand cards at y=1047.29. At 855px the header logo container was 225px and document width matched the viewport. At 390×844 the nonsticky stacked header remained. Viewport overrides reset. Proof: `/tmp/grid-dodger-recording-header.png`. No merge of this new header experiment into dev, no main update, no deployment.


## Stacked logo and 32px headline preview — 2026-10-16

Browser checked initial page at 1280×900 and 390×844. Desktop logo bottom y=68, headline top y=79.12 with a 36.8px line box from 32px type, full header height 162.5px. Header is the same from page load through gameplay because play-dependent layout classes were removed. Mobile keeps 28px headline sizing; document and viewport both measured 390px wide. Original board proportions retained. `make test`: 63 Node + 6 Lambda checks passed. Viewport override reset. Proof: `/tmp/grid-dodger-stacked-header.png`. Dev/main and production unchanged.


## Blended stacked-header polish — 2026-10-16

CSS-only refinement uses the same fixed gradient backdrop for page and sticky header and offsets logo/edition/mute down 4px. At 1280×900, logo bottom changed from 68 to 72px while headline top stayed 79.12px and header height stayed 162.5px. Reviewed 390×844 phone layout with document width equal to viewport width. No additional automated tests run for this spacing/background-only change. Viewport reset. Proof: `/tmp/grid-dodger-blended-header.png`. Dev/main/production unchanged.


## Larger desktop logo and creator link — 2026-10-16

Visual review at 1280×900 confirmed the 10% larger desktop logo and single GitHub-icon/Elyas Syed credit beside THE AI ARCADE. At 855px the document width matched the viewport (855px), with a 314px logo container. At 320×740 document width matched 320px and the original narrow-phone 188px logo container remained. Link DOM verified href=https://github.com/elyas-syed, target=_blank, rel=noopener noreferrer; icon is decorative and accessible link name identifies the destination/new-tab behavior. Viewport override reset. Markup/CSS-only change; no new automated suite run. Proof: `/tmp/grid-dodger-creator-header.png`. Dev/main and production unchanged.

## Live arcade release — 2026-10-17

Released main 5fd4775 after merging feat/ui-header-refinement (a1393fd) through dev (af287a2). make sync-ui completed and CloudFront invalidation I7NJLYGTGXXZ56M8TY9FL1LHW8 reached Completed. Verified all 23 public browser assets/modules against local release bytes, applying the same index.html hosted-link substitution as the deploy script.

- make test: 65 Node + 6 Lambda checks passed.
- test:live: four actual Decider checks passed.
- test:hosted: assets/MIME/routes, CUDA, origin/input/private-path protections, five live Bedrock recap cases and blocked direct ALB passed.
- Live browser: new branding/details rendered, autonomous score reached 47, Stop produced exact-score banner and Bedrock narration, Shadow hints/probabilities appeared. Screenshot /tmp/grid-dodger-live-release.png is temporary local evidence.
- Repository remains private. No container rebuild or infrastructure apply. Full 500-tick live victory was not attempted. Existing narration may repeat the score beyond recognized leading prefixes; this is unchanged and not covered as a passing acceptance check.

## Points wording and brief documentation — 2026-10-17

On feat/recap-points-docs, make test passes 66 Node + 7 Lambda checks (73 total). Recap tests cover score wording in points, recent history as a sample, mode-specific offline output and rejection of tick terminology with an honestly labeled fallback. Local and Lambda prompts are aligned. No gameplay rules changed and no live Lambda update was applied. The prior moves-only saved Terraform plan is obsolete and removed; regenerate a plan for the final points code before deployment.

Root README shortened; docs/COSTS.md lists all infrastructure components and usage assumptions without account/billing data. docs-local/README.md exists locally and git check-ignore confirms exclusion. Relative links in changed documentation, cost arithmetic and whitespace were checked. No fresh live inference or browser checks were needed for documentation and backend wording changes.

## Lambda points wording live verification — 2026-10-17

The user subsequently authorized finishing the deployment. Reviewed a fresh plan, then ran make infra-apply PLAN=recap-points.tfplan: 0 additions, 1 Lambda code update, 0 deletions. Post-apply full Terraform plan reported no changes. Focused tests passed 8 JS recap + 7 Lambda checks; prior full suite passed 73.

Hosted smoke passed live Bedrock collision recaps in all modes, Stop/win recaps, assets/routing, CUDA health and existing origin/input/private-path checks. Three additional 16-point collision requests returned actual Bedrock source with points/score wording and no ticks or 16-move score claims. The initial literal-only check rejected “your score was 16”; the corrected semantic check accepts explicit score wording as well as “16 points”. These are sampled outputs, not a guarantee of every generated statement. No UI update or container restart was required.

## Illustrated article and architecture assets — 2026-10-17

Documentation-only authoring on dev. Created a local Markdown/HTML article, five browser screenshots (ready Human, live Decider, current-board Shadow, actual Bedrock stopped recap and full phone layout), three code-drawn architecture cards, an original concept cover and a Matplotlib benchmark chart. Runtime diagram checked against src/controller ownership and Terraform routes; browser tools are not placed on the GPU. Chart values read from the existing benchmark JSON, with no new evaluation claims. Screen captures have provenance and are not edited gameplay composites.

HTML preview at 1440px and 390px loaded ten images, with document widths matching both viewports. Local article links/assets and benchmark figures were checked; private/account credentials and infrastructure state are excluded. Shared overview PNG/SVG are in docs/images/ and linked by the root README. Article stays under ignored docs-local/; official public-source/video requirements are noted without changing privacy or producing a video. No application changes or fresh full test run; the latest application checkpoint remains 73 passing local checks.
