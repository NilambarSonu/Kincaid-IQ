import os
import sys
import time
import base64
import subprocess
import boto3
from botocore.exceptions import ClientError

REGION = "us-east-2"

def load_credentials():
    print("Loading credentials from .env...")
    access_key = None
    secret_key = None
    database_url = None
    duckdb_remote_url = None
    
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("ACCESS_KEY="):
                    access_key = line.split("ACCESS_KEY=")[1].strip()
                elif line.startswith("SECRET_ACCESS_KEY="):
                    secret_key = line.split("SECRET_ACCESS_KEY=")[1].strip()
                elif line.startswith("DATABASE_URL="):
                    database_url = line.split("DATABASE_URL=")[1].strip()
                elif line.startswith("DUCKDB_REMOTE_URL="):
                    duckdb_remote_url = line.split("DUCKDB_REMOTE_URL=")[1].strip()
                    
    if not access_key or not secret_key:
        print("[ERROR] ACCESS_KEY or SECRET_ACCESS_KEY not found in .env")
        sys.exit(1)
    if not database_url:
        print("[ERROR] DATABASE_URL not found in .env")
        sys.exit(1)
    if not duckdb_remote_url:
        print("[ERROR] DUCKDB_REMOTE_URL not found in .env")
        sys.exit(1)
        
    os.environ["AWS_ACCESS_KEY_ID"] = access_key
    os.environ["AWS_SECRET_ACCESS_KEY"] = secret_key
    os.environ["AWS_DEFAULT_REGION"] = REGION
    
    print("Credentials loaded successfully.")
    return access_key, secret_key, database_url, duckdb_remote_url

def get_account_id():
    sts = boto3.client("sts")
    return sts.get_caller_identity()["Account"]

def docker_login_to_ecr(account_id):
    print("Authenticating local Docker client with private ECR...")
    ecr = boto3.client("ecr", region_name=REGION)
    try:
        response = ecr.get_authorization_token()
        auth_data = response["authorizationData"][0]
        token = base64.b64decode(auth_data["authorizationToken"]).decode("utf-8")
        username, password = token.split(":")
        endpoint = auth_data["proxyEndpoint"]
        
        proc = subprocess.run(
            ["docker", "login", "--username", username, "--password-stdin", endpoint],
            input=password.encode("utf-8"),
            capture_output=True
        )
        if proc.returncode != 0:
            print(f"[ERROR] Docker login failed: {proc.stderr.decode()}")
            sys.exit(1)
        print("Docker authenticated with ECR successfully.")
        return endpoint
    except Exception as e:
        print(f"[ERROR] failed ECR authentication: {e}")
        sys.exit(1)

def build_tag_push_image(endpoint, account_id):
    repo_uri = f"{account_id}.dkr.ecr.{REGION}.amazonaws.com/kincaid-iq-app"
    image_tag = f"{repo_uri}:latest"
    
    print(f"Building local production Docker image: {image_tag}...")
    try:
        subprocess.run(["docker", "build", "-t", "kincaid-iq-app", "."], check=True)
        print("Image built successfully. Tagging...")
        
        subprocess.run(["docker", "tag", "kincaid-iq-app:latest", image_tag], check=True)
        print("Image tagged successfully. Pushing to ECR (this might take 2-4 minutes)...")
        
        subprocess.run(["docker", "push", image_tag], check=True)
        print("Docker image pushed to ECR successfully.")
        return image_tag
    except Exception as e:
        print(f"[ERROR] during Docker build/push: {e}")
        sys.exit(1)

def get_or_create_ecr_access_role():
    print("Ensuring IAM role AppRunnerECRAccessRole exists...")
    iam = boto3.client("iam")
    role_name = "AppRunnerECRAccessRole"
    assume_role_policy = (
        '{\n'
        '  "Version": "2012-10-17",\n'
        '  "Statement": [\n'
        '    {\n'
        '      "Effect": "Allow",\n'
        '      "Principal": {\n'
        '        "Service": "build.apprunner.amazonaws.com"\n'
        '      },\n'
        '      "Action": "sts:AssumeRole"\n'
        '    }\n'
        '  ]\n'
        '}'
    )
    
    try:
        response = iam.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=assume_role_policy,
            Description="Allows App Runner to pull images from ECR"
        )
        role_arn = response["Role"]["Arn"]
        print(f"Created role: {role_name}")
        
        # Attach the policy for ECR Access
        iam.attach_role_policy(
            RoleName=role_name,
            PolicyArn="arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
        )
        print("Attached policy AWSAppRunnerServicePolicyForECRAccess.")
        # Give IAM a few seconds to propagate the role
        time.sleep(5)
        return role_arn
    except ClientError as e:
        if e.response["Error"]["Code"] == "EntityAlreadyExists":
            print(f"Role {role_name} already exists. Retrieving ARN...")
            response = iam.get_role(RoleName=role_name)
            return response["Role"]["Arn"]
        else:
            print(f"[ERROR] creating IAM role: {e}")
            sys.exit(1)

def create_app_runner_service(image_tag, role_arn, access_key, secret_key, database_url, duckdb_remote_url):
    print("Provisioning AWS App Runner service...")
    apprunner = boto3.client("apprunner", region_name=REGION)
    service_name = "kincaid-iq-service"
    
    try:
        response = apprunner.create_service(
            ServiceName=service_name,
            SourceConfiguration={
                "ImageRepository": {
                    "ImageIdentifier": image_tag,
                    "ImageRepositoryType": "ECR",
                    "ImageConfiguration": {
                        "Port": "5000",
                        "RuntimeEnvironmentVariables": {
                            "DATABASE_URL": database_url,
                            "DUCKDB_REMOTE_URL": duckdb_remote_url,
                            "AWS_ACCESS_KEY_ID": access_key,
                            "AWS_SECRET_ACCESS_KEY": secret_key,
                            "AWS_DEFAULT_REGION": REGION,
                            "APP_ENV": "production",
                            "PORT": "5000",
                            "SESSION_SECRET": "kincaid-default-session-secret-2026"
                        }
                    }
                },
                "AutoDeploymentsEnabled": False,
                "AuthenticationConfiguration": {
                    "AccessRoleArn": role_arn
                }
            },
            InstanceConfiguration={
                "Cpu": "1 vCPU",
                "Memory": "2 GB"
            }
        )
        service = response["Service"]
        service_arn = service["ServiceArn"]
        service_url = service["ServiceUrl"]
        print("App Runner service creation initiated successfully.")
        print(f"  Service Name: {service_name}")
        print(f"  Service ARN: {service_arn}")
        print(f"  Service URL: https://{service_url}")
        return service_arn
    except ClientError as e:
        print(f"[ERROR] creating App Runner service: {e}")
        sys.exit(1)

def monitor_deployment(service_arn):
    print("Monitoring deployment progress. This typically takes 3-6 minutes...")
    apprunner = boto3.client("apprunner", region_name=REGION)
    
    while True:
        try:
            response = apprunner.describe_service(ServiceArn=service_arn)
            service = response["Service"]
            status = service["Status"]
            print(f"Current Status: {status}")
            
            if status == "RUNNING":
                print("App Runner service is RUNNING and ACTIVE!")
                print(f"Deployment URL: https://{service['ServiceUrl']}")
                break
            elif status in ["FAILED", "DELETED"]:
                print(f"[ERROR] App Runner service ended with status: {status}")
                sys.exit(1)
        except Exception as e:
            print(f"Error describing service: {e}")
            
        time.sleep(20)

if __name__ == "__main__":
    access_key, secret_key, database_url, duckdb_remote_url = load_credentials()
    account_id = get_account_id()
    print(f"Using AWS Account ID: {account_id}")
    
    # 1. Docker login
    endpoint = docker_login_to_ecr(account_id)
    
    # 2. Build & Push Image
    image_tag = build_tag_push_image(endpoint, account_id)
    
    # 3. Resolve ECR Access Role
    role_arn = get_or_create_ecr_access_role()
    
    # 4. Provision App Runner Service
    service_arn = create_app_runner_service(
        image_tag=image_tag,
        role_arn=role_arn,
        access_key=access_key,
        secret_key=secret_key,
        database_url=database_url,
        duckdb_remote_url=duckdb_remote_url
    )
    
    # 5. Monitor Deployment
    monitor_deployment(service_arn)
