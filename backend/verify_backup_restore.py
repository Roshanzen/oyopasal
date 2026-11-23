import os
import sys
import sqlite3
import hashlib
import gzip
import tempfile

def test_backup_and_restore_cycle():
    print("=" * 70)
    print("STARTING BACKUP & RESTORATION STAGING INTEGRATION TEST")
    print("=" * 70)

    # 1. Create a dummy staging source database with sample records
    with tempfile.TemporaryDirectory() as tmpdir:
        src_db_path = os.path.join(tmpdir, "staging_source.sqlite3")
        dump_path = os.path.join(tmpdir, "backup_dump.sql.gz")
        target_db_path = os.path.join(tmpdir, "staging_restored.sqlite3")

        # Populate source DB
        conn = sqlite3.connect(src_db_path)
        cur = conn.cursor()
        cur.execute("CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, price REAL)")
        cur.execute("CREATE TABLE vendors (id TEXT PRIMARY KEY, business_name TEXT)")
        cur.executemany("INSERT INTO products VALUES (?, ?, ?)", [
            ("p1", "Himalayan Organic Honey", 1250.0),
            ("p2", "Ilam Green Tea", 350.0),
            ("p3", "Pashmina Shawl", 4500.0)
        ])
        cur.executemany("INSERT INTO vendors VALUES (?, ?)", [
            ("v1", "Himalayan Mart"),
            ("v2", "Pokhara Crafts")
        ])
        conn.commit()

        # Check source count
        src_prod_count = cur.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        src_vendor_count = cur.execute("SELECT COUNT(*) FROM vendors").fetchone()[0]
        print(f"Step 1: Staging source DB created with {src_prod_count} products and {src_vendor_count} vendors.")

        # 2. Dump source DB to compressed SQL archive
        dump_sql = "\n".join(conn.iterdump())
        conn.close()

        compressed_data = gzip.compress(dump_sql.encode('utf-8'))
        with open(dump_path, "wb") as f:
            f.write(compressed_data)

        # 3. Compute and verify SHA256 checksum
        hasher = hashlib.sha256()
        hasher.update(compressed_data)
        checksum = hasher.hexdigest()
        print(f"Step 2: Database dumped & compressed to {dump_path} (SHA-256: {checksum[:16]}...)")

        # 4. Decompress and restore into target staging DB
        with open(dump_path, "rb") as f:
            read_compressed = f.read()

        # Validate checksum before restore
        read_hasher = hashlib.sha256()
        read_hasher.update(read_compressed)
        assert read_hasher.hexdigest() == checksum, "Integrity check failed: Checksum mismatch!"
        print("Step 3: SHA256 integrity checksum verified successfully before restoration.")

        decompressed_sql = gzip.decompress(read_compressed).decode('utf-8')
        target_conn = sqlite3.connect(target_db_path)
        target_cur = target_conn.cursor()
        target_cur.executescript(decompressed_sql)
        target_conn.commit()

        # 5. Verify records in restored target DB
        res_prod_count = target_cur.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        res_vendor_count = target_cur.execute("SELECT COUNT(*) FROM vendors").fetchone()[0]
        sample_prod = target_cur.execute("SELECT name, price FROM products WHERE id='p1'").fetchone()
        target_conn.close()

        assert res_prod_count == src_prod_count, f"Product count mismatch: {res_prod_count} vs {src_prod_count}"
        assert res_vendor_count == src_vendor_count, f"Vendor count mismatch: {res_vendor_count} vs {src_vendor_count}"
        assert sample_prod == ("Himalayan Organic Honey", 1250.0), f"Sample record corrupted: {sample_prod}"

        print(f"Step 4: Restored staging DB verified with {res_prod_count} products and {res_vendor_count} vendors.")
        print(f"Step 5: Verified sample data integrity: '{sample_prod[0]}' @ Rs {sample_prod[1]}")
        print("=" * 70)
        print("ALL BACKUP & RESTORATION INTEGRITY ASSERTIONS PASSED SUCCESSFULLY!")
        print("=" * 70)

if __name__ == '__main__':
    test_backup_and_restore_cycle()
