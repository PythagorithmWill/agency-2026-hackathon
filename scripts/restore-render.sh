#!/usr/bin/env bash
# Inverse of failover-to-local.sh — restore the Render Postgres replica
# as primary DATABASE_URL.

set -euo pipefail

PROFILE="${HACKATHON_AWS_PROFILE:?HACKATHON_AWS_PROFILE is required}"
REGION="${AWS_REGION:-ca-central-1}"
CLUSTER="${CLUSTER_NAME:-agency2026}"
SERVICE="${SERVICE_NAME:-web}"
RENDER_URL="${RENDER_DATABASE_URL:?RENDER_DATABASE_URL must be set in the operator shell}"

aws ssm put-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name /agency2026/database-url \
  --value "$RENDER_URL" \
  --type SecureString \
  --overwrite \
  --output text >/dev/null

aws ecs update-service \
  --profile "$PROFILE" \
  --region "$REGION" \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --output text >/dev/null

echo "DATABASE_URL restored to Render replica — ECS picks up new env on next task start."
