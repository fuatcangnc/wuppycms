#!/usr/bin/env bash
# WuppyCMS CodeBuild kurulumu (tek seferlik).
# Önkoşul: `aws login --profile master` (veya AWS_PROFILE=master).
# Bölge: us-east-1 · Bucket: wuppycms-sites · Dağıtım: E1UQLXES3DE59D
set -euo pipefail

PROJECT="${CODEBUILD_PROJECT:-wuppycms-build}"
BUCKET="${AWS_S3_BUCKET:-wuppycms-sites}"
DIST="${AWS_CLOUDFRONT_DISTRIBUTION_ID:-E1UQLXES3DE59D}"
ROLE="${CODEBUILD_ROLE:-wuppycms-codebuild}"
REGION="${AWS_REGION:-us-east-1}"
DEPLOY_USER="${DEPLOY_IAM_USER:-wuppycms-deploy}"
SPEC="$(cd "$(dirname "$0")/../.." && pwd)/scripts/aws/buildspec.yml"

echo "==> IAM rolü: $ROLE"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null
fi

cat > /tmp/wuppycms-codebuild-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::${BUCKET}", "arn:aws:s3:::${BUCKET}/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
EOF
aws iam put-role-policy --role-name "$ROLE" \
  --policy-name wuppycms-codebuild-policy \
  --policy-document file:///tmp/wuppycms-codebuild-policy.json

ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query 'Role.Arn' --output text)"

echo "==> CodeBuild projesi: $PROJECT"
python3 - "$PROJECT" "$SPEC" "$ROLE_ARN" "$BUCKET" "$DIST" "$REGION" <<'PY' > /tmp/wuppycms-codebuild-project.json
import json, sys
project, spec_path, role_arn, bucket, dist, region = sys.argv[1:7]
buildspec = open(spec_path, encoding="utf-8").read()
print(json.dumps({
  "name": project,
  "description": "WuppyCMS site build (on-demand)",
  "source": {"type": "NO_SOURCE", "buildspec": buildspec},
  "artifacts": {"type": "NO_ARTIFACTS"},
  "environment": {
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/standard:7.0",
    "computeType": "BUILD_GENERAL1_SMALL",
    "privilegedMode": False,
    "environmentVariables": [
      {"name": "BUCKET", "value": bucket, "type": "PLAINTEXT"},
      {"name": "DISTRIBUTION_ID", "value": dist, "type": "PLAINTEXT"},
      {"name": "NODE_ENV", "value": "production", "type": "PLAINTEXT"}
    ]
  },
  "serviceRole": role_arn,
  "timeoutInMinutes": 20,
  "queuedTimeoutInMinutes": 30,
  "logsConfig": {"cloudWatchLogs": {"status": "ENABLED"}}
}))
PY

if aws codebuild batch-get-projects --names "$PROJECT" --query 'projects[0].name' --output text 2>/dev/null | grep -q "$PROJECT"; then
  aws codebuild update-project --cli-input-json file:///tmp/wuppycms-codebuild-project.json >/dev/null
  echo "    güncellendi"
else
  aws codebuild create-project --cli-input-json file:///tmp/wuppycms-codebuild-project.json >/dev/null
  echo "    oluşturuldu"
fi

echo "==> Deploy IAM kullanıcısına StartBuild izni: $DEPLOY_USER"
aws iam put-user-policy --user-name "$DEPLOY_USER" \
  --policy-name wuppycms-codebuild-start \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"codebuild:StartBuild\",\"codebuild:BatchGetBuilds\"],
      \"Resource\":\"arn:aws:codebuild:${REGION}:$(aws sts get-caller-identity --query Account --output text):project/${PROJECT}\"
    }]
  }"

echo "Tamam. Uygulama .dev.vars dosyasına şunu ekleyin:"
echo "  AWS_CODEBUILD_PROJECT=$PROJECT"
