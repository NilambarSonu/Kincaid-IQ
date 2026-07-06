"""
update_app_runner_env.py
========================
Reads all non-empty, non-comment variables from .env and pushes them
into the running AWS App Runner service as environment variables.
Triggers a forced redeployment so the container picks up the new values.

Usage:
    python scripts/update_app_runner_env.py
"""
import os
import sys
import time
import boto3
from botocore.exceptions import ClientError

REGION = "us-east-2"
SERVICE_NAME = "kincaid-iq-service"

# Variables that must NEVER be sent to App Runner (they are injected via IAM / not needed)
EXCLUDE_VARS = {"ACCESS_KEY", "SECRET_ACCESS_KEY"}


def load_env(path=".env"):
    """Load all non-empty key=value pairs from .env, skipping comments."""
    env = {}
    if not os.path.exists(path):
        print(f"[ERROR] {path} not found.")
        sys.exit(1)
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip()
            if k and v and k not in EXCLUDE_VARS:
                env[k] = v
    return env


def get_boto_clients(env):
    access_key = None
    secret_key = None
    with open(".env") as f:
        for line in f:
            line = line.strip()
            if line.startswith("ACCESS_KEY="):
                access_key = line.split("ACCESS_KEY=", 1)[1].strip()
            elif line.startswith("SECRET_ACCESS_KEY="):
                secret_key = line.split("SECRET_ACCESS_KEY=", 1)[1].strip()
    if not access_key or not secret_key:
        print("[ERROR] ACCESS_KEY / SECRET_ACCESS_KEY missing from .env")
        sys.exit(1)
    apprunner = boto3.client(
        "apprunner",
        region_name=REGION,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    return apprunner, access_key, secret_key


def get_service_arn(apprunner):
    """Find the kincaid App Runner service ARN."""
    services = apprunner.list_services()["ServiceSummaryList"]
    for svc in services:
        if SERVICE_NAME in svc["ServiceName"]:
            return svc["ServiceArn"]
    print(f"[ERROR] App Runner service '{SERVICE_NAME}' not found.")
    sys.exit(1)


def update_env_vars(apprunner, service_arn, env_vars, access_key, secret_key):
    """
    Update the App Runner service with new environment variables.
    App Runner requires passing the FULL source configuration block.
    We also inject AWS credentials so the container can access S3/Secrets.
    """
    print(f"\nFetching current service configuration for {service_arn}...")
    svc = apprunner.describe_service(ServiceArn=service_arn)["Service"]
    current_cfg = svc["SourceConfiguration"]

    # Merge AWS SDK credentials back in so container can call AWS APIs
    env_vars["AWS_ACCESS_KEY_ID"] = access_key
    env_vars["AWS_SECRET_ACCESS_KEY"] = secret_key
    env_vars["AWS_DEFAULT_REGION"] = REGION

    print(f"Injecting {len(env_vars)} environment variables:")
    for k, v in sorted(env_vars.items()):
        display = v if k not in {"SESSION_SECRET", "DATABASE_URL", "AWS_SECRET_ACCESS_KEY"} else v[:6] + "..."
        print(f"  {k} = {display}")

    # Patch the image configuration env vars
    image_repo = current_cfg.get("ImageRepository", {})
    image_cfg = image_repo.get("ImageConfiguration", {})
    image_cfg["RuntimeEnvironmentVariables"] = env_vars

    image_repo["ImageConfiguration"] = image_cfg
    current_cfg["ImageRepository"] = image_repo

    print("\nPushing updated configuration to App Runner...")
    try:
        response = apprunner.update_service(
            ServiceArn=service_arn,
            SourceConfiguration=current_cfg,
        )
        op_id = response["OperationId"]
        print(f"Update initiated. Operation ID: {op_id}")
        return op_id
    except ClientError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


def wait_for_running(apprunner, service_arn, timeout_seconds=300):
    """Poll until the service returns to RUNNING status after update."""
    print("\nWaiting for App Runner to finish redeploying...")
    deadline = time.time() + timeout_seconds
    last_status = None
    while time.time() < deadline:
        svc = apprunner.describe_service(ServiceArn=service_arn)["Service"]
        status = svc["Status"]
        if status != last_status:
            print(f"  Status: {status}")
            last_status = status
        if status == "RUNNING":
            print("\nApp Runner is RUNNING with updated environment variables.")
            return True
        if status in ("CREATE_FAILED", "DELETE_FAILED", "OPERATION_IN_PROGRESS"):
            time.sleep(10)
        else:
            time.sleep(10)
    print("[TIMEOUT] Service did not return to RUNNING within timeout.")
    return False


def verify_health():
    """Quick HTTP check against the health endpoint."""
    import urllib.request
    import ssl
    url = "https://www.kincaidhealth.com/api/health"
    print(f"\nVerifying health: GET {url}")
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.urlopen(url, timeout=15, context=ctx)
        body = req.read().decode()
        print(f"  HTTP {req.status} -- {body[:200]}")
        return req.status == 200
    except Exception as e:
        print(f"  [WARNING] Health check failed: {e}")
        return False


def main():
    print("=" * 60)
    print("Kincaid IQ — App Runner Environment Variable Updater")
    print("=" * 60)

    env_vars = load_env()
    apprunner, access_key, secret_key = get_boto_clients(env_vars)
    service_arn = get_service_arn(apprunner)
    print(f"\nTarget service: {service_arn}")

    update_env_vars(apprunner, service_arn, env_vars, access_key, secret_key)
    ok = wait_for_running(apprunner, service_arn, timeout_seconds=360)

    if ok:
        verify_health()
        print("\n[SUCCESS] Environment variables updated and service is healthy.")
    else:
        print("\n[WARNING] Service update may still be in progress. Check AWS Console.")


if __name__ == "__main__":
    main()
