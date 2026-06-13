"""
Supabase client initialization module.
Creates standard and admin clients for database and storage interaction.
"""

from supabase import create_client, Client
from app.core.config import settings

# Standard Supabase client (respects Row Level Security based on JWT passed)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Admin Supabase client (bypasses RLS, use with care!)
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
