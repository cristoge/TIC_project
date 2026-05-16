import re
from agents.graph import run_agent

import json

document_id = ""

# Paso 1 - generar test
resultado_test = run_agent("hazme un test", document_id)

resultado_limpio = re.sub(r"```json|```", "", resultado_test).strip()
test_json = json.loads(resultado_limpio)
# Mostrar preguntas SIN respuesta correcta
for i, p in enumerate(test_json["preguntas"]):
    print(f"\n{i + 1}. {p['pregunta']}")
    for letra, opcion in p["opciones"].items():
        print(f"   {letra}) {opcion}")

# Paso 2 - usuario responde
respuestas_usuario = input("\nTus respuestas (ej: 1-A, 2-C, 3-B, 4-D, 5-A): ")

# Paso 3 - corregir pasando el JSON completo con respuestas correctas
resultado = run_agent(
    f"Test:\n{resultado_test}\n\nRespuestas del usuario:\n{respuestas_usuario}",
    document_id,
)
print("\nCORRECCIÓN:\n", resultado)
