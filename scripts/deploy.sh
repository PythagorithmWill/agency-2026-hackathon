#!/usr/bin/env bash
# Deploy to the hackathon-provided AWS account, ca-central-1.
# Run only when the operator (Will) is present — first deploy is a manual gate.
#
# Required env at runtime (set by the calling shell, not committed):
#   HACKATHON_AWS_PROFILE  — the named AWS profile for the hackathon account
#   ECR_REPO               — the ECR repo URI in the hackathon account
#   CLUSTER_NAME           — the ECS cluster name (default: agency2026)
#   SERVICE_NAME           — the ECS service name (default: web)
#
# Idempotent. Tags every image with the git short SHA + ISO timestamp.

set -euo pipefail

PROFILE="${HACKATHON_AWS_PROFILE:?HACKATHON_AWS_PROFILE is required}"
ECR_REPO="${ECR_REPO:?ECR_REPO is required}"
REGION="${AWS_REGION:-ca-central-1}"
CLUSTER="${CLUSTER_NAME:-agency2026}"
SERVICE="${SERVICE_NAME:-web}"

GIT_SHA="$(git rev-parse --short HEAD)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
IMAGE_TAG="${GIT_SHA}-${TIMESTAMP}"

echo "Building image agency2026:${IMAGE_TAG}"
docker build \
  --build-arg "BUILD_COMMIT=${GIT_SHA}" \
  --build-arg "BUILD_TIMESTAMP=${TIMESTAMP}" \
  -t "agency2026:${IMAGE_TAG}" \
  -t "agency2026:latest" \
  .

echo "Authenticating to ECR ${ECR_REPO}"
aws ecr get-login-password --profile "$PROFILE" --region "$REGION" \
  | docker login --username AWS --password-stdin "${ECR_REPO%/*}"

echo "Tagging and pushing ${IMAGE_TAG}"
docker tag "agency2026:${IMAGE_TAG}" "${ECR_REPO}:${IMAGE_TAG}"
docker tag "agency2026:${IMAGE_TAG}" "${ECR_REPO}:latest"
docker push "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:latest"

echo "Forcing ECS service redeploy on ${CLUSTER}/${SERVICE}"
aws ecs update-service \
  --profile "$PROFILE" \
  --region "$REGION" \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --output text >/dev/null

echo "Deploy initiated: ${IMAGE_TAG}"
echo "Watch CloudWatch logs and the ALB health check before declaring success."
