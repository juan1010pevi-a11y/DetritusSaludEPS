#!/usr/bin/env bash
# =====================================================================
# Bootstrap de una sola vez (lo ejecuta una persona con rol Owner, p. ej.
# en Azure Cloud Shell o con `az login` + `gh auth login` en local).
#
#  1. Registra los resource providers necesarios.
#  2. Crea el resource group.
#  3. Crea una identidad administrada (User-Assigned) para GitHub Actions.
#  4. Le da permisos SOLO sobre el resource group (mínimo privilegio).
#  5. Crea federated credentials (OIDC): cero secretos de larga duración.
#  6. Genera la contraseña de PostgreSQL y despliega infra/main.bicep
#     (ACR, Log Analytics, PostgreSQL Flexible Server + bases) y crea el
#     Container Apps Environment en modo estándar (WorkloadProfiles).
#  7. Guarda IDs y nombres como secrets/variables del repositorio.
#
# Uso:
#   GH_REPO=mi-usuario/biblioteca-micro PREFIX=equipo1 ./scripts/bootstrap-azure.sh
#
#   Las regiones se eligen SOLAS: el script lee la política de regiones permitidas de la
#   suscripción y comprueba dónde hay Container Apps y PostgreSQL. Para forzarlas:
#   LOCATION=southcentralus PG_LOCATION=canadacentral GH_REPO=... PREFIX=... ./scripts/bootstrap-azure.sh
# =====================================================================
set -euo pipefail

: "${GH_REPO:?Define GH_REPO=owner/repo}"
: "${PREFIX:?Define PREFIX (3-10 letras minúsculas/números)}"
LOCATION="${LOCATION:-}"
PG_LOCATION="${PG_LOCATION:-}"
RG="${RG:-rg-${PREFIX}-biblio}"
IDENTITY_NAME="id-${PREFIX}-github"
ENV_NAME="production"

command -v az >/dev/null || { echo "Falta Azure CLI"; exit 1; }
command -v gh >/dev/null || { echo "Falta GitHub CLI"; exit 1; }

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Suscripción: $SUBSCRIPTION_ID  Tenant: $TENANT_ID  RG: $RG"

echo "==> 0. Actualizando la extensión containerapp de la CLI"
az extension add --name containerapp --upgrade --allow-preview true -y --only-show-errors

echo "==> 1. Registrando resource providers (Azure for Students los trae sin registrar)"
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.ManagedIdentity; do
  az provider register --namespace "$ns" --wait >/dev/null
done

echo "==> 1b. Eligiendo regiones (política de la suscripción + disponibilidad real)"
# Si el grupo de recursos ya existe (repetición del script), se respeta su región.
if [ -z "$LOCATION" ] && az group show -n "$RG" >/dev/null 2>&1; then
  LOCATION=$(az group show -n "$RG" --query location -o tsv)
fi
PREFERIDAS="southcentralus eastus2 eastus centralus westus2 westus3 canadacentral brazilsouth chilecentral mexicocentral"
PERMITIDAS=$(az policy assignment list --query "[].parameters.listOfAllowedLocations.value[]" -o tsv 2>/dev/null \
  | tr 'A-Z' 'a-z' | sort -u)
if [ -n "$PERMITIDAS" ]; then
  echo "   Regiones permitidas por la política: $(echo $PERMITIDAS)"
  CANDIDATAS=""
  for r in $PREFERIDAS; do echo "$PERMITIDAS" | grep -qx "$r" && CANDIDATAS="$CANDIDATAS $r"; done
  for r in $PERMITIDAS; do echo " $CANDIDATAS " | grep -q " $r " || CANDIDATAS="$CANDIDATAS $r"; done
else
  echo "   La suscripción no restringe regiones"
  CANDIDATAS="$PREFERIDAS"
fi
norm () { tr 'A-Z' 'a-z' | tr -d ' '; }
ACA_REGIONES=$(az provider show -n Microsoft.App \
  --query "resourceTypes[?resourceType=='managedEnvironments'].locations[]" -o tsv | norm)
# PostgreSQL disponible = la región ofrece al menos una versión (lista vacía = no disponible)
pg_ok () { [ -n "$(az postgres flexible-server list-skus -l "$1" \
  --query "[0].supportedServerVersions[].name" -o tsv 2>/dev/null)" ]; }
if [ -z "$LOCATION" ]; then
  for r in $CANDIDATAS; do echo "$ACA_REGIONES" | grep -qx "$r" && { LOCATION=$r; break; }; done
fi
[ -n "$LOCATION" ] || { echo "ERROR: ninguna región permitida ofrece Container Apps"; exit 1; }
if [ -z "$PG_LOCATION" ]; then
  if pg_ok "$LOCATION"; then
    PG_LOCATION=$LOCATION
  else
    echo "   PostgreSQL no está disponible en $LOCATION; buscando otra región para la base..."
    for r in $CANDIDATAS; do
      [ "$r" = "$LOCATION" ] && continue
      echo "   probando $r"
      pg_ok "$r" && { PG_LOCATION=$r; break; }
    done
  fi
fi
[ -n "$PG_LOCATION" ] || { echo "ERROR: ninguna región permitida ofrece PostgreSQL Flexible"; exit 1; }
echo "   Contenedores: $LOCATION   ·   PostgreSQL: $PG_LOCATION"

echo "==> 2. Resource group"
az group create -n "$RG" -l "$LOCATION" -o none
RG_ID=$(az group show -n "$RG" --query id -o tsv)

echo "==> 3. Identidad administrada para GitHub Actions"
# Se usa una User-Assigned Managed Identity (no una App Registration): no requiere
# permisos de administrador en Entra ID, solo ser Owner de la suscripción. Ideal en
# tenants universitarios donde los estudiantes no pueden registrar aplicaciones.
az identity create -g "$RG" -n "$IDENTITY_NAME" -o none
CLIENT_ID=$(az identity show -g "$RG" -n "$IDENTITY_NAME" --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show -g "$RG" -n "$IDENTITY_NAME" --query principalId -o tsv)
echo "   Esperando a que la identidad se propague en Entra ID..."; sleep 30

echo "==> 4. Roles sobre el resource group (no sobre la suscripción)"
for role in "Contributor" "AcrPush" "Role Based Access Control Administrator"; do
  az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "$role" --scope "$RG_ID" -o none 2>/dev/null || echo "   (rol '$role' ya asignado)"
done

echo "==> 5. Federated credentials (OIDC)"
OWNER="${GH_REPO%%/*}"; REPO="${GH_REPO##*/}"
OWNER_ID=$(gh api "repos/$GH_REPO" --jq .owner.id)
REPO_ID=$(gh api "repos/$GH_REPO" --jq .id)
# Repos creados (o renombrados/transferidos) después del 15-jul-2026 usan un `sub`
# inmutable con IDs numéricos. Creamos ambos formatos para que funcione en cualquier caso.
LEGACY="repo:${OWNER}/${REPO}"
IMMUTABLE="repo:${OWNER}@${OWNER_ID}/${REPO}@${REPO_ID}"

create_fic () { # nombre subject
  if az identity federated-credential show -g "$RG" --identity-name "$IDENTITY_NAME" -n "$1" >/dev/null 2>&1; then
    echo "   $1 ya existe"; return
  fi
  az identity federated-credential create -g "$RG" --identity-name "$IDENTITY_NAME" -n "$1" -o none \
    --issuer "https://token.actions.githubusercontent.com" \
    --subject "$2" --audiences "api://AzureADTokenExchange"
  echo "   + $1 -> $2"
}
create_fic "env-${ENV_NAME}"            "${LEGACY}:environment:${ENV_NAME}"
create_fic "branch-main"                "${LEGACY}:ref:refs/heads/main"
create_fic "pull-request"               "${LEGACY}:pull_request"
create_fic "env-${ENV_NAME}-immutable"  "${IMMUTABLE}:environment:${ENV_NAME}"
create_fic "branch-main-immutable"      "${IMMUTABLE}:ref:refs/heads/main"
create_fic "pull-request-immutable"     "${IMMUTABLE}:pull_request"

echo "==> 6. Infraestructura compartida (infra/main.bicep) — PostgreSQL tarda ~5-10 min"
# Contraseña aleatoria: mayúsculas + minúsculas + dígitos (cumple la política de Azure
# y no tiene caracteres que haya que escapar). Nadie la escribe ni la ve.
DB_PASS="Pg$(openssl rand -hex 12)Az9"
OUT=$(az deployment group create -g "$RG" -n main -f infra/main.bicep \
  -p prefix="$PREFIX" pgLocation="$PG_LOCATION" dbAdminPassword="$DB_PASS" \
  --query properties.outputs -o json)
val () { echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1']['value'])"; }

echo "==> 6b. Container Apps Environment en modo ESTÁNDAR (WorkloadProfiles, no Express)"
ENV_NAME_ACA="$(val acaEnvName)"
if az containerapp env show -n "$ENV_NAME_ACA" -g "$RG" >/dev/null 2>&1; then
  echo "   $ENV_NAME_ACA ya existe"
else
  LAW="$(val logAnalyticsName)"
  WS_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query customerId -o tsv)
  WS_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LAW" --query primarySharedKey -o tsv)
  az containerapp env create -n "$ENV_NAME_ACA" -g "$RG" -l "$LOCATION" \
    --environment-mode WorkloadProfiles \
    --logs-workspace-id "$WS_ID" --logs-workspace-key "$WS_KEY" -o none --only-show-errors
  echo "   + $ENV_NAME_ACA creado"
fi

echo "==> 7. Secrets y variables en GitHub ($GH_REPO)"
gh secret set AZURE_CLIENT_ID       -R "$GH_REPO" -b "$CLIENT_ID"
gh secret set AZURE_TENANT_ID       -R "$GH_REPO" -b "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID -R "$GH_REPO" -b "$SUBSCRIPTION_ID"
gh secret set DB_ADMIN_PASSWORD     -R "$GH_REPO" -b "$DB_PASS"
gh variable set AZURE_RG          -R "$GH_REPO" -b "$RG"
gh variable set AZURE_PREFIX      -R "$GH_REPO" -b "$PREFIX"
gh variable set PG_LOCATION       -R "$GH_REPO" -b "$PG_LOCATION"
gh variable set ACR_NAME          -R "$GH_REPO" -b "$(val acrName)"
gh variable set ACR_LOGIN_SERVER  -R "$GH_REPO" -b "$(val acrLoginServer)"
gh variable set ACA_ENV_NAME      -R "$GH_REPO" -b "$(val acaEnvName)"
gh variable set PULL_IDENTITY_ID  -R "$GH_REPO" -b "$(val pullIdentityId)"
gh variable set PG_HOST           -R "$GH_REPO" -b "$(val pgHost)"
gh variable set PG_SERVER_NAME    -R "$GH_REPO" -b "$(val pgServerName)"
gh variable set DB_ADMIN_USER     -R "$GH_REPO" -b "$(val dbAdminUser)"

gh api -X PUT "repos/$GH_REPO/environments/$ENV_NAME" >/dev/null

cat <<EOF2

Listo.
  Registry:    $(val acrLoginServer)
  PostgreSQL:  $(val pgHost)  (bases: usuarios, eventos)

Regiones:    contenedores en $LOCATION · PostgreSQL en $PG_LOCATION

Siguiente paso:  git push -u origin main   → el workflow deploy.yml construye y despliega.
La URL pública del gateway aparece al final del job "deploy".
EOF2
