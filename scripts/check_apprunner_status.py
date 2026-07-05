import boto3, os, sys

SERVICE_ARN = "arn:aws:apprunner:us-east-2:596294129245:service/kincaid-iq-service/aa9ac9c07bdd409580121bdc1e73502c"

creds = {}
with open(".env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            creds[k.strip()] = v.strip()

ar = boto3.client("apprunner", region_name="us-east-2",
    aws_access_key_id=creds["ACCESS_KEY"],
    aws_secret_access_key=creds["SECRET_ACCESS_KEY"])

svc = ar.describe_service(ServiceArn=SERVICE_ARN)["Service"]
print("Status:", svc["Status"])

src = svc["SourceConfiguration"]
auto = src.get("AutoDeploymentsEnabled")
print("AutoDeploymentsEnabled:", auto)

img = src.get("ImageRepository", {})
print("Image URI:", img.get("ImageIdentifier", "N/A"))

ops = ar.list_operations(ServiceArn=SERVICE_ARN)["OperationSummaryList"]
print("\nRecent operations (last 6):")
for op in ops[:6]:
    t = op.get("Type", "?")
    s = op.get("Status", "?")
    ts = str(op.get("StartedAt", "?"))[:19]
    end = str(op.get("EndedAt", "in-progress"))[:19]
    print(f"  {t:<25} {s:<20} started={ts}  ended={end}")
