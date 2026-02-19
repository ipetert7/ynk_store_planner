#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost}"
MAX_HOPS="${MAX_HOPS:-12}"
USERNAME="${SSO_DEBUG_USERNAME:-}"
PASSWORD="${SSO_DEBUG_PASSWORD:-}"
COOKIE_JAR="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

print_response() {
  local headers_file="$1"
  local url="$2"
  local status location
  status="$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code}' "$headers_file")"
  location="$(awk 'BEGIN{IGNORECASE=1} /^Location:/ {loc=$2} END {gsub(/\r/,"",loc); print loc}' "$headers_file")"

  echo "URL: $url"
  echo "STATUS: ${status:-unknown}"
  if [[ -n "$location" ]]; then
    echo "LOCATION: $location"
  fi

  echo "SET-COOKIE:"
  awk 'BEGIN{IGNORECASE=1} /^Set-Cookie:/ {print "  " $0}' "$headers_file" || true
  echo "---"
}

join_url() {
  local base="$1"
  local location="$2"

  if [[ "$location" =~ ^https?:// ]]; then
    echo "$location"
    return
  fi

  if [[ "$location" == /* ]]; then
    echo "${base}${location}"
    return
  fi

  echo "${base}/${location}"
}

do_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local headers_file
  headers_file="$(mktemp)"

  if [[ "$method" == "POST" ]]; then
    curl -sS -D "$headers_file" -o /dev/null -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -X POST --data "$data" "$url"
  else
    curl -sS -D "$headers_file" -o /dev/null -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$url"
  fi

  print_response "$headers_file" "$url"

  REQUEST_STATUS="$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code}' "$headers_file")"
  REQUEST_LOCATION="$(awk 'BEGIN{IGNORECASE=1} /^Location:/ {loc=$2} END {gsub(/\r/,"",loc); print loc}' "$headers_file")"

  rm -f "$headers_file"
}

ORIGIN="${BASE_URL%/}"
CURRENT_URL="$ORIGIN/arriendos"
LOGGED_IN=0
HOP=0

echo "Diagnóstico SSO loop"
echo "Base URL: $ORIGIN"
echo "Max hops: $MAX_HOPS"
echo "---"

while [[ "$HOP" -lt "$MAX_HOPS" ]]; do
  HOP=$((HOP + 1))
  echo "Hop $HOP"

  do_request "GET" "$CURRENT_URL"
  STATUS="${REQUEST_STATUS:-}"
  LOCATION="${REQUEST_LOCATION:-}"

  if [[ "$STATUS" != "301" && "$STATUS" != "302" && "$STATUS" != "303" && "$STATUS" != "307" && "$STATUS" != "308" ]]; then
    echo "Cadena de redirección finalizada con STATUS=$STATUS"
    break
  fi

  if [[ -z "$LOCATION" ]]; then
    echo "Redirección sin Location. Fin del diagnóstico."
    break
  fi

  if [[ "$LOCATION" == "/login"* ]] && [[ "$LOGGED_IN" -eq 0 ]] && [[ -n "$USERNAME" ]] && [[ -n "$PASSWORD" ]]; then
    echo "Intentando login con credenciales de diagnóstico..."
    LOGIN_URL="$(join_url "$ORIGIN" "$LOCATION")"
    do_request "POST" "$LOGIN_URL" "username=$USERNAME&password=$PASSWORD"
    LOGIN_STATUS="${REQUEST_STATUS:-}"
    LOGIN_LOCATION="${REQUEST_LOCATION:-}"
    LOGGED_IN=1

    if [[ -n "$LOGIN_LOCATION" ]]; then
      CURRENT_URL="$(join_url "$ORIGIN" "$LOGIN_LOCATION")"
      continue
    fi

    echo "Login sin redirección posterior (status=$LOGIN_STATUS). Fin del diagnóstico."
    break
  fi

  CURRENT_URL="$(join_url "$ORIGIN" "$LOCATION")"
done

echo "Cookies finales relevantes:"
grep -E 'ynk_sso|next-auth\.session-token|__Secure-next-auth\.session-token' "$COOKIE_JAR" || true
