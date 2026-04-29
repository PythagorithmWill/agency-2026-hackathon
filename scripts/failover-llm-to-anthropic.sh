#!/usr/bin/env bash
# Switch LLM_PROVIDER from AWS Bedrock (primary) to Anthropic API direct
# (failover). Use when Bedrock returns 5xx, when models are unavailable in
# the configured region, or when rate limits are saturating.
#
# Note: this charges to Pythagorithm production billing, not hackathon
# credits. Run scripts/restore-bedrock.sh once Bedrock recovers.

set -euo pipefail

PROFILE="${HACKATHON_AWS_PROFILE:?HACKATHON_AWS_PROFILE is required}"
REGION="${AWS_REGION:-ca-central-1}"
CLUSTER="${CLUSTER_NAME:-agency2026}"
SERVICE="${SERVICE_NAME:-web}"

aws ssm put-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name /agency2026/llm-provider \
  --value "anthropic_direct" \
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

echo "LLM provider switched to anthropic_direct."
