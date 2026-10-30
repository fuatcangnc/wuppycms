#!/usr/bin/env bash
# wuppycms.com + www + docs + test → S3 (wuppycms-marketing) + CloudFront.
set -euo pipefail

BUCKET="wuppycms-marketing"
ZONE_ID="Z102382026TMX93H091UW"
REGION="us-east-1"
CF_ZONE="Z2FDTNDATAQYW2"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
NAMES=("wuppycms.com" "www.wuppycms.com" "docs.wuppycms.com" "test.wuppycms.com")

echo "==> ACM sertifikası"
CERT_ARN="$(aws acm list-certificates --region $REGION \
  --query "CertificateSummaryList[?DomainName=='wuppycms.com'].CertificateArn | [0]" --output text 2>/dev/null || true)"
if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" = "None" ]; then
  CERT_ARN="$(aws acm request-certificate --region $REGION \
    --domain-name wuppycms.com \
    --subject-alternative-names www.wuppycms.com docs.wuppycms.com test.wuppycms.com \
    --validation-method DNS --query CertificateArn --output text)"
  sleep 8
fi

for i in $(seq 1 20); do
  VAL_NAME="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' --output text 2>/dev/null || true)"
  VAL_VALUE="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' --output text 2>/dev/null || true)"
  [ -n "$VAL_NAME" ] && [ "$VAL_NAME" != "None" ] && break
  sleep 2
done
if [ -n "$VAL_NAME" ] && [ "$VAL_NAME" != "None" ]; then
  python3 - "$VAL_NAME" "$VAL_VALUE" <<'PY' > /tmp/mkt-acm.json
import json, sys
name, value = sys.argv[1:3]
print(json.dumps({"Comment":"ACM marketing","Changes":[{"Action":"UPSERT","ResourceRecordSet":{
  "Name":name,"Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":value}]}}]}))
PY
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file:///tmp/mkt-acm.json >/dev/null
fi

echo "==> Sertifika ISSUED bekleniyor"
for i in $(seq 1 48); do
  ST="$(aws acm describe-certificate --region $REGION --certificate-arn "$CERT_ARN" --query 'Certificate.Status' --output text)"
  [ "$ST" = "ISSUED" ] && break
  sleep 10
done
[ "$ST" = "ISSUED" ] || { echo "Sertifika ISSUED olmadı ($ST)"; exit 1; }

echo "==> OAC"
OAC_ID="$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='wuppycms-marketing-oac'].Id | [0]" --output text 2>/dev/null || true)"
if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  OAC_ID="$(aws cloudfront create-origin-access-control --origin-access-control-config '{
    "Name":"wuppycms-marketing-oac","Description":"marketing","OriginAccessControlOriginType":"s3",
    "SigningBehavior":"always","SigningProtocol":"sigv4"}' --query 'OriginAccessControl.Id' --output text)"
fi

echo "==> CloudFront distribution"
DIST_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?@=='wuppycms.com']].Id | [0]" --output text 2>/dev/null || true)"
if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  python3 - "$BUCKET" "$CERT_ARN" "$OAC_ID" "${NAMES[@]}" <<'PY' > /tmp/mkt-cf.json
import json, sys, time
bucket, cert, oac = sys.argv[1:4]
names = sys.argv[4:]
config = {
  "CallerReference": f"wuppycms-marketing-{int(time.time())}",
  "Aliases": {"Quantity": len(names), "Items": names},
  "DefaultRootObject": "index.html",
  "Origins": {"Quantity": 1, "Items": [{
    "Id": "s3-marketing",
    "DomainName": f"{bucket}.s3.us-east-1.amazonaws.com",
    "OriginAccessControlId": oac,
    "S3OriginConfig": {"OriginAccessIdentity": ""},
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-marketing",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": True,
  },
  "CustomErrorResponses": {"Quantity": 2, "Items": [
    {"ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10},
    {"ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10},
  ]},
  "Comment": "WuppyCMS marketing",
  "Enabled": True,
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": True,
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "ACMCertificateArn": cert, "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021", "CertificateSource": "acm",
  },
  "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}},
}
print(json.dumps(config))
PY
  DIST_ID="$(aws cloudfront create-distribution --distribution-config file:///tmp/mkt-cf.json \
    --query 'Distribution.Id' --output text)"
fi
DIST_ARN="arn:aws:cloudfront::${ACCOUNT}:distribution/${DIST_ID}"
DIST_DOMAIN="$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)"

echo "==> Bucket policy (OAC)"
python3 - "$BUCKET" "$ACCOUNT" "$DIST_ARN" <<'PY' > /tmp/mkt-bucket.json
import json, sys
bucket, account, dist = sys.argv[1:4]
print(json.dumps({"Version":"2012-10-17","Statement":[{
  "Sid":"AllowCloudFront","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},
  "Action":"s3:GetObject","Resource":f"arn:aws:s3:::{bucket}/*",
  "Condition":{"StringEquals":{"AWS:SourceArn":dist}}}]}))
PY
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/mkt-bucket.json

echo "==> Route53"
python3 - "$DIST_DOMAIN" "$CF_ZONE" "${NAMES[@]}" <<'PY' > /tmp/mkt-r53.json
import json, sys
target, cfzone = sys.argv[1:3]
names = sys.argv[3:]
changes = []
for name in names:
    for t in ("A", "AAAA"):
        changes.append({"Action": "UPSERT", "ResourceRecordSet": {
            "Name": name, "Type": t,
            "AliasTarget": {"HostedZoneId": cfzone, "DNSName": target, "EvaluateTargetHealth": False}}})
print(json.dumps({"Comment": "marketing -> CloudFront", "Changes": changes}))
PY
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file:///tmp/mkt-r53.json >/dev/null

echo "==> Deploy bekleniyor"
aws cloudfront wait distribution-deployed --id "$DIST_ID" || true
echo "wuppycms.com → $DIST_DOMAIN ($DIST_ID)"
