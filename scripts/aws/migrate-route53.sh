#!/usr/bin/env bash
# WuppyCMS DNS migration: 842422316871 -> 243581477449
#
# Run in the 2435 management account's CloudShell (or with a valid 2435 CLI
# session). The script assumes the source account's AccountFullAccessRole,
# reads the three public hosted zones, creates equivalent public zones in
# 2435, copies all non-NS/SOA records, and prints the new delegation NS.
#
# After this script: update the registrar NS for each domain, wait for DNS
# propagation, then run close-accounts.sh. Do not close 8424 before the NS
# update; closing it deletes the source hosted zones.
set -euo pipefail

SRC_ACCOUNT="842422316871"
SRC_ROLE="arn:aws:iam::${SRC_ACCOUNT}:role/AccountFullAccessRole"
REGION="us-east-1"
export AWS_DEFAULT_REGION="$REGION"

ZONES=(
  "wuppycms.com.:Z07738792TZ7ZAO365YVG"
  "cigce.com.tr.:Z010025724NFF22P5ABP5"
  "aracprojem.com.tr.:Z09278251S5ZXIYFPQX13"
)

echo "== source role: $SRC_ROLE"
CREDS=$(aws sts assume-role \
  --role-arn "$SRC_ROLE" \
  --role-session-name wuppycms-dns-migration \
  --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
  --output text)
read -r SRC_AK SRC_SK SRC_ST <<< "$CREDS"

src() {
  AWS_ACCESS_KEY_ID="$SRC_AK" \
  AWS_SECRET_ACCESS_KEY="$SRC_SK" \
  AWS_SESSION_TOKEN="$SRC_ST" \
  AWS_DEFAULT_REGION="$REGION" \
  aws "$@"
}

dst() {
  AWS_DEFAULT_REGION="$REGION" aws "$@"
}

for entry in "${ZONES[@]}"; do
  name="${entry%%:*}"
  old_id="${entry##*:}"
  echo
  echo "===== $name (source $old_id)"

  old_json=$(src route53 list-resource-record-sets --hosted-zone-id "$old_id" --output json)
  new_id=$(dst route53 list-hosted-zones-by-name --dns-name "$name" \
    --query "HostedZones[?Name=='$name'].Id | [0]" --output text 2>/dev/null || true)

  if [ -z "$new_id" ] || [ "$new_id" = "None" ]; then
    echo "creating hosted zone in 2435..."
    new_id=$(dst route53 create-hosted-zone \
      --name "$name" \
      --caller-reference "wuppycms-dns-$(date +%s)-${name%%.*}" \
      --query 'HostedZone.Id' --output text)
  else
    echo "using existing hosted zone: $new_id"
  fi
  new_id="${new_id#/hostedzone/}"

  echo "$old_json" | python3 -c '
import json, sys
data = json.load(sys.stdin)
records = [r for r in data.get("ResourceRecordSets", []) if r.get("Type") not in ("NS", "SOA")]
json.dump({"Changes": [{"Action": "UPSERT", "ResourceRecordSet": r} for r in records]}, sys.stdout)
' > /tmp/wuppycms-route53-change.json

  changes=$(python3 -c 'import json; print(len(json.load(open("/tmp/wuppycms-route53-change.json"))["Changes"]))')
  if [ "$changes" -gt 0 ]; then
    dst route53 change-resource-record-sets \
      --hosted-zone-id "$new_id" \
      --change-batch file:///tmp/wuppycms-route53-change.json >/dev/null
    echo "records copied: $changes"
  else
    echo "no non-NS/SOA records to copy"
  fi

  echo "new hosted zone id: $new_id"
  echo "NEW NS:"
  dst route53 get-hosted-zone --id "$new_id" \
    --query 'DelegationSet.NameServers' --output text | tr '\t' '\n' | sed 's/^/  /'
done

echo
echo "DNS zones created in 2435."
echo "Next: update the registrar NS for all three domains, wait for propagation,"
echo "then run scripts/aws/close-accounts.sh."
