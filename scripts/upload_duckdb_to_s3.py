import sys
import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

def upload_file_to_s3(file_name, bucket, object_name=None):
    """
    Uploads a file to an S3 bucket.
    """
    if object_name is None:
        object_name = os.path.basename(file_name)

    # Initialize S3 client (reads credentials from environment variables automatically)
    s3_client = boto3.client('s3')
    
    try:
        print(f"Uploading '{file_name}' to S3 bucket '{bucket}' as '{object_name}'...")
        # Get file size for progress output
        file_size = os.path.getsize(file_name)
        file_size_mb = file_size / (1024 * 1024)
        print(f"File size: {file_size_mb:.2f} MB")
        
        s3_client.upload_file(file_name, bucket, object_name)
        print("✅ Upload successful!")
        
        # Output the remote URL that the container will use
        region = s3_client.meta.region_name
        # S3 URL structure depending on region
        if region == 'us-east-1':
            remote_url = f"https://{bucket}.s3.amazonaws.com/{object_name}"
        else:
            remote_url = f"https://{bucket}.s3.{region}.amazonaws.com/{object_name}"
            
        print(f"\nTarget Environment Config:")
        print(f"DUCKDB_REMOTE_URL={remote_url}")
        
        return True
    except FileNotFoundError:
        print(f"❌ Error: Local file not found: {file_name}")
        return False
    except NoCredentialsError:
        print("❌ Error: AWS credentials not found. Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment.")
        return False
    except ClientError as e:
        print(f"❌ AWS S3 Client error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_duckdb_to_s3.py <S3_BUCKET_NAME> [S3_OBJECT_NAME]")
        sys.exit(1)
        
    bucket_name = sys.argv[1]
    obj_name = sys.argv[2] if len(sys.argv) > 2 else "dol5500.duckdb"
    
    # Path to local duckdb
    local_db_path = os.path.join("data", "dol5500.duckdb")
    
    print("=========================================")
    print("  Kincaid IQ DuckDB S3 Uploader Helper   ")
    print("=========================================")
    
    if not os.path.exists(local_db_path):
        print(f"❌ Error: Local DuckDB database file not found at: {local_db_path}")
        print("Please ensure you have data/dol5500.duckdb before running this script.")
        sys.exit(1)
        
    upload_file_to_s3(local_db_path, bucket_name, obj_name)
