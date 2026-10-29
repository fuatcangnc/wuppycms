#!/usr/bin/env bash
# Close the three member accounts, keeping the 2435 management account.
#
# Run only in the 2435 management account CloudShell, and only after:
#   1. migrate-route53.sh has created the new zones in 2435.
#   2. The registrar NS records for the three domains point to the new zones.
#   3. You have confirmed that any credits you care about are in 2435
#      (AWS credits cannot be transferred between accounts).
#
# Account closure is a destructive, slow operation. The accounts enter
# PENDING_CLOSURE and AWS may keep them recoverable for a grace period.
set -euo pipefail

# Organization member accounts only. 732401078829 (reeywp) is not in this
# organization; it must be closed separately from its own root account.
ACCOUNTS=(
  "842422316871"
  "266380778167"
)

echo "Management account: 243581477449"
echo "Accounts to close: ${ACCOUNTS[*]}"
echo

for account in "${ACCOUNTS[@]}"; do
  echo "== closing $account"
  aws organizations close-account --account-id "$account" --output json || true
done

echo
echo "== current organization accounts"
aws organizations list-accounts \
  --query 'Accounts[].{Id:Id,Name:Name,Status:Status,Email:Email}' \
  --output table
