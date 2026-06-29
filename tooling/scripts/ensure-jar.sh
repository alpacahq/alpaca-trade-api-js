#!/usr/bin/env bash
# Ensure the pinned openapi-generator jar is present locally.
#
# The @openapitools/openapi-generator-cli wrapper normally downloads the jar
# itself using axios, but that fails behind TLS-intercepting proxies
# ("self-signed certificate in certificate chain"). curl honours the system
# trust store, so we fetch the jar with curl and drop it into the wrapper's
# storage dir; the wrapper then sees it as already installed and skips its
# own download.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -e "console.log(require('./openapitools.json')['generator-cli'].version)")"
STORAGE="$(node -e "const c=require('./openapitools.json')['generator-cli']; console.log(c.storageDir || 'node_modules/@openapitools/openapi-generator-cli/versions')")"
STORAGE="${STORAGE/#\~/$HOME}"
JAR="$STORAGE/$VERSION.jar"

if [ -f "$JAR" ]; then
  echo "Generator jar already present: $JAR"
  exit 0
fi

mkdir -p "$STORAGE"
URL="https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${VERSION}/openapi-generator-cli-${VERSION}.jar"
echo "Downloading openapi-generator ${VERSION} ..."
echo "  $URL"
curl -fsSL "$URL" -o "$JAR.tmp"
mv "$JAR.tmp" "$JAR"
echo "Generator jar written to $JAR"
