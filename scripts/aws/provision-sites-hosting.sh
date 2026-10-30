#!/usr/bin/env bash
# WuppyCMS yayın altyapısı — S3 + CloudFront (ADR 0022).
#
# Tek seferlik kurulum. Çalıştırmadan önce:
#   aws login --profile master
#   export AWS_PROFILE=master
#
# Ne kurar:
#   • S3 bucket  : tüm siteler `sites/<slug>/` altında (private, OAC)
#   • ACM cert   : *.sites.wuppycms.com (us-east-1, CloudFront zorunluluğu)
#   • CloudFront : viewer-request fonksiyonuyla Host → klasör yönlendirmesi
#   • Route53    : *.sites.wuppycms.com → dağıtım
#   • IAM user   : uygulama/worker için yalnız bu bucket + invalidation
#
# Idempotent: var olan kaynaklar yeniden kullanılır.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUCKET="${BUCKET:-wuppycms-sites}"
BASE_DOMAIN="${BASE_DOMAIN:-sites.wuppycms.com}"
ZONE_DOMAIN="${ZONE_DOMAIN:-wuppycms.com}"
ZONE_ID="${ZONE_ID:-Z102382026TMX93H091UW}"
REGION="us-east-1"          # CloudFront + ACM için zorunlu
IAM_USER="${IAM_USER:-wuppycms-deploy}"
FUNCTION_NAME="wuppycms-site-router"

echo "== S3 bucket ($BUCKET)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi
# Blok public access AÇIK kalır: erişim yalnız CloudFront OAC üzerinden.
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null

echo "== ACM sertifikası (*.$BASE_DOMAIN)"
CERT_ARN=$(aws acm list-certificates --region "$REGION" \
  --query "CertificateSummaryList[?DomainName=='*.$BASE_DOMAIN'].CertificateArn | [0]" --output text 2>/dev/null || echo "None")
if [ "$CERT_ARN" = "None" ] || [ -z "$CERT_ARN" ]; then
  CERT_ARN=$(aws acm request-certificate --region "$REGION" \
    --domain-name "*.$BASE_DOMAIN" \
    --validation-method DNS \
    --subject-alternative-names "$BASE_DOMAIN" \
    --query CertificateArn --output text)
  echo "  istendi: $CERT_ARN (DNS doğrulaması bekleniyor)"
  sleep 10
fi

# DNS doğrulama kayıtlarını zone'a yaz (idempotent).
echo "== ACM DNS doğrulama kayıtları"
VALIDATION=$(aws acm describe-certificate --region "$REGION" --certificate-arn "$CERT_ARN" \
  --query "Certificate.DomainValidationOptions[].ResourceRecord" --output json)
echo "$VALIDATION" | python3 - "$ZONE_ID" <<'PY'
import json, subprocess, sys
zone = sys.argv[1]
records = json.load(sys.stdin)
for record in records:
    name, value = record["Name"], record["Value"]
    payload = json.dumps({
        "Comment": "ACM validation (wuppycms)",
        "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": name, "Type": "CNAME", "TTL": 300,
                "ResourceRecords": [{"Value": value}],
            },
        }],
    })
    subprocess.run(
        ["aws", "route53", "change-resource-record-sets",
         "--hosted-zone-id", zone, "--change-batch", payload],
        check=False, stdout=subprocess.DEVNULL,
    )
    print("  upsert", name)
PY

echo "  sertifika ISSUED olana kadar bekleniyor…"
for _ in $(seq 1 60); do
  STATUS=$(aws acm describe-certificate --region "$REGION" --certificate-arn "$CERT_ARN" \
    --query "Certificate.Status" --output text)
  [ "$STATUS" = "ISSUED" ] && break
  sleep 10
done
echo "  durum: $STATUS"

echo "== CloudFront fonksiyonu ($FUNCTION_NAME)"
if aws cloudfront get-function --name "$FUNCTION_NAME" >/dev/null 2>&1; then
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query ETag --output text)
  aws cloudfront update-function --name "$FUNCTION_NAME" --if-match "$ETAG" \
    --function-config '{"Comment":"WuppyCMS site router","Runtime":"cloudfront-js-2.0"}' \
    --function-code "fileb://$ROOT/scripts/aws/cloudfront-site-router.js" >/dev/null
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query ETag --output text)
  FUNCTION_ARN=$(aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG" \
    --query FunctionSummary.FunctionMetadata.FunctionARN --output text)
else
  CREATED=$(aws cloudfront create-function --name "$FUNCTION_NAME" \
    --function-config '{"Comment":"WuppyCMS site router","Runtime":"cloudfront-js-2.0"}' \
    --function-code "fileb://$ROOT/scripts/aws/cloudfront-site-router.js" \
    --query 'FunctionSummary.[ETag,FunctionMetadata.FunctionARN]' --output text)
  ETAG=$(echo "$CREATED" | cut -f1)
  FUNCTION_ARN=$(echo "$CREATED" | cut -f2)
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG" >/dev/null
fi
echo "  arn: $FUNCTION_ARN"

echo "== CloudFront dağıtımı"
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='wuppycms-sites'].Id | [0]" --output text 2>/dev/null || echo "None")

if [ "$DIST_ID" = "None" ] || [ -z "$DIST_ID" ]; then
  # Bucket policy: yalnız bu dağıtım okuyabilir (OAC).
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  CONFIG=$(cat <<JSON
{
  "CallerReference": "wuppycms-sites-$(date +%s)",
  "Comment": "wuppycms-sites",
  "Enabled": true,
  "Aliases": { "Quantity": 1, "Items": ["*.$BASE_DOMAIN"] },
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "s3-$BUCKET",
      "DomainName": "$BUCKET.s3.$REGION.amazonaws.com",
      "OriginAccessControlId": "placeholder",
      "S3OriginConfig": { "OriginAccessIdentity": "" }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-$BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] },
    "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] },
    "ForwardedValues": { "QueryString": false, "Cookies": { "Forward": "none" } },
    "MinTTL": 0,
    "DefaultTTL": 3600,
    "MaxTTL": 86400,
    "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
    "FunctionAssociations": {
      "Quantity": 1,
      "Items": [{ "EventType": "viewer-request", "FunctionARN": "$FUNCTION_ARN" }]
    }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 403, "ResponsePagePath": "/sites/__missing__/404.html",
      "ResponseCode": "404", "ErrorCachingMinTTL": 10
    }]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Restrictions": { "GeoRestriction": { "RestrictionType": "none", "Quantity": 0 } },
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true
}
JSON
)
  # OAC oluştur (yoksa).
  OAC_ID=$(aws cloudfront list-origin-access-controls \
    --query "OriginAccessControlList.Items[?Name=='wuppycms-sites-oac'].Id | [0]" --output text 2>/dev/null || echo "None")
  if [ "$OAC_ID" = "None" ] || [ -z "$OAC_ID" ]; then
    OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
      '{"Name":"wuppycms-sites-oac","Description":"WuppyCMS sites","SigningProtocol":"sigv4","SigningBehavior":"always","OriginAccessControlOriginType":"s3"}' \
      --query 'OriginAccessControl.Id' --output text)
  fi
  CONFIG=$(echo "$CONFIG" | sed "s/placeholder/$OAC_ID/")
  DIST=$(echo "$CONFIG" | aws cloudfront create-distribution --distribution-config file:///dev/stdin \
    --query 'Distribution.[Id,DomainName]' --output text)
  DIST_ID=$(echo "$DIST" | cut -f1)
  DIST_DOMAIN=$(echo "$DIST" | cut -f2)
  echo "  oluşturuldu: $DIST_ID ($DIST_DOMAIN)"

  # Bucket policy — yalnız bu dağıtım.
  cat > /tmp/wuppycms-bucket-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$BUCKET/*",
    "Condition": {
      "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID" }
    }
  }]
}
JSON
  aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/wuppycms-bucket-policy.json
  rm -f /tmp/wuppycms-bucket-policy.json
else
  DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)
  echo "  mevcut: $DIST_ID ($DIST_DOMAIN)"
fi

echo "== Route53 (*.$BASE_DOMAIN → CloudFront)"
python3 - "$ZONE_ID" "$BASE_DOMAIN" "$DIST_DOMAIN" <<'PY'
import json, subprocess, sys
zone, domain, target = sys.argv[1], sys.argv[2], sys.argv[3]
payload = json.dumps({
    "Comment": "WuppyCMS sites wildcard",
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": f"*.{domain}", "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "Z2FDTNDATAQYW2",
                "DNSName": target,
                "EvaluateTargetHealth": False,
            },
        },
    }],
})
subprocess.run(["aws", "route53", "change-resource-record-sets",
                "--hosted-zone-id", zone, "--change-batch", payload], check=True,
               stdout=subprocess.DEVNULL)
print("  upsert", f"*.{domain}")
PY

echo "== IAM kullanıcı ($IAM_USER)"
if ! aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1; then
  aws iam create-user --user-name "$IAM_USER" >/dev/null
fi
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
cat > /tmp/wuppycms-deploy-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::$BUCKET", "arn:aws:s3:::$BUCKET/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      "Resource": "arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID"
    }
  ]
}
JSON
aws iam put-user-policy --user-name "$IAM_USER" --policy-name wuppycms-deploy \
  --policy-document file:///tmp/wuppycms-deploy-policy.json
rm -f /tmp/wuppycms-deploy-policy.json

if ! aws iam list-access-keys --user-name "$IAM_USER" --query 'AccessKeyMetadata[0].AccessKeyId' --output text | grep -qv None; then
  aws iam create-access-key --user-name "$IAM_USER" --output json > "$ROOT/.aws-deploy-key.json"
  echo "  yeni anahtar: $ROOT/.aws-deploy-key.json  (git'e EKLEMEYİN)"
fi

cat <<MSG

Tamamlandı.

  Bucket            : $BUCKET
  Dağıtım           : $DIST_ID
  Dağıtım adresi    : $DIST_DOMAIN
  Site taban adresi : *.$BASE_DOMAIN
  Sertifika         : $CERT_ARN

Uygulama env'ine eklenecekler (apps/builder/.dev.vars ve VM):
  AWS_S3_BUCKET=$BUCKET
  AWS_CLOUDFRONT_DISTRIBUTION_ID=$DIST_ID
  AWS_SITES_DOMAIN=$BASE_DOMAIN
  AWS_ACCESS_KEY_ID=...        # .aws-deploy-key.json
  AWS_SECRET_ACCESS_KEY=...
  DEPLOY_WORKER_URL=http://127.0.0.1:8790
  DEPLOY_WORKER_SECRET=...     # openssl rand -hex 32
MSG
