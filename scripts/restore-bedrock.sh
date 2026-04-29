#!/usr/bin/env bash
# Inverse of failover-llm-to-anthropic.sh — restore Bedrock as primary.

set -euo pipefail

PROFILE="${HACKATHON_AWS_PROFILE:?HACKATHON_AWS_PROFILE is required}"
REGION="${AWS_REGION:-ca-central-1}"
CLUSTER="${CLUSTER_NAME:-agency2026}"
SERVICE="${SERVICE_NAME:-web}"

aws ssm put-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name /agency2026/llm-provider \
  --value "bedrock" \
  --type String \
  --overwrite \
  --output text >/dev/null

aws ecs update-service \
  --profile "$PROFILE" \
  --region "$REGION" \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --output text >/dev/null

echo "LLM provider restored to bedrock."
