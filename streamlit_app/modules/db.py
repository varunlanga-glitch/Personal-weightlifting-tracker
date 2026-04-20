import os
import streamlit as st
from supabase import create_client


@st.cache_resource
def get_supabase_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)
