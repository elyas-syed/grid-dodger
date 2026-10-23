# Visual assets and evidence

This folder contains the article images included with the public source. The generic overview diagram also lives in docs/images/ for the root README.

| Asset | Type and source |
|---|---|
| article-cover-high-resolution.png | The article uses the 3840 × 2161 upscaled export. AI-generated editorial cover with an original spacecraft, neon grid and asteroids, GRID DODGER above the right-hand scene, and article title/byline on the left. Built-in image generation used author-supplied visual references. Concept art, not gameplay evidence. The selected cleaner version uses “A SMALL MODEL. EVERY MOVE MATTERS.” and an uppercase author name. |
| architecture-overview.png / .svg | Original architecture card, checked against current Terraform and browser/controller modules. Shared copy in docs/images/. |
| decision-loop.png / .svg | Original decision/tool wiring card based on src/ modules. |
| build-and-resilience.png / .svg | Original deployment and reliability card based on Make targets and validation history. |
| benchmark-results.png / .svg | Matplotlib figure generated from the stored benchmark values, not new measurements. |
| game-overview.png | Hosted game ready in Human mode, 1440 × 1100 viewport. |
| decider-live.png | Hosted HTTP Decider run, captured at score 44. Observed distribution: left 2.5%, stay 55.6%, right 41.9%; last client request 514 ms. |
| shadow-live.png | Hosted Shadow run showing the first current-board suggestion before a human move. |
| bedrock-recap.png | Hosted stopped run at 44 points with actual Bedrock amazon.nova-lite-v1:0 narration. |

Screenshots were captured on 2026-10-17 through browser automation without editing gameplay state, synthesizing HUD values, or compositing results. Live inference is variable. The samples are documentation illustrations, not a new model-performance evaluation.

The game logo and game artwork retain their existing project attribution; see ../BRAND.md and ../../game/assets/ATTRIBUTION.txt. These architecture illustrations use original generic shapes and service names, not AWS service logos or an endorsement mark.

The architecture cards and chart include editable vector exports. The cover is a raster export. Screenshots and concept art are distinguished above. `render_article.py` requires Python Markdown and regenerates only the HTML reading version.
