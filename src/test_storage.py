from config import supabase_admin as supabase

PDF_PATH = "../docs/ejemplo2.pdf"
BUCKET = "documents"
DEST_PATH = "test/ejemplo2.pdf"

with open(PDF_PATH, "rb") as f:
    content = f.read()

res = supabase.storage.from_(BUCKET).upload(
    path=DEST_PATH,
    file=content,
    file_options={"content-type": "application/pdf"},
)

print(res)

url = supabase.storage.from_(BUCKET).get_public_url(DEST_PATH)
print("URL pública:", url)
