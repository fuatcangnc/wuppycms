#!/usr/bin/env bash
# app.wuppycms.com → CloudFront → Lambda Function URL cutover.
# Idempotent: sertifika/distribution varsa yeniden kullanır.
set -euo pipefail

DOMAIN="app.wuppycms.com"
ZONE_ID="Z102382026TMX93H091UW"
REGION="us-east-1"
FUNCTION_URL="${FUNCTION_URL:-https://sbalbi5q4vc3snckzz5fu6f2ve0mqggy.lambda-url.us-east-1.on.aws/}"
ORIGIN_HOST="$(echo "$FUNCTION_URL" | sed -E 's#https://##; s#/.*##')"
CF_HOSTED_ZONE="Z2FDTNDATAQYW2"

echo "==> ACM sertifikası ($DOMAIN, us-east-1)"
CERT_ARN="$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn | [0]" --output text 2>/dev/null || true)"
if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" = "None" ]; then
  CERT_ARN="$(aws acm request-certificate --region $REGION --domain-name "$DOMAIN" \
    --validation-method DNS --query CertificateArn --output text)"
  echo "    istendi: $CERT_ARN"
  sleep 8
fi

# DNS doğrulama kaydı
VAL_NAME="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' --output text)"
VAL_VALUE="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' --output text)"
if [ -n "$VAL_NAME" ] && [ "$VAL_NAME" != "None" ]; then
  echo "==> Route53 doğrulama kaydı"
  python3 - "$VAL_NAME" "$VAL_VALUE" "$ZONE_ID" <<'PY' > /tmp/wuppycms-acm.json
import json, sys
name, value, zone = sys.argv[1:4]
print(json.dumps({"Comment":"ACM validation","Changes":[{"Action":"UPSERT","ResourceRecordSet":{
  "Name":name,"Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":value}]}}]}))
PY
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" \
    --change-batch file:///tmp/wuppycms-acm.json >/dev/null
fi

echo "==> Sertifika ISSUED bekleniyor (en fazla ~8 dk)"
for i in $(seq 1 48); do
  STATUS="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" \
    --query 'Certificate.Status' --output text)"
  [ "$STATUS" = "ISSUED" ] && break
  sleep 10
done
echo "    durum: $STATUS"
[ "$STATUS" = "ISSUED" ] || { echo "Sertifika ISSUED olmadı"; exit 1; }

echo "==> CloudFront distribution"
DIST_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?@=='$DOMAIN']].Id | [0]" --output text 2>/dev/null || true)"
if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  python3 - "$ORIGIN_HOST" "$CERT_ARN" "$DOMAIN" <<'PY' > /tmp/wuppycms-cf.json
import json, sys
origin_host, cert, domain = sys.argv[1:4]
config = {
  "CallerReference": f"wuppycms-app-{int(__import__('time').time())}",
  "Aliases": {"Quantity": 1, "Items": [domain]},
  "Origins": {"Quantity": 1, "Items": [{
    "Id": "lambda-app",
    "DomainName": origin_host,
    "CustomOriginConfig": {
      "HTTPPort": 80, "HTTPSPort": 443,
      "OriginProtocolPolicy": "https-only",
      "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
      "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5,
    },
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "lambda-app",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]},
    },
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
    "Compress": True,
  },
  "Comment": "WuppyCMS app (Lambda)",
  "Enabled": True,
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": True,
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "ACMCertificateArn": cert,
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "CertificateSource": "acm",
  },
  "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}},
}
print(json.dumps(config))
PY
  DIST_ID="$(aws cloudfront create-distribution --distribution-config file:///tmp/wuppycms-cf.json \
    --query 'Distribution.Id' --output text)"
  echo "    oluşturuldu: $DIST_ID"
else
  echo "    mevcut: $DIST_ID"
fi

DIST_DOMAIN="$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)"
echo "==> Route53 $DOMAIN → $DIST_DOMAIN"
python3 - "$DIST_DOMAIN" "$ZONE_ID" "$DOMAIN" "$CF_HOSTED_ZONE" <<'PY' > /tmp/wuppycms-r53.json
import json, sys
target, zone, domain, cfzone = sys.argv[1:5]
changes = []
for t in ("A", "AAAA"):
    changes.append({"Action": "UPSERT", "ResourceRecordSet": {
        "Name": domain, "Type": t,
        "AliasTarget": {"HostedZoneId": cfzone, "DNSName": target, "EvaluateTargetHealth": False},
    }})
print(json.dumps({"Comment": "app -> CloudFront (Lambda)", "Changes": changes}))
PY
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --change-batch file:///tmp/wuppycms-r53.json >/dev/null

echo "==> Distribution deploy bekleniyor"
aws cloudfront wait distribution-deployed --id "$DIST_ID" || true

echo
echo "app.wuppycms.com → $DIST_DOMAIN ($DIST_ID)"
echo "Test: curl -s -o /dev/null -w '%{http_code}' https://$DOMAIN/api/health"
