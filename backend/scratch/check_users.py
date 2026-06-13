import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.supabase_client import supabase_admin

try:
    users = supabase_admin.table("users").select("id, email").execute()
    print("Users:")
    for u in users.data:
        print(u)
        
    chat = supabase_admin.table("chat_history").select("id, user_id, sender, message").execute()
    print("\nChat history rows count:", len(chat.data))
    for c in chat.data:
        print(c['user_id'], c['sender'], c['message'][:30])
except Exception as e:
    print("Error:", str(e))
