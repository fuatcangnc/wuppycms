#!/usr/bin/env bash
# Zamanlanmış yayın için EventBridge → invoker Lambda → /api/cron.
# Önkoşul: AWS oturumu (aws login --profile master) ve DEPLOY_WORKER_SECRET.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION="wuppycms-cron"
RULE="wuppycms-cron-5m"
CRON_URL="${CRON_URL:-https://app.wuppycms.com/api/cron}"
SECRET="${CRON_SECRET:-${DEPLOY_WORKER_SECRET:-}}"
[ -n "$SECRET" ] || { echo "CRON_SECRET/DEPLOY_WORKER_SECRET gerekli"; exit 1; }
ROLE_ARN="$(aws iam get-role --role-name wuppycms-app-role --query Role.Arn --output text)"

WORK="$(mktemp -d)"
cat > "$WORK/index.mjs" <<'EOF'
export const handler = async () => {
  const res = await fetch(process.env.CRON_URL, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });
  return { status: res.status, body: (await res.text()).slice(0, 300) };
};
EOF
python3 - "$WORK" <<'PY'
import sys, zipfile, pathlib
work = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(work / "function.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(work / "index.mjs", "index.mjs")
PY

if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION" \
    --zip-file "fileb://$WORK/function.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION"
  aws lambda update-function-configuration --function-name "$FUNCTION" \
    --environment "Variables={CRON_URL=$CRON_URL,CRON_SECRET=$SECRET}" >/dev/null
else
  aws lambda create-function --function-name "$FUNCTION" \
    --runtime nodejs22.x --handler index.handler \
    --zip-file "fileb://$WORK/function.zip" \
    --role "$ROLE_ARN" --timeout 60 --memory-size 128 \
    --environment "Variables={CRON_URL=$CRON_URL,CRON_SECRET=$SECRET}" >/dev/null
  aws lambda wait function-active --function-name "$FUNCTION"
fi

aws events put-rule --name "$RULE" --schedule-expression "rate(5 minutes)" --state ENABLED >/dev/null
FN_ARN="$(aws lambda get-function --function-name "$FUNCTION" --query Configuration.FunctionArn --output text)"
aws lambda add-permission --function-name "$FUNCTION" --statement-id events-cron \
  --action lambda:InvokeFunction --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE" >/dev/null 2>&1 || true
aws events put-targets --rule "$RULE" --targets "Id=1,Arn=$FN_ARN" >/dev/null

echo "Cron kuruldu: $RULE (5 dk) → $FUNCTION"
aws lambda invoke --function-name "$FUNCTION" --payload '{}' "$WORK/out.json" >/dev/null
cat "$WORK/out.json"; echo
