# AWS operations — Grid Dodger

**Current status — 2026-10-17:** the project stack has been fully destroyed and Terraform state is empty. Deployment steps below are for a future user-authorized rebuild.

Decider runs on ECS EC2 `g4dn.xlarge` with CUDA. CodeBuild creates the image. The UI is S3/CloudFront; recap is API Gateway/Lambda/Bedrock. Terraform manages the project stack, including Lambda logs, origin restrictions, WAF, and a budget when an email is configured.

Use the AWS account and region intentionally. The default region is us-east-1; CloudFront WAF uses an explicit us-east-1 provider. Never commit credentials, Terraform state/plans/tfvars, or origin secrets. This guide deploys into your own AWS account.

## Run on your computer instead

The [local setup guide](../docs/LOCAL_SETUP.md) runs the game and **real Strands Decider 2B** together without AWS hosting. It covers Python installation, MPS/CPU commands, HTTP connection settings, health checks, and troubleshooting. Bedrock recaps are optional and still require AWS access and paid model calls. Local inference speed depends on hardware. For cloud hosting, continue below.

## Fresh deployment

Prerequisites: AWS CLI credentials, Terraform >=1.5, Node >=20, zip, GPU quota, and Bedrock model access. No local Docker is required.

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Configure budget email and leave decider_desired_count=0.
make infra-apply
make build-image
# Set decider_desired_count=1 in terraform/terraform.tfvars.
make infra-apply
make sync-ui
terraform -chdir=terraform output -raw cloudfront_url
```

The first apply creates the infrastructure with ECS and ASG at zero. The image lookup is disabled until desired_count=1 so an empty ECR repository does not block bootstrap. `make build-image` uploads only the Decider build context to S3, invokes CodeBuild, and waits for a successful push. The build uses `--pull --no-cache`, records installed Python dependencies in its log, and does not reuse a prior project image.

A subsequent apply resolves the configured image tag to an immutable digest and creates the running GPU task. ECS applies now wait for service stability. Still verify the API and gameplay rather than treating a successful apply as a complete end-to-end test:

```bash
aws ecs wait services-stable --region us-east-1 --cluster grid-dodger-demo --services grid-dodger-decider
DECIDER_URL="https://YOUR_CLOUDFRONT_DOMAIN/decider" npm run test:live
```

Use the current Terraform outputs. Never reuse a CloudFront domain from before a full teardown. `make sync-ui` generates the hosted launcher link from those outputs and uploads only game and source files, not documentation, benchmark reports, or the article.

## Updating

- Frontend/browser modules: `make sync-ui`, wait for invalidation completion, reload the browser. Gameplay, difficulty, and decision-display changes do not need a Docker image rebuild.
- Image: `make build-image`, then `make infra-apply` to roll out the new digest.
- Infrastructure/Lambda: inspect the Terraform plan and apply within explicitly authorized scope.

ECS already pulls a prebuilt image from **private ECR in this AWS account**, pinned by digest. Reuse it for UI changes, infrastructure changes that do not alter the container, and task restarts. `make build-image` deliberately does a clean build when invoked; it is not required for every deployment. A public Docker registry is not needed.

The ECR repository remains in this application's Terraform stack with `force_delete=true`, so full teardown deletes its images. A separate persistent registry stack was discussed but has not been implemented. Setting force deletion to false alone would block deletion of a nonempty repository, not preserve it through stack destruction. A fresh GPU host must still download the existing image and load the model. The clean-build record measured about 5m28s for CodeBuild and about 1m50s for the fresh host's image pull; these are historical observations, not deployment guarantees.

One GPU and a fixed host port require stop-before-start deployment. ECS AZ rebalancing is disabled; min healthy percent is 0 and max percent is 100. Circuit-breaker rollback is enabled. Force deletion is enabled for explicitly requested service teardown. The target deregistration delay is 30 seconds; allow time for task shutdown, image pull, model startup, and health checks. Expect an outage during replacement.

## Testing

```bash
npm ci
make test
npm run test:hosted
terraform -chdir=terraform fmt -check
terraform -chdir=terraform validate
DECIDER_URL="https://YOUR_CLOUDFRONT_DOMAIN/decider" npm run test:live
DECIDER_URL="https://YOUR_CLOUDFRONT_DOMAIN/decider" npm run benchmark
```

Check `/game/`, `/game/index.html`, redirected `/`, and `/decider/health`. Health must report CUDA. Play human, Decider HTTP, and shadow modes. Confirm a real Bedrock footer after collision, voluntary Stop, and win, not an offline fallback. Verify local Human/Decider score persistence and the new decision details. The win transition can be checked with the controlled controller fixture; do not describe that as a complete live 500-tick playthrough. Verify direct API Gateway recap access is 403 and direct ALB access is blocked. Inspect WAF and API throttles without load-testing the public endpoint. Finish with a Terraform plan showing no changes.

## Access and costs

Continuous light-traffic hosting is approximately **$14/day or $425–430/month**, before credits and tax, with builds extra. These estimates apply to a running stack; the current stack has been removed. See the brief [running-cost breakdown](../docs/COSTS.md) for compute, image storage, networking, recap, and build estimates. Billing exports and account-specific notes do not belong in shared documentation; use ignored docs-local/ for local working notes.

CloudFront permits public players without sign-in. The ALB accepts CloudFront origin IPs only and a secret origin header. Lambda checks the same CloudFront-injected header before calling Bedrock. The secret stays in state and service configuration; it is never shipped in browser files.

WAF limits approximately 1,000 dynamic requests per viewer IP in five minutes; API recap throttling is 2 requests/second, burst 5. WAF enforcement is approximate. Shared-IP players share the rate bucket. Neither mechanism is a spending cap or full authentication.

Billing includes GPU instance time, its EBS volume, ALB/public IPv4, ECR/S3, CodeBuild, WAF, and any Bedrock usage. The WAF ACL/rule has a recurring charge plus request charges; see [AWS WAF pricing](https://aws.amazon.com/waf/pricing/). Scaling desired_count to 0 stops GPU instance capacity but leaves other charges. Budget notifications do not stop resources.

## Full teardown and rebuild

An explicit user instruction to tear down/rebuild authorizes the operation. Otherwise obtain confirmation before apply/destroy. Inspect a destroy plan first to verify it only targets this project.

```bash
terraform -chdir=terraform plan -destroy -out=rebuild-destroy.tfplan
terraform -chdir=terraform apply rebuild-destroy.tfplan
terraform -chdir=terraform state list
```

ECR is force-deleted with images, and the UI/build-source buckets are emptied and deleted. Do not use Terraform state removal to pretend the stack is gone. Verify project service/ASG/instances, ALB, CloudFront, buckets, logs, and repositories have actually been removed. Old inactive ECS task revisions and pre-management Lambda logs can need project-specific cleanup; never delete unrelated resources.

Then follow fresh deployment from desired_count=0. A clean rebuild creates new resource identities and a new public URL. Record the actual outcomes in `docs/VALIDATION.md` and the handoff. A rebuild does not publish a Builder Center article or modify the static GitHub Pages showcase.

For an already-reviewed saved plan, use `make infra-apply PLAN=rebuild-run.tfplan` (the file is relative to `terraform/`). This runs the same Make target and applies the inspected plan without a second interactive planning pass.

If an old instance remains in shutting-down during an explicitly authorized full teardown, use AWS-supported termination troubleshooting rather than removing it from state: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-terminate-methods.html . Older AWS CLI versions may not expose force termination; the current AWS SDK supports it. Target only the already-identified disposable project instance.
