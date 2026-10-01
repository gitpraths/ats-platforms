import psycopg2
import uuid
import datetime

db_url = "postgresql://postgres:haGIrduketvrarPqPERryLGwRbvSoJkD@kodama.proxy.rlwy.net:56435/railway"
conn = psycopg2.connect(db_url)
cur = conn.cursor()

candidates = [
    "69525f44-e7c9-4577-8f60-f023f198404d",
    "7116046c-5db6-4344-ba3f-8bf7d8c6cf36",
    "0e136e36-24b4-4ea3-9cef-5ea280d353f9",
    "e8a0b067-bc15-47f9-b399-50745484db1c",
    "5a4d7e91-d9e6-45db-afec-ae6cd28dbbf3",
    "f473f170-c350-4537-bdeb-dc897a4dc099",
    "d6a723a9-ed19-4bb7-a874-bcf5c9045643",
    "cf2f4344-c0b1-437d-9812-f21d49ab7dc4",
    "617fbdbf-9bae-4c28-81d1-dcb8bdcb809f",
    "859dd67a-e7ad-48f2-85d8-fc7c133c5368",
    "d9768e89-4773-4b90-8e6d-707058d5f701",
    "616d683e-b9a8-4168-91d6-faea3240e516"
]

job_id = "00000000-0000-0000-0003-000000000020"
employer_id = "00000000-0000-0000-0006-000000000001"
user_id = "00000000-0000-0000-0000-000000000002"

for i, cid in enumerate(candidates):
    placement_id = str(uuid.uuid4())
    start_date = datetime.date.today() - datetime.timedelta(days=i*5)
    
    cur.execute("""
        INSERT INTO placements (id, candidate_id, job_id, employer_id, start_date, employment_status, created_by, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        placement_id, cid, job_id, employer_id, start_date, 'active', user_id, f"Dummy placement {i+1} for testing."
    ))

conn.commit()
cur.close()
conn.close()

print(f"Successfully inserted {len(candidates)} dummy placements.")
