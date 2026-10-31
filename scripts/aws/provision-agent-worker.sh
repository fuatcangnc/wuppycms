#!/usr/bin/env bash
# Ajan turlarını asenkron çalıştıran invoker Lambda.
# app → Lambda Invoke(Event) → invoker → POST /api/agent/execute (uzun süre bekler)
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
FUNCTION="wuppycms-agent"
EXECUTE_URL="${EXECUTE_URL:-https://app.wuppycms.com/api/agent/execute}"
SECRET="${AGENT_SECRET:-${DEPLOY_WORKER_SECRET:-}}"
[ -n "$SECRET" ] || { echo "AGENT_SECRET/DEPLOY_WORKER_SECRET gerekli"; exit 1; }
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="$(aws iam get-role --role-name wuppycms-app-role --query Role.Arn --output text)"

WORK="$(mktemp -d)"
cat > "$WORK/index.mjs" <<'EOF'
export const handler = async (event) => {
  const res = await fetch(process.env.EXECUTE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-secret": process.env.AGENT_SECRET ?? "" },
    body: JSON.stringify(event),
  });
  return { status: res.status };
};
EOF
python3 - "$WORK" <<'PY'
import sys, zipfile, pathlib
work = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(work / "function.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(work / "index.mjs", "index.mjs")
PY

if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION" --zip-file "fileb://$WORK/function.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION"
  aws lambda update-function-configuration --function-name "$FUNCTION" \
    --environment "Variables={EXECUTE_URL=$EXECUTE_URL,AGENT_SECRET=$SECRET}" \
    --timeout 300 --memory-size 256 >/dev/null
else
  aws lambda create-function --function-name "$FUNCTION" \
    --runtime nodejs22.x --handler index.handler --zip-file "fileb://$WORK/function.zip" \
    --role "$ROLE_ARN" --timeout 300 --memory-size 256 \
    --environment "Variables={EXECUTE_URL=$EXECUTE_URL,AGENT_SECRET=$SECRET}" >/dev/null
  aws lambda wait function-active --function-name "$FUNCTION"
fi

cat > "$WORK/invoke-policy.json" <<EOF
{"Version":"2012-10-17","Statement":[{
  "Effect":"Allow","Action":"lambda:InvokeFunction",
  "Resource":"arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FUNCTION}"}]}
EOF
aws iam put-role-policy --role-name wuppycms-app-role \
  --policy-name wuppycms-agent-invoke --policy-document "file://$WORK/invoke-policy.json"
echo "Ajan işçisi hazır: $FUNCTION"
