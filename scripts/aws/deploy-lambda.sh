#!/usr/bin/env bash
# WuppyCMS uygulamasını AWS Lambda'ya (container + Litestream) dağıtır.
# Önkoşul: AWS oturumu (aws login --profile master), Docker.
set -euo pipefail

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGION="${AWS_REGION:-us-east-1}"
APP="wuppycms-app"
ECR_REPO="${APP}"
DB_BUCKET="${DB_BUCKET:-wuppycms-app-db-${ACCOUNT}}"
MEDIA_BUCKET="${MEDIA_BUCKET:-wuppycms-media}"
ROLE="${APP}-role"
IMAGE="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/apps/builder/.dev.vars}"

echo "==> S3 (DB) $DB_BUCKET"
if ! aws s3api head-bucket --bucket "$DB_BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$DB_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$DB_BUCKET" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-bucket-versioning --bucket "$DB_BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket "$DB_BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

echo "==> S3 (medya) $MEDIA_BUCKET"
if ! aws s3api head-bucket --bucket "$MEDIA_BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$MEDIA_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$MEDIA_BUCKET" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$MEDIA_BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

echo "==> ECR $ECR_REPO"
aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name "$ECR_REPO" >/dev/null
aws ecr get-login-password | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com" >/dev/null

echo "==> Docker imajı"
docker buildx build --platform linux/amd64 --provenance=false --sbom=false --load -f "$ROOT/apps/builder/Dockerfile.aws" -t "$IMAGE" "$ROOT"
docker push "$IMAGE"

echo "==> IAM rolü $ROLE"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
fi
cat > /tmp/wuppycms-lambda-policy.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::${DB_BUCKET}","arn:aws:s3:::${MEDIA_BUCKET}"]},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::${DB_BUCKET}/*","arn:aws:s3:::${MEDIA_BUCKET}/*"]}
  ]
}
EOF
aws iam put-role-policy --role-name "$ROLE" --policy-name "${APP}-s3" \
  --policy-document file:///tmp/wuppycms-lambda-policy.json
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"

echo "==> Lambda env"
python3 - "$ENV_FILE" /tmp/wuppycms-lambda-env.json "$DB_BUCKET" "$MEDIA_BUCKET" "$DB_BUCKET" <<'PY'
import json, sys
env_file, out, db_bucket, media_bucket, db_bucket2 = sys.argv[1:6]
vars = {}
for line in open(env_file, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    key = k.strip()
    if key in {"AWS_REGION","AWS_DEFAULT_REGION","AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_SESSION_TOKEN"}:
        continue
    vars[key] = v
vars.update({
    "DB_PATH": "/tmp/wuppycms.db",
    "DB_BUCKET": db_bucket,
    "MEDIA_BUCKET": media_bucket,
    "AGENT_INLINE": "1",
    "PORT": "8080",
    "MIGRATIONS_DIR": "/app/apps/builder/db/migrations",
    "NODE_ENV": "production",
    "BETTER_AUTH_URL": "https://app.wuppycms.com",
})
json.dump({"Variables": vars}, open(out, "w"))
print("env sayısı:", len(vars), "boyut:", len(json.dumps(vars)))
PY

echo "==> Lambda fonksiyonu $APP"
if aws lambda get-function --function-name "$APP" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$APP" --image-uri "$IMAGE" >/dev/null
  aws lambda wait function-updated --function-name "$APP"
  aws lambda update-function-configuration --function-name "$APP" \
    --role "$ROLE_ARN" --memory-size 2048 --timeout 300 \
    --environment file:///tmp/wuppycms-lambda-env.json >/dev/null
else
  aws lambda create-function --function-name "$APP" \
    --package-type Image --code ImageUri="$IMAGE" --role "$ROLE_ARN" \
    --architectures x86_64 --memory-size 2048 --timeout 300 \
    --environment file:///tmp/wuppycms-lambda-env.json >/dev/null
  aws lambda wait function-active --function-name "$APP"
fi

echo "==> Function URL"
if ! aws lambda get-function-url-config --function-name "$APP" >/dev/null 2>&1; then
  aws lambda create-function-url-config --function-name "$APP" --auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$APP" --statement-id public-url \
    --action lambda:InvokeFunctionUrl --principal '*' \
    --function-url-auth-type NONE >/dev/null
fi
URL="$(aws lambda get-function-url-config --function-name "$APP" --query FunctionUrl --output text)"

echo
echo "Lambda URL: $URL"
echo "Test: curl -s -o /dev/null -w '%{http_code}' ${URL}api/health"
