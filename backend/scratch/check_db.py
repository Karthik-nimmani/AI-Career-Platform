import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.supabase_client import supabase_admin

try:
    res = supabase_admin.table("chat_history").select("*").execute()
    print("Chat history rows count:", len(res.data))
    print("Rows:")
    for row in res.data[:20]:
        print(row)
except Exception as e:
    print("Error querying chat_history:", str(e))
