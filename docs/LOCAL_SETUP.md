# Run Grid Dodger locally with real Decider inference

The game and **Strands Decider 2B can both run on your computer**. You do not need Terraform, ECS, ECR, or an AWS account for movement decisions. Amazon Bedrock recaps are optional and require AWS access; without them, run endings use a labeled offline recap.

## Requirements

- Clone this repository: `git clone https://github.com/elyas-syed/grid-dodger.git`.
- Node.js 20+, npm, and Python with `venv` support. The reference container uses Python 3.12; the existing local environment uses 3.13.
- Internet access for the initial Python dependencies and model download, plus disk space and memory for the 2B checkpoint and its dependencies. No minimum RAM or GPU memory has been established for this project.
- Apple Silicon can use PyTorch MPS. Other computers can use CPU inference; it may be substantially slower than the hosted GPU. These shell commands target macOS/Linux or Windows through WSL. Native Windows setup has not been validated.

## 1. Install the game and model server

From the repository root:

```bash
npm ci
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install 'strands-decider==0.1.0'
```

The CLI version matches this project's reference images. We use **`StrandsAgents/strands-decider-2B-hobson-v19`**, the checkpoint behind the recorded benchmarks. The first server start downloads the model from Hugging Face and can take time. A complete dependency lock and pinned model revision are not yet provided; a fresh install can resolve different transitive dependencies. See the [official installation guide](https://github.com/strands-labs/strands-decider) for upstream requirements, without silently substituting a newer checkpoint for our benchmarked one.

## 2. Start real Decider inference

Keep this terminal running. Choose one command:

```bash
# Apple Silicon Mac: MPS acceleration
npm run decider
```

```bash
# CPU fallback: macOS/Linux/WSL
npm run decider:cpu
```

Both scripts activate the repository's `.venv`, load the v19 checkpoint, and serve port 8000 on localhost. For a compatible NVIDIA GPU with a CUDA-enabled PyTorch installation, the equivalent explicit command is:

```bash
source .venv/bin/activate
strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 \
  --host 127.0.0.1 --port 8000 --device cuda
```

CUDA setup depends on the computer's drivers and PyTorch build; the local CUDA path has not been validated here. Do not use `make build-image` for this setup: that target starts an AWS CodeBuild job.

## 3. Start the game

In a second terminal, from the same repository root:

```bash
make serve
```

Open **http://127.0.0.1:8080/game/**. Under **Advanced settings**, select **strands-decider (http)** and leave **Decider URL** as **`/decider`**. Choose **Decider** for autonomous play or **Shadow** for model suggestions, then press **Start**. Human mode does not ask the model to steer.

The browser calls `/decider`; the Node server proxies it to `http://127.0.0.1:8000`. Use `make serve`, not `serve:static` or a `file://` URL, for the proxy and recap endpoint. The landing page at **http://127.0.0.1:8080/game/landing/** remains a recorded-showcase preview, not a live embedded game.

## 4. Verify the connection

After the model finishes loading, run from another terminal:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8080/decider/health
npm run test:live
```

The health requests check the model server and game proxy. The opt-in live checks make real model requests and check valid choices and three escape cases; they do not establish overall game performance. In the game, confirm automatic movement in Decider mode, suggestions in Shadow, and HTTP model details rather than mock output. The threshold policy can replace a low-probability model choice with stay; the UI shows that distinction.

To run the ordinary automated suite separately, use `make test` (Python is also needed for Lambda tests). These checks use fixtures and do not prove that local model inference works.

## Optional: real Amazon Bedrock recaps

Configure AWS credentials on the server using your normal AWS profile or credential provider, with permission to invoke a Bedrock model available in the selected region. Never put credentials in browser code or commit them.

Restart the game server with your accessible model ID:

```bash
AWS_PROFILE=your-profile AWS_REGION=us-east-1 \
  BEDROCK_MODEL_ID=your-accessible-model-id make serve
```

The server also reads the ignored `.env` file. If using `.env.example`, review its values before copying: it includes a Bedrock model ID. Leave `BEDROCK_MODEL_ID` unset for offline recaps. Stopping a run requests a recap; check that the footer identifies a real Bedrock response, not an offline/error fallback. Bedrock calls are billed to your AWS account even when the game and Decider run locally.

## Troubleshooting and stopping

- **Connection refused / proxy failed:** keep both terminals running and wait for model startup. Check both health URLs. If the model uses another port, start the game with `DECIDER_URL=http://127.0.0.1:YOUR_PORT make serve`; keep the browser URL `/decider`.
- **MPS unavailable or out of memory:** stop inference, close memory-heavy applications, and try `npm run decider:cpu`. CPU requests can exceed the game's 25-second request timeout; real-time play is not guaranteed on every computer. The game pauses on decision errors.
- **Install/download errors:** read the model-server log, check network access and Python/PyTorch compatibility, and consult the official guide. Do not select mock and describe it as real Decider inference.
- **Just want offline practice:** choose **mock (CI / offline)**. This uses a local heuristic, not the Decider model.
- **Finished:** press Ctrl+C in both server terminals. This setup creates no AWS hosting resources. Cached model files remain on disk; optional Bedrock calls already made can still appear on the bill.

Validation scope: CLI flags and repository wiring were checked for this guide. A clean install and fresh end-to-end local model run on each hardware platform have not been verified. See [validation](VALIDATION.md) for historical live AWS checks and [AWS operations](../terraform/README.md) for cloud deployment.
