# GitHub Pages deployment

The project website is a static recorded showcase. Real Decider inference and Bedrock recaps run locally or in a separately deployed AWS stack; GitHub Pages does not host those services.

`npm run build:pages` creates `_site/` from `game/landing/`, the few game images referenced by the landing page, and `game/landing/media/grid-dodger-demo.mp4`. It rewrites those image paths to remain relative to the deployed page. It does not publish the repository wholesale, Terraform files, tests, environment files, or private working notes.

## Deploy

1. In this public repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push to `main` or run **Validate and deploy showcase** manually.
3. The workflow installs Node dependencies, runs the Node and Lambda tests (including the static build check), builds `_site/`, and deploys it using GitHub's Pages actions.
4. Open `https://elyas-syed.github.io/grid-dodger/` and check artwork, navigation, repository links, video playback/seek/replay, and mobile layout while signed out.

The build fingerprints the entry script, config module, stylesheet and video URL to prevent cached configuration from selecting an older recording. All page-local paths are relative, so the project prefix `/grid-dodger/` works without a custom domain or root-relative asset paths. The player uses native controls, metadata preload, a poster, and no autoplay.

## Change the recording

Replace `game/landing/media/grid-dodger-demo.mp4` with an approved recording, or update `showcase-config.mjs`. Keep the demo under three minutes for the current hackathon and avoid exposing credentials or unrelated screen content. Preserve your high-quality master separately. The included video uses excerpts from genuine AWS Human, Decider, Shadow and Bedrock recap footage; it is an edited demonstration, not one continuous run.

The private development repository and its history are not part of this clean public source export. Updating this static site does not deploy or restart AWS infrastructure.
