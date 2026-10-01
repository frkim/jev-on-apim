#!/bin/sh
# azd preprovision hook: make sure the values read by infra/main.bicepparam are set in the azd environment.
# The Jev API key is stored only in the local (git-ignored) .azure/<env>/.env file and in Key Vault.
set -eu
trap 'stty echo 2>/dev/null || true' EXIT INT TERM

ensure_value() {
  name="$1"
  prompt="$2"
  secret="$3"
  current=$(azd env get-value "$name" 2>/dev/null || true)
  if [ -n "$current" ]; then
    return 0
  fi
  eval "value=\${$name:-}"
  if [ -n "$value" ]; then
    azd env set "$name" "$value"
    return 0
  fi
  if [ ! -t 0 ]; then
    echo "ERROR: $name is not set. Run: azd env set $name <value>" >&2
    exit 1
  fi
  printf '%s: ' "$prompt"
  if [ "$secret" = "true" ]; then
    stty -echo
    read -r value
    stty echo
    echo
  else
    read -r value
  fi
  if [ -z "$value" ]; then
    echo "ERROR: $name cannot be empty." >&2
    exit 1
  fi
  azd env set "$name" "$value"
}

ensure_value APIM_PUBLISHER_EMAIL "APIM publisher e-mail" false
ensure_value JEV_API_KEY "Jev API key (input hidden)" true
