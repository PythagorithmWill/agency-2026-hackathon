#!/usr/bin/env bash
# Switch DATABASE_URL from the Render replica to the local Postgres copy
# loaded via .local-db/import.js.
#
# Recovery target: < 30 seconds end-to-end. Idempotent.

set -euo pipefail

PROFILE="${HACKATHON_AWS_PROFILE:?HACKATHON_AWS_PROFILE is required}"
REGION="${AWS_REGION:-ca-central-1}"
CLUSTER="${CLUSTER_NAME:-agency2026}"
SERVICE="${SERVICE_NAME:-web}"
LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://localhost:5432/agency26}"

aws ssm put-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name /agency2026/database-url \
  --value "$LOCAL_URL" \
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

echo "DATABASE_URL switched to $LOCAL_URL — ECS picks up new env on next task start."
echo "Verify: curl -fsS https://<your-ALB-DNS>/api/health"
