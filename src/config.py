import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_anthropic import ChatAnthropic

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
OLLAMA_URL = os.getenv("OLLAMA_URL")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

embedding_model = OllamaEmbeddings(
    model="nomic-embed-text-v2-moe",
    dimensions=512,
)
chat_model = ChatOllama(model="gemma4:31b", base_url=OLLAMA_URL)
# chat_model = ChatAnthropic(model="claude-haiku-4-5-20251001")
