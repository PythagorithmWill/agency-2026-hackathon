# Glassbox — AWS Deployment

Production deploy on **AWS ECS Fargate** behind an **Application Load Balancer**, with **CloudFront** for static caching and HTTPS edge termination. Region: **`ca-central-1`** (data residency).

## Provisioning order

These resources must exist before `infra/aws/deploy.sh` will succeed. Provision once per environment.

| # | Resource | Notes |
|---|---|---|
| 1 | **VPC + 2 public subnets + 2 private subnets** | Two AZs minimum. Internet gateway on the public subnets; NAT gateway for private. |
| 2 | **Security groups** | `glassbox-alb-sg` (ingress 80/443 from 0.0.0.0/0); `glassbox-ecs-sg` (ingress 3000 from `glassbox-alb-sg` only). |
| 3 | **IAM roles** | `glassbox-ecs-execution` (AWS managed `AmazonECSTaskExecutionRolePolicy` + `SecretsManagerReadWrite` scoped to the `glassbox/*` prefix). `glassbox-ecs-task` (read-only Secrets Manager + CloudWatch Logs). |
| 4 | **Secrets Manager** | `glassbox/database-url` — Render Postgres replica connection string. |
| 5 | **SSM Parameter Store** | `/glassbox/build-commit` — populated by deploy.sh per release. |
| 6 | **ECR** | `glassbox` repository. Lifecycle policy: keep 10 most-recent images. |
| 7 | **CloudWatch Log Group** | `/ecs/glassbox-prod` — created automatically by the task definition (`awslogs-create-group`) on first run. |
| 8 | **ECS cluster + service** | Cluster: `glassbox`. Service: `glassbox-web`, desired count 1, deployment min/max 100/200. Target group: HTTP/3000, healthcheck `/api/health` interval 30s. |
| 9 | **ACM certificate** | Issued in `us-east-1` (CloudFront requirement). Subject: your domain. DNS validation. |
| 10 | **Route 53 record** | Alias to the CloudFront distribution. |
| 11 | **CloudFront distribution** | Render `cloudfront-config.json` with `__ALB_DNS__`, `__AWS_ACCOUNT_ID__`, `__ACM_CERT_ID__`, `__DOMAIN_NAME__` substituted. |

## GitHub Actions secrets

Required for `.github/workflows/deploy.yml`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (or hardcoded to `ca-central-1`)
- `AWS_ACCOUNT_ID`
- `ECR_REPO_URL` (e.g. `123456789012.dkr.ecr.ca-central-1.amazonaws.com/glassbox`)
- `ECS_CLUSTER_NAME` (default `glassbox`)
- `ECS_SERVICE_NAME` (default `glassbox-web`)

## Deploy

```bash
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=ca-central-1
export ECR_REPO_URL=123456789012.dkr.ecr.ca-central-1.amazonaws.com/glassbox
./infra/aws/deploy.sh
```

The script:

1. Builds the Docker image with `BUILD_COMMIT` and `BUILD_TIMESTAMP` baked into the runtime env.
2. Tags as `glassbox:${commit-short-sha}-${timestamp}` AND `:latest`.
3. Pushes to ECR.
4. Renders `task-definition.json` with the new image tag.
5. Registers a new task-definition revision.
6. Triggers ECS service rolling update with `--force-new-deployment`.
7. Blocks on `services-stable`.
8. Pings `/api/health` against the ALB — fails the deploy if unhealthy.

## Cost estimate (light load, 1 task)

| Item | Monthly |
|---|---|
| ECS Fargate (1024 CPU / 2048 MB, 24/7) | ~$32 |
| ALB | ~$22 |
| CloudFront (5 GB egress) | ~$0.50 |
| ECR storage (10 images × 200 MB) | ~$0.20 |
| Secrets Manager (1 secret) | ~$0.40 |
| CloudWatch Logs (1 GB/mo) | ~$0.50 |
| Data transfer (10 GB) | ~$1 |
| **Total** | **~$60-90/mo** |

NAT gateway adds ~$32/mo if used; the demo can run private subnets via VPC endpoints to avoid that cost.

## Failover modes

- **Render replica unreachable**: `/api/health` returns 503 with the failed source named. ECS marks the task unhealthy. ALB routes around it. Operator runs `scripts/failover-to-local.sh` (carry-forward from prior session) to switch DATABASE_URL.
- **CloudFront origin returns 5xx**: CloudFront returns the cached error page until the next successful origin response.
- **All sources down**: Glassbox falls back to `mockComparables` for `/evaluate` and an empty result for `/search`. The fallback emits a `SHIPPING_MOCK_FALLBACK` line to CloudWatch — operator can grep the log group.

## Rollback

```bash
aws ecs update-service \
  --cluster glassbox \
  --service glassbox-web \
  --task-definition <previous-revision-arn> \
  --force-new-deployment
```

Previous revisions are visible in the ECS console under the `glassbox-prod` task family.
