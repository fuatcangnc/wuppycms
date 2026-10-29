#!/usr/bin/env bash
# WuppyCMS DNS migration fallback: 8424 -> 2435 without cross-account AssumeRole.
#
# Use this when migrate-route53.sh fails with AccessDenied on
# sts:AssumeRole. The records were exported from the 8424 account into
# route53-records.json. Run this inside the 2435 management CloudShell:
#
#   git pull
#   bash scripts/aws/migrate-route53-static.sh
#
# It creates the three public hosted zones in 2435 (or reuses existing ones),
# UPSERTs the exported records, and prints the new NS values.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZONES_FILE="$HERE/route53-records.json"
export AWS_DEFAULT_REGION="us-east-1"

if [ ! -f "$ZONES_FILE" ]; then
  echo "missing $ZONES_FILE" >&2
  exit 1
fi

python3 - "$ZONES_FILE" <<'PY'
import json
import subprocess
import sys
import time

zones = json.load(open(sys.argv[1], encoding="utf-8"))

def aws(args):
    p = subprocess.run(["aws", *args], capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr)
        raise SystemExit(p.returncode)
    return p.stdout

for zone in zones:
    name = zone["name"]
    records = zone.get("records", [])
    print(f"\n===== {name}")

    listed = json.loads(aws(["route53", "list-hosted-zones-by-name", "--dns-name", name]))
    existing = [z for z in listed.get("HostedZones", []) if z.get("Name") == name]
    if existing:
        new_id = existing[0]["Id"].split("/")[-1]
        print(f"using existing zone: {new_id}")
    else:
        created = json.loads(aws([
            "route53", "create-hosted-zone",
            "--name", name,
            "--caller-reference", f"wuppycms-static-{name}-{int(time.time())}",
        ]))
        new_id = created["HostedZone"]["Id"].split("/")[-1]
        print(f"created zone: {new_id}")

    if records:
        change = {
            "Changes": [
                {"Action": "UPSERT", "ResourceRecordSet": record}
                for record in records
            ]
        }
        change_path = f"/tmp/wuppycms-static-{new_id}.json"
        open(change_path, "w", encoding="utf-8").write(json.dumps(change))
        aws([
            "route53", "change-resource-record-sets",
            "--hosted-zone-id", new_id,
            "--change-batch", f"file://{change_path}",
        ])
        print(f"records copied: {len(records)}")
    else:
        print("no non-NS/SOA records to copy")

    host = json.loads(aws(["route53", "get-hosted-zone", "--id", new_id]))
    print("NEW NS:")
    for ns in host.get("DelegationSet", {}).get("NameServers", []):
        print(f"  {ns}")
PY

cat <<'MSG'

DNS zones created in 2435.
Next:
  1. Update the registrar NS for wuppycms.com, cigce.com.tr, aracprojem.com.tr.
  2. Wait for propagation (dig +short NS <domain>).
  3. Run: bash scripts/aws/close-accounts.sh
MSG
