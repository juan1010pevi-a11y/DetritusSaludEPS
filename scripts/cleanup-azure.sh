#!/usr/bin/env bash
# Borra TODO lo creado (resource group: apps, registry, PostgreSQL, identidades).
set -euo pipefail
: "${PREFIX:?Define PREFIX}"
RG="${RG:-rg-${PREFIX}-biblio}"
az group delete -n "$RG" --yes --no-wait
echo "Eliminación de $RG en curso (tarda unos minutos)."
