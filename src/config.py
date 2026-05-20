import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import ChatOllama, OllamaEmbeddings

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OLLAMA_URL = os.getenv("OLLAMA_URL")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

embedding_model = OllamaEmbeddings(
    model="nomic-embed-text-v2-moe",
    dimensions=512,
    base_url=OLLAMA_URL,
)
chat_model = ChatOllama(model="gemma4:31b", base_url=OLLAMA_URL)
