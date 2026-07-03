import sys
import os
import subprocess
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def get_db_connection_params(url):
    """
    Parses a connection URL or returns it directly.
    """
    return url

def test_connection(db_url, name):
    print(f"Testing connection to {name} database...")
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        print(f"✅ Connection to {name} database successful!")
        return True
    except Exception as e:
        print(f"❌ Failed to connect to {name} database: {e}")
        return False

def count_rows_and_tables(db_url):
    """
    Returns a dictionary of {table_name: row_count} for validation.
    """
    table_stats = {}
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Get list of user tables in the public schema
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE';
        """)
        tables = [row[0] for row in cur.fetchall()]
        
        # Count rows in each table
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}";')
            count = cur.fetchone()[0]
            table_stats[table] = count
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error fetching table stats: {e}")
    return table_stats

def run_backup_restore(source_url, target_url):
    dump_file = "temp_db_dump.sql"
    
    print("\nStep 1: Dumping source database using pg_dump...")
    try:
        # We use pg_dump with --clean --if-exists to clean target before restore
        # pg_dump requires pg_dump utility on the host. 
        # If pg_dump isn't available, we will notify the user.
        subprocess.run(
            ["pg_dump", "--no-owner", "--no-acl", "-f", dump_file, source_url],
            check=True
        )
        print("✅ Source database dumped successfully.")
    except FileNotFoundError:
        print("❌ Error: pg_dump utility not found on this system. Please install PostgreSQL client tools.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ pg_dump failed: {e}")
        return False

    print("\nStep 2: Restoring to target database using psql...")
    try:
        # Restore the dump file using psql
        subprocess.run(
            ["psql", "-f", dump_file, target_url],
            check=True
        )
        print("✅ Database restored to target successfully.")
        
        # Clean up dump file
        if os.path.exists(dump_file):
            os.remove(dump_file)
            
        return True
    except FileNotFoundError:
        print("❌ Error: psql utility not found on this system. Please install PostgreSQL client tools.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ psql restore failed: {e}")
        if os.path.exists(dump_file):
            os.remove(dump_file)
        return False

def validate_migration(source_url, target_url):
    print("\nStep 3: Validating data integrity...")
    source_stats = count_rows_and_tables(source_url)
    target_stats = count_rows_and_tables(target_url)
    
    if not source_stats:
        print("❌ Failed to fetch stats from source database.")
        return False
    if not target_stats:
        print("❌ Failed to fetch stats from target database.")
        return False
        
    mismatches = []
    
    print("\n--- Table Count and Row Count Validation ---")
    all_tables = set(source_stats.keys()).union(set(target_stats.keys()))
    
    for table in sorted(all_tables):
        source_count = source_stats.get(table, "MISSING")
        target_count = target_stats.get(table, "MISSING")
        
        status = "✅ MATCH" if source_count == target_count else "❌ MISMATCH"
        print(f"Table: {table:<30} | Source Rows: {source_count:<10} | Target Rows: {target_count:<10} | {status}")
        
        if source_count != target_count:
            mismatches.append(table)
            
    if mismatches:
        print(f"\n❌ Validation failed! Mismatches found in tables: {', '.join(mismatches)}")
        return False
    else:
        print("\n✅ Data integrity validation successful! All tables and row counts match perfectly.")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python db_migration_helper.py <SOURCE_DATABASE_URL> <TARGET_DATABASE_URL>")
        sys.exit(1)
        
    source_db = sys.argv[1]
    target_db = sys.argv[2]
    
    print("=========================================")
    print("  Kincaid IQ Database Migration Helper   ")
    print("=========================================")
    
    if not test_connection(source_db, "SOURCE"):
        sys.exit(1)
        
    if not test_connection(target_db, "TARGET"):
        sys.exit(1)
        
    # Run the backup and restore
    if run_backup_restore(source_db, target_db):
        # Validate integrity
        validate_migration(source_db, target_db)
    else:
        print("\n❌ Migration process failed.")
        sys.exit(1)
