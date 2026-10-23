#!/usr/bin/env bash
# Build Decider CUDA image in AWS CodeBuild and push to ECR (no local multi-GB Docker).
# Prerequisites: terraform apply once (creates ECR + CodeBuild), AWS creds.
#
# Usage: make build-image
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="${ROOT}/terraform"
AWS_REGION="${AWS_REGION:-us-east-1}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1" >&2; exit 1; }; }
need aws
need terraform
need zip

cd "${TF_DIR}"
PROJECT="$(terraform output -raw codebuild_project 2>/dev/null || true)"
BUCKET="$(terraform output -raw codebuild_source_bucket 2>/dev/null || true)"
ECR="$(terraform output -raw ecr_decider_url 2>/dev/null || true)"
cd "${ROOT}"

if [[ -z "${PROJECT}" || -z "${BUCKET}" || -z "${ECR}" ]]; then
  echo "error: missing Terraform outputs. Run: make infra-apply  (with decider_desired_count=0 first)" >&2
  exit 1
fi

ZIP="${TMPDIR:-/tmp}/decider-src-$$.zip"
rm -f "${ZIP}"
# shellcheck disable=SC2064
trap "rm -f '${ZIP}'" EXIT

echo "==> zipping deploy/decider → ${ZIP}"
(
  cd "${ROOT}/deploy/decider"
  zip -q -r "${ZIP}" . -x '*.pyc' -x '__pycache__/*' -x '.DS_Store'
)
ls -lh "${ZIP}"

echo "==> uploading s3://${BUCKET}/decider-src.zip"
aws s3 cp "${ZIP}" "s3://${BUCKET}/decider-src.zip" --region "${AWS_REGION}"

echo "==> starting CodeBuild project ${PROJECT}"
BUILD_ID="$(aws codebuild start-build \
  --project-name "${PROJECT}" \
  --region "${AWS_REGION}" \
  --query 'build.id' \
  --output text)"
echo "    build id: ${BUILD_ID}"

echo "==> waiting for build (CUDA image ~3–5 GB; often 10–20+ min)..."
while true; do
  STATUS="$(aws codebuild batch-get-builds --ids "${BUILD_ID}" --region "${AWS_REGION}" \
    --query 'builds[0].buildStatus' --output text)"
  PHASE="$(aws codebuild batch-get-builds --ids "${BUILD_ID}" --region "${AWS_REGION}" \
    --query 'builds[0].currentPhase' --output text)"
  echo "    status=${STATUS} phase=${PHASE}"
  case "${STATUS}" in
    SUCCEEDED)
      echo "==> pushed ${ECR}:latest"
      echo "    next: set decider_desired_count=1 in terraform/terraform.tfvars"
      echo "          then: make infra-apply (resolves latest to an immutable digest)"
      echo "    Existing service: make infra-apply rolls out the new digest; expect brief downtime on one GPU."
      exit 0
      ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      echo "error: CodeBuild ${STATUS}" >&2
      echo "logs: /aws/codebuild/grid-dodger-decider-image (CloudWatch)" >&2
      exit 1
      ;;
  esac
  sleep 20
done
