from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings

embs = OllamaEmbeddings(model="nomic-embed-text-v2-moe", dimensions=512)

loader = PyPDFLoader("ejemplo.pdf")

docs = loader.load()

splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)

chunks = splitter.split_documents(docs)

vectors = embs.embed_documents([chunk.page_content for chunk in chunks])

print("Chunks:", len(chunks))
print("Vectors:", len(vectors))
print("Dimensión:", len(vectors[0]))
