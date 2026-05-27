CREATE OR REPLACE FUNCTION public.match_embeddings(
  query_embedding vector(512),
  document_id_param uuid,
  similarity_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  chunk_id uuid,
  contenido text,
  similitud double precision
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.chunk_id,
    dc.contenido,
    (1 - (e.vector <=> query_embedding)) as similitud
  FROM embeddings e
  JOIN document_chunks dc ON e.chunk_id = dc.id
  WHERE dc.document_id = document_id_param
    AND (1 - (e.vector <=> query_embedding)) > similarity_threshold
  ORDER BY e.vector <=> query_embedding
  LIMIT match_count;
END;
$function$;
