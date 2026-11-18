#!/usr/bin/env bash
# Tres pruebas contra el sistema desplegado (o local):
#   1. Concurrencia de inventario: N estudiantes piden a la vez un libro con pocos ejemplares.
#   2. Límite por estudiante: un mismo estudiante dispara 8 solicitudes simultáneas.
#   3. Idempotencia: la misma solicitud enviada 3 veces con la misma Idempotency-Key.
#
# Uso:  ./scripts/prueba-carga.sh https://<gateway>   [estudiantes=20] [ejemplares=3]
#       ./scripts/prueba-carga.sh http://localhost:8080
set -euo pipefail
GW="${1:?URL del gateway}"
N="${2:-20}"
EJ="${3:-3}"
RUN=$RANDOM
json () { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

echo "== 1. Concurrencia de inventario: $N estudiantes, $EJ ejemplares"
LIBRO=$(curl -fsS -X POST "$GW/api/libros" -H 'Content-Type: application/json' \
  -d "{\"isbn\":\"CARGA$RUN\",\"titulo\":\"Libro de carga $RUN\",\"autor\":\"Prueba\",\"ejemplares\":$EJ}" | json "['id']")
for i in $(seq 1 "$N"); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$GW/api/prestamos" -H 'Content-Type: application/json' \
    -d "{\"libro_id\":$LIBRO,\"email\":\"e$i-$RUN@ucatolica.edu.co\"}" &
done | sort | uniq -c
wait
echo "   Disponibles al final: $(curl -fsS "$GW/api/libros/$LIBRO" | json "['ejemplares_disponibles']")  (esperado: 0)"

echo "== 2. Límite por estudiante: 8 solicitudes simultáneas del mismo correo"
GRANDE=$(curl -fsS -X POST "$GW/api/libros" -H 'Content-Type: application/json' \
  -d "{\"isbn\":\"LIM$RUN\",\"titulo\":\"Libro grande $RUN\",\"autor\":\"Prueba\",\"ejemplares\":50}" | json "['id']")
for i in $(seq 1 8); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$GW/api/prestamos" -H 'Content-Type: application/json' \
    -d "{\"libro_id\":$GRANDE,\"email\":\"limite-$RUN@ucatolica.edu.co\"}" &
done | sort | uniq -c
wait
echo "   (esperado: 3 × 201 y 5 × 422)"

echo "== 3. Idempotencia: 3 envíos con la misma Idempotency-Key"
KEY="demo-$RUN"
for i in 1 2 3; do
  curl -s -D - -o /tmp/resp-$RUN.json -X POST "$GW/api/prestamos" -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $KEY" -d "{\"libro_id\":$GRANDE,\"email\":\"idem-$RUN@ucatolica.edu.co\"}" \
    | grep -iE '^HTTP|^idempotent-replay' | tr -d '\r' | tr '\n' ' '
  echo "→ préstamo #$(json "['id']" < /tmp/resp-$RUN.json)"
done
echo "   (esperado: 201 la primera vez, luego 200 con Idempotent-Replay: true y el MISMO número)"
