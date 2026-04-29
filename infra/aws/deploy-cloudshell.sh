#!/usr/bin/env bash
# CloudShell deploy script for Glassbox.
#
# Usage (run from AWS CloudShell after `aws sso login` or with the
# workshop participant role active):
#
#   curl -fsSL https://raw.githubusercontent.com/PythagorithmWill/agency-2026-hackathon/rebuild-suitability/infra/aws/deploy-cloudshell.sh | bash
#
# What it does:
#   1. Clones the repo at rebuild-suitability.
#   2. Logs into ECR.
#   3. Builds the Docker image from infra/Dockerfile.
#   4. Pushes to the glassbox ECR repository.
#   5. Creates the App Runner ECR access role (if missing).
#   6. Creates an App Runner service that pulls the image.
#   7. Prints the service URL.
#
# Idempotent: re-running updates the image and triggers a redeploy.

set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo us-east-1)}}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REPO_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/glassbox"
IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)"
SERVICE_NAME="glassbox"
ACCESS_ROLE_NAME="AppRunnerECRAccessRole-glassbox"

echo "▶ Deploying Glassbox to ${REGION} on account ${ACCOUNT}"

# 1. Clone repo
WORKDIR="$(mktemp -d -t glassbox-deploy.XXXX)"
trap 'rm -rf "$WORKDIR"' EXIT
git clone --depth 1 --branch rebuild-suitability \
  https://github.com/PythagorithmWill/agency-2026-hackathon.git \
  "$WORKDIR/repo"
cd "$WORKDIR/repo"

# 2. ECR login (self-create the repo if missing — idempotent)
if ! aws ecr describe-repositories --repository-names glassbox --region "$REGION" >/dev/null 2>&1; then
  echo "▶ Creating ECR repository 'glassbox' in ${REGION}..."
  aws ecr create-repository --repository-name glassbox --region "$REGION" >/dev/null
fi
aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REPO_URI"

# 3. Build — force --no-cache so any past layer that captured an
# outdated runtime ENV (e.g. missing HOSTNAME=0.0.0.0) is rebuilt.
echo "▶ Building image (Dockerfile=infra/Dockerfile, no cache)..."
docker build \
  -f infra/Dockerfile \
  --no-cache \
  -t "${REPO_URI}:${IMAGE_TAG}" \
  -t "${REPO_URI}:latest" \
  --build-arg BUILD_COMMIT="$(git rev-parse --short HEAD)" \
  --build-arg BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  .

# 4. Push
echo "▶ Pushing image..."
docker push "${REPO_URI}:${IMAGE_TAG}"
docker push "${REPO_URI}:latest"

# 5. Ensure App Runner ECR access role exists
if ! aws iam get-role --role-name "$ACCESS_ROLE_NAME" >/dev/null 2>&1; then
  echo "▶ Creating App Runner ECR access role..."
  aws iam create-role \
    --role-name "$ACCESS_ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Service": "build.apprunner.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null
  aws iam attach-role-policy \
    --role-name "$ACCESS_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  # Eventual consistency on new IAM roles.
  sleep 8
fi
ACCESS_ROLE_ARN="$(aws iam get-role --role-name "$ACCESS_ROLE_NAME" --query Role.Arn --output text)"

# 6. Create or update App Runner service.
#
# The DATABASE_URL secret is fetched from Secrets Manager at deploy time
# and injected as a plain env var on the service. We tried the App Runner
# native RuntimeEnvironmentSecrets path but that needs an InstanceRoleArn
# with secretsmanager:GetSecretValue, which the workshop participant role
# may not be allowed to create. The secret value still lives in Secrets
# Manager — App Runner reads it once during create-service.
DB_URL="$(aws secretsmanager get-secret-value \
  --secret-id glassbox/database-url \
  --region "$REGION" \
  --query SecretString --output text)"
if [[ -z "$DB_URL" || "$DB_URL" == "None" ]]; then
  echo "✗ DATABASE_URL secret missing in Secrets Manager. Aborting."
  exit 1
fi

EXISTING_ARN="$(aws apprunner list-services --region "$REGION" \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" \
  --output text)"

# If a service exists in CREATE_FAILED, delete it first so we can build
# fresh with whatever fixes are in this run (env vars / image / etc).
if [[ -n "$EXISTING_ARN" && "$EXISTING_ARN" != "None" ]]; then
  EXISTING_STATUS="$(aws apprunner describe-service --service-arn "$EXISTING_ARN" --region "$REGION" --query Service.Status --output text 2>/dev/null || echo UNKNOWN)"
  if [[ "$EXISTING_STATUS" == "CREATE_FAILED" || "$EXISTING_STATUS" == "DELETE_FAILED" ]]; then
    echo "▶ Existing service in $EXISTING_STATUS — deleting before recreate..."
    aws apprunner delete-service --service-arn "$EXISTING_ARN" --region "$REGION" >/dev/null
    # Wait for the delete to finish so create-service doesn't race the slot.
    for i in {1..40}; do
      gone="$(aws apprunner describe-service --service-arn "$EXISTING_ARN" --region "$REGION" --query Service.Status --output text 2>/dev/null || echo DELETED)"
      [[ "$gone" == "DELETED" ]] && break
      sleep 8
    done
    EXISTING_ARN=""
  fi
fi

# Build env-var JSON in a temp file to avoid shell-escape pain with the
# DATABASE_URL (contains @, /, ?, &, =).
ENV_JSON="$(mktemp)"
trap 'rm -f "$ENV_JSON"' EXIT

cat > "$ENV_JSON" <<EOF
{
  "AuthenticationConfiguration": { "AccessRoleArn": "$ACCESS_ROLE_ARN" },
  "AutoDeploymentsEnabled": false,
  "ImageRepository": {
    "ImageIdentifier": "${REPO_URI}:latest",
    "ImageRepositoryType": "ECR",
    "ImageConfiguration": {
      "Port": "3000",
      "RuntimeEnvironmentVariables": {
        "NODE_ENV": "production",
        "NEXT_TELEMETRY_DISABLED": "1",
        "HOSTNAME": "0.0.0.0",
        "DATABASE_URL": $(printf '%s' "$DB_URL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
      }
    }
  }
}
EOF

if [[ -z "$EXISTING_ARN" || "$EXISTING_ARN" == "None" ]]; then
  echo "▶ Creating App Runner service (first deploy)..."
  aws apprunner create-service \
    --region "$REGION" \
    --service-name "$SERVICE_NAME" \
    --source-configuration "file://$ENV_JSON" \
    --instance-configuration "Cpu=1024,Memory=2048" \
    --health-check-configuration "Protocol=HTTP,Path=/api/health,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=3" >/dev/null
else
  echo "▶ Updating existing App Runner service (env vars + image)..."
  aws apprunner update-service \
    --region "$REGION" \
    --service-arn "$EXISTING_ARN" \
    --source-configuration "file://$ENV_JSON" >/dev/null
fi

# 7. Print URL once available
echo ""
echo "▶ Waiting for service URL..."
for _ in {1..30}; do
  URL="$(aws apprunner list-services --region "$REGION" \
    --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceUrl | [0]" \
    --output text)"
  if [[ -n "$URL" && "$URL" != "None" ]]; then
    echo "✓ Glassbox is at https://${URL}"
    echo "  Initial deployment continues in the background — check the App Runner console for status."
    exit 0
  fi
  sleep 4
done

echo "Service is created. URL not yet assigned — check the App Runner console:"
echo "  https://${REGION}.console.aws.amazon.com/apprunner/home?region=${REGION}"
