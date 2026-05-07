import os
from supabase import create_client, Client

supabase: Client = create_client(url, key)
response = supabase.table("ejemplo").select("*").execute()

print(response.data)
