#!/usr/bin/env python3
"""
Migration: Make analytic_id nullable in prestations table
This fixes the FK constraint error when users enter prestations without selecting an analytic
"""

import psycopg2
import sys

HOST = 'ay177071-001.eu.clouddb.ovh.net'
PORT = 35230
USER = 'fenix'
PASSWORD = 'Toulouse94'
DATABASE = 'fenix'

try:
    print("[Migration] Connecting to database...")
    conn = psycopg2.connect(
        host=HOST,
        port=PORT,
        user=USER,
        password=PASSWORD,
        database=DATABASE,
        connect_timeout=10
    )
    cursor = conn.cursor()
    print("[Migration] ✓ Connected")
    
    print("\n[Migration] Step 1: Dropping existing FK constraint...")
    try:
        cursor.execute('ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics')
        conn.commit()
        print("[Migration] ✓ Constraint dropped")
    except Exception as e:
        print(f"[Migration] Note: {e}")
        conn.commit()
    
    print("\n[Migration] Step 2: Making analytic_id nullable...")
    try:
        cursor.execute('ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL')
        conn.commit()
        print("[Migration] ✓ Column is now nullable")
    except Exception as e:
        if 'already' in str(e).lower() or 'nullable' in str(e).lower():
            print("[Migration] ✓ Column was already nullable")
            conn.commit()
        else:
            raise
    
    print("\n[Migration] Step 3: Adding FK constraint with ON DELETE SET NULL...")
    cursor.execute("""
        ALTER TABLE prestations
        ADD CONSTRAINT fk_prestations_analytics
        FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL
    """)
    conn.commit()
    print("[Migration] ✓ FK constraint re-added")
    
    print("\n[Migration] Step 4: Verifying...")
    cursor.execute("""
        SELECT column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'prestations' AND column_name = 'analytic_id'
    """)
    result = cursor.fetchone()
    if result:
        print(f"[Migration] ✓ Column: {result[0]}")
        print(f"[Migration]   - Data type: {result[2]}")
        print(f"[Migration]   - Nullable: {result[1]}")
    
    print("\n✅ Migration completed successfully!")
    print("Users can now save prestations with NULL analytic_id and avoid FK constraint errors.\n")
    
    cursor.close()
    conn.close()
    sys.exit(0)

except Exception as e:
    print(f"\n❌ Migration failed: {e}", file=sys.stderr)
    sys.exit(1)
