#!/usr/bin/env bash
# Create the WuppyCMS Lightsail host in the 2435 management account.
#
# Run in the 2435 CloudShell:
#   cd ~/wuppycms
#   git pull
#   bash scripts/aws/create-lightsail.sh
#
# Creates:
#   - Lightsail Ubuntu 24.04 instance, 2 GB / 2 vCPU / 60 GB SSD plan
#   - Static IPv4 and attaches it
#   - Firewall: 22, 80, 443
#   - SSH key at ~/.ssh/lightsail-default-key.pem
#   - A records for wuppycms.com, app, www, docs, test -> static IP
set -euo pipefail

REGION="us-east-1"
AZ="${REGION}a"
NAME="wuppycms"
BUNDLE="medium_2_0"
BLUEPRINT="ubuntu_24_04"
STATIC_IP_NAME="wuppycms-ip"
HOSTED_ZONE_ID="Z102382026TMX93H091UW" # wuppycms.com in 2435
KEY_PATH="$HOME/.ssh/lightsail-default-key.pem"

echo "== checking instance"
if ! aws lightsail get-instance --region "$REGION" --instance-name "$NAME" >/dev/null 2>&1; then
  echo "== creating $NAME ($BUNDLE, $BLUEPRINT)"
  aws lightsail create-instances \
    --region "$REGION" \
    --instance-names "$NAME" \
    --availability-zone "$AZ" \
    --blueprint-id "$BLUEPRINT" \
    --bundle-id "$BUNDLE" \
    --tags key=app,value=wuppycms >/dev/null
else
  echo "== instance already exists"
fi

echo "== waiting for running"
for _ in $(seq 1 40); do
  state=$(aws lightsail get-instance --region "$REGION" --instance-name "$NAME" --query 'instance.state.name' --output text)
  [ "$state" = "running" ] && break
  sleep 5
done
[ "$state" = "running" ] || { echo "instance did not reach running (state=$state)" >&2; exit 1; }

echo "== static IP"
if ! aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" >/dev/null 2>&1; then
  aws lightsail allocate-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" >/dev/null
fi
aws lightsail attach-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" --instance-name "$NAME" >/dev/null
IP=$(aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.ipAddress' --output text)

echo "== firewall"
aws lightsail put-instance-public-ports --region "$REGION" --instance-name "$NAME" --port-infos '[
  {"fromPort":22,"toPort":22,"protocol":"tcp"},
  {"fromPort":80,"toPort":80,"protocol":"tcp"},
  {"fromPort":443,"toPort":443,"protocol":"tcp"}
]' >/dev/null

echo "== SSH key"
mkdir -p "$HOME/.ssh"
aws lightsail download-default-key-pair --region "$REGION" --query 'privateKeyBase64' --output text | base64 -d > "$KEY_PATH"
chmod 600 "$KEY_PATH"

echo "== DNS A records -> $IP"
python3 - "$HOSTED_ZONE_ID" "$IP" <<'PY'
import json, subprocess, sys
zone, ip = sys.argv[1], sys.argv[2]
names = ["wuppycms.com.", "app.wuppycms.com.", "www.wuppycms.com.", "docs.wuppycms.com.", "test.wuppycms.com."]
changes = [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
        "Name": name,
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": ip}],
    },
} for name in names]
subprocess.run([
    "aws", "route53", "change-resource-record-sets",
    "--hosted-zone-id", zone,
    "--change-batch", json.dumps({"Changes": changes}),
], check=True)
print("updated:", ", ".join(names))
PY

cat <<MSG

Lightsail is ready.

  IP:  $IP
  SSH: ssh -i $KEY_PATH ubuntu@$IP

Next:
  1. Run scripts/aws/bootstrap-lightsail.sh on the host.
  2. Add secrets to apps/builder/.dev.vars on the host.
  3. Open https://wuppycms.com and https://app.wuppycms.com.

MSG
