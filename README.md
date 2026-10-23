# Grid Dodger

**A small model. Every move matters.** An arcade experiment where **Strands Decider 2B selects movement tools** and **Amazon Bedrock writes the end-of-run recap**.

[Watch the demo](https://elyas-syed.github.io/grid-dodger/#demo) · [Read the build story](docs/grid-dodger-article/ARTICLE.md) · [Reuse the decision pattern](docs/DECIDER_PATTERN.md) · [Benchmark results](benchmarks/results/REPORT.md)

![Grid Dodger: Human, Decider, and Shadow modes](docs/grid-dodger-article/assets/game-overview.png)

## Play locally

Dodge falling hazards on a five-lane grid and reach **500 points**. Human mode gives you the controls; Decider flies automatically; Shadow suggests moves while you stay in control. Difficulty rises from 100 points.

Requires Node.js 20+; Python 3 is needed for Lambda tests.

```sh
git clone https://github.com/elyas-syed/grid-dodger.git
cd grid-dodger
npm ci
make test
make serve
```

Open **http://127.0.0.1:8080/game/**. Human mode and mock decisions can run without AWS. For **real local Decider inference**, follow the [local setup guide](docs/LOCAL_SETUP.md) for Apple Silicon MPS or CPU. Bedrock recaps require optional AWS access and are billed to your account; without it, recaps are labeled offline.

## How it works

![Architecture: browser tool dispatch, Decider inference, and Bedrock recap](docs/images/architecture-overview.png)

The browser sends board context and grounded move outcomes to Decider. The model selects **left, stay, or right**. The application validates the response, applies its threshold policy, dispatches a registered movement tool, and checks collisions. Amazon Nova Lite on Bedrock writes the recap after a run ends.

The default 0.40 option-probability threshold can substitute **stay**; that fallback is not guaranteed safe. The UI distinguishes the model's choice from the action applied. [Typed question, options, wiring, and usage example](docs/DECIDER_PATTERN.md).

## Recorded showcase and AWS deployment

The [GitHub Pages website](https://elyas-syed.github.io/grid-dodger/) serves a **approximately 80-second recording of real AWS gameplay with audio**. Watching it makes no inference requests. The temporary recording infrastructure was removed on October 18, 2026; there is no always-on hosted game.

You can [deploy the full reference stack in your own AWS account](terraform/README.md). It uses CloudFront/S3, ECS on GPU-backed EC2, ECR/CodeBuild, and API Gateway/Lambda/Bedrock. The historical always-on estimate is **about $14/day or $425–430 per 730-hour month**, before credits/tax; builds and usage are additional. [Assumptions and breakdown](docs/COSTS.md).

To preview the static showcase exactly as it is published:

```sh
npm run build:pages
python3 -m http.server 8082 --directory _site
```

Open **http://127.0.0.1:8082/**. GitHub Actions tests the code and publishes only `_site/` on pushes to `main`; AWS infrastructure and local files are excluded. See [GitHub Pages deployment](docs/GITHUB_PAGES.md).

## Measurements and limits

On 40 fixed board snapshots, grounding the prompt reduced avoidable collisions from **17/31 to 0/31**. The grounded variant's snapshot p95 request time was **519 ms**. Five exploratory episodes averaged **51 of 60 moves**, with four reaching the test cap. This is a small measured experiment, not a general survival guarantee or a demonstrated saving over larger models. [Full report and raw results](benchmarks/results/REPORT.md).

Built by [Elyas Syed](https://github.com/elyas-syed). Decision pattern: **tool selection**. Submission tags: **#strands-decider-2b #tool-selection**.

[Apache-2.0 code license](LICENSE) · [Third-party artwork and audio attribution](game/assets/ATTRIBUTION.txt)
