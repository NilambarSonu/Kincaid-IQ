import os
import sys
import time
import boto3
from botocore.exceptions import ClientError

# Set region
REGION = "us-east-2"

def load_credentials():
    print("Loading credentials from .env...")
    access_key = None
    secret_key = None
    
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("ACCESS_KEY="):
                    access_key = line.split("ACCESS_KEY=")[1].strip()
                elif line.startswith("SECRET_ACCESS_KEY="):
                    secret_key = line.split("SECRET_ACCESS_KEY=")[1].strip()
                    
    if not access_key or not secret_key:
        print("[ERROR] ACCESS_KEY or SECRET_ACCESS_KEY not found in .env")
        sys.exit(1)
        
    # Configure environment variables for boto3
    os.environ["AWS_ACCESS_KEY_ID"] = access_key
    os.environ["AWS_SECRET_ACCESS_KEY"] = secret_key
    os.environ["AWS_DEFAULT_REGION"] = REGION
    
    print("Credentials loaded successfully.")
    return access_key, secret_key

def get_account_id():
    sts = boto3.client("sts")
    caller_identity = sts.get_caller_identity()
    return caller_identity["Account"]

def create_s3_bucket(bucket_name):
    s3 = boto3.client("s3", region_name=REGION)
    try:
        print(f"Creating S3 bucket: {bucket_name} in region {REGION}...")
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": REGION}
        )
        print("S3 bucket created successfully.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "BucketAlreadyOwnedByYou":
            print("Bucket already exists and is owned by you.")
        else:
            print(f"[ERROR] creating S3 bucket: {e}")
            sys.exit(1)

def upload_duckdb(bucket_name):
    s3 = boto3.client("s3", region_name=REGION)
    local_path = os.path.join("data", "dol5500.duckdb")
    object_name = "dol5500.duckdb"
    
    if not os.path.exists(local_path):
        print(f"[ERROR] Local DuckDB file not found at {local_path}")
        sys.exit(1)
        
    print(f"Uploading {local_path} to s3://{bucket_name}/{object_name}...")
    try:
        s3.upload_file(local_path, bucket_name, object_name)
        print("DuckDB file uploaded successfully.")
        remote_url = f"https://{bucket_name}.s3.{REGION}.amazonaws.com/{object_name}"
        print(f"Target Configuration: DUCKDB_REMOTE_URL={remote_url}")
        return remote_url
    except Exception as e:
        print(f"[ERROR] uploading file: {e}")
        sys.exit(1)

def create_ecr_repository():
    ecr = boto3.client("ecr", region_name=REGION)
    repo_name = "kincaid-iq-app"
    try:
        print(f"Creating Private ECR Repository: {repo_name}...")
        response = ecr.create_repository(
            repositoryName=repo_name,
            imageScanningConfiguration={"scanOnPush": True},
            encryptionConfiguration={"encryptionType": "AES256"}
        )
        repository_uri = response["repository"]["repositoryUri"]
        print(f"ECR Repository created successfully. URI: {repository_uri}")
        return repository_uri
    except ClientError as e:
        if e.response["Error"]["Code"] == "RepositoryAlreadyExistsException":
            response = ecr.describe_repositories(repositoryNames=[repo_name])
            repository_uri = response["repositories"][0]["repositoryUri"]
            print(f"ECR Repository already exists. URI: {repository_uri}")
            return repository_uri
        else:
            print(f"[ERROR] creating ECR Repository: {e}")
            sys.exit(1)

def create_secrets_manager():
    sm = boto3.client("secretsmanager", region_name=REGION)
    secret_name = "kincaid-iq-secrets"
    print(f"Creating Secrets Manager secret: {secret_name}...")
    
    secret_string = (
        '{\n'
        '  "OPENAI_API_KEY": "",\n'
        '  "ANTHROPIC_API_KEY": "",\n'
        '  "GEMINI_API_KEY": "",\n'
        '  "STRIPE_SECRET_KEY": "",\n'
        '  "STRIPE_WEBHOOK_SECRET": "",\n'
        '  "HUBSPOT_ACCESS_TOKEN": "",\n'
        '  "SESSION_SECRET": "kincaid-default-session-secret-2026"\n'
        '}'
    )
    
    try:
        response = sm.create_secret(
            Name=secret_name,
            Description="Secrets for Kincaid IQ Application",
            SecretString=secret_string
        )
        print(f"Secret created successfully. ARN: {response['ARN']}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceExistsException":
            print("Secret already exists.")
        else:
            print(f"[ERROR] creating Secrets Manager secret: {e}")

def create_rds_instance(db_password):
    rds = boto3.client("rds", region_name=REGION)
    db_instance_id = "kincaid-postgres-db"
    
    try:
        print(f"Provisioning RDS PostgreSQL instance: {db_instance_id}...")
        response = rds.create_db_instance(
            DBInstanceIdentifier=db_instance_id,
            AllocatedStorage=20,
            DBName="kincaid",
            Engine="postgres",
            EngineVersion="15.18",
            DBInstanceClass="db.t4g.medium",
            MasterUsername="postgres",
            MasterUserPassword=db_password,
            VpcSecurityGroupIds=[], # Uses default security group
            PubliclyAccessible=True,
            BackupRetentionPeriod=7,
            MultiAZ=False,
            StorageType="gp3"
        )
        print("RDS instance creation initiated successfully.")
        print(f"  Instance ID: {db_instance_id}")
        print(f"  Engine: postgres 15")
        print(f"  Class: db.t4g.medium")
        print(f"  Username: postgres")
        print(f"  Password: {db_password}")
        print("Note: Creation will take 5-10 minutes to become fully AVAILABLE.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "DBInstanceAlreadyExists":
            print("RDS Database Instance already exists/creating.")
        else:
            print(f"[ERROR] initiating RDS instance creation: {e}")

if __name__ == "__main__":
    access_key, secret_key = load_credentials()
    account_id = get_account_id()
    print(f"Running in AWS Account ID: {account_id}")
    
    bucket_name = f"kincaid-analytics-{account_id}"
    
    # 1. Create S3 Bucket
    create_s3_bucket(bucket_name)
    
    # 2. Upload DuckDB to S3
    remote_url = upload_duckdb(bucket_name)
    
    # 3. Create ECR Repo
    create_ecr_repository()
    
    # 4. Create Secrets Manager Secret
    create_secrets_manager()
    
    # 5. Provision RDS Database
    db_pass = "KincaidSecurePass2026!"
    create_rds_instance(db_pass)
    
    print("\n=========================================")
    print("      MILESTONE 1 INITIATION COMPLETE    ")
    print("=========================================")
    print(f"S3 Bucket: {bucket_name}")
    print(f"DuckDB URL: {remote_url}")
    print("FastAPI env variable setup config:")
    print(f"DUCKDB_REMOTE_URL={remote_url}")
    print(f"DATABASE_URL=postgresql://postgres:{db_pass}@<rds-endpoint>:5432/kincaid")
    print("=========================================")
    print("Next action: Monitor RDS database status until AVAILABLE, then run migration scripts.")
