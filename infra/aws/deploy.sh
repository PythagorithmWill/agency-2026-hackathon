#!/usr/bin/env bash
#
# Glassbox — deploy to ECS Fargate.
#
# Required environment:
#   AWS_ACCOUNT_ID        12-digit AWS account
#   AWS_REGION            (default: ca-central-1)
#   ECR_REPO_URL          xxxx.dkr.ecr.ca-central-1.amazonaws.com/glassbox
#   ECS_CLUSTER_NAME      (default: glassbox)
#   ECS_SERVICE_NAME      (default: glassbox-web)
#
# Required AWS roles + resources, provisioned beforehand:
#   - IAM: glassbox-ecs-execution, glassbox-ecs-task
#   - Secrets Manager: glassbox/database-url
#   - SSM Parameter:   /glassbox/build-commit
#   - ECR: glassbox repo
#   - ECS cluster + service + task family
#   - ALB + target group + ACM cert + Route53 record
#
# Usage:
#   ./infra/aws/deploy.sh
#
set -euo pipefail

AWS_REGION="${AWS_REGION:-ca-central-1}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-glassbox}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-glassbox-web}"

: "${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
: "${ECR_REPO_URL:?ECR_REPO_URL is required (e.g. ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/glassbox)}"

BUILD_COMMIT="$(git rev-parse --short HEAD)"
BUILD_TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
IMAGE_TAG="${BUILD_COMMIT}-${BUILD_TIMESTAMP}"

echo "→ build commit:    ${BUILD_COMMIT}"
echo "→ build timestamp: ${BUILD_TIMESTAMP}"
echo "→ image tag:       ${IMAGE_TAG}"
echo

echo "→ docker build glassbox:${IMAGE_TAG}"
docker build \
  --file infra/Dockerfile \
  --build-arg "BUILD_COMMIT=${BUILD_COMMIT}" \
  --build-arg "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}" \
  --tag "glassbox:${IMAGE_TAG}" \
  --tag "${ECR_REPO_URL}:${IMAGE_TAG}" \
  --tag "${ECR_REPO_URL}:latest" \
  .

echo
echo "→ ECR login"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REPO_URL%/*}"

echo
echo "→ docker push ${ECR_REPO_URL}:${IMAGE_TAG}"
docker push "${ECR_REPO_URL}:${IMAGE_TAG}"
docker push "${ECR_REPO_URL}:latest"

echo
echo "→ rendering task-definition.json"
mkdir -p .deploy
sed \
  -e "s|__AWS_ACCOUNT_ID__|${AWS_ACCOUNT_ID}|g" \
  -e "s|__ECR_REPO_URL__|${ECR_REPO_URL}|g" \
  -e "s|__IMAGE_TAG__|${IMAGE_TAG}|g" \
  infra/aws/task-definition.json > .deploy/task-definition.json

echo
echo "→ register new task definition revision"
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --region "${AWS_REGION}" \
  --cli-input-json "file://.deploy/task-definition.json" \
  --query "taskDefinition.taskDefinitionArn" \
  --output text)
echo "   ${TASK_DEF_ARN}"

echo
echo "→ update ECS service ${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}"
aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER_NAME}" \
  --service "${ECS_SERVICE_NAME}" \
  --task-definition "${TASK_DEF_ARN}" \
  --force-new-deployment \
  --query "service.deployments[0].id" \
  --output text

echo
echo "→ wait for service stable"
aws ecs wait services-stable \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER_NAME}" \
  --services "${ECS_SERVICE_NAME}"

echo
echo "→ post-deploy /api/health smoke test"
ALB_DNS="${ALB_DNS_OVERRIDE:-$(aws elbv2 describe-load-balancers \
  --region "${AWS_REGION}" \
  --names glassbox-alb \
  --query "LoadBalancers[0].DNSName" \
  --output text 2>/dev/null || echo "")}"
if [ -n "${ALB_DNS}" ]; then
  echo "   probing http://${ALB_DNS}/api/health"
  if curl -fsS --max-time 30 "http://${ALB_DNS}/api/health" >/dev/null; then
    echo "   /api/health OK"
  else
    echo "   /api/health did NOT return 2xx — investigate"
    exit 1
  fi
else
  echo "   skipping (no ALB DNS — set ALB_DNS_OVERRIDE to enable)"
fi

echo
echo "✓ Glassbox deploy complete"
echo "  image:  ${ECR_REPO_URL}:${IMAGE_TAG}"
echo "  task:   ${TASK_DEF_ARN}"
