#!/usr/bin/env bash
# gen_cert.sh — generate a self-signed TLS cert for localhost development.
# Outputs: localhost+1.pem (cert) and localhost+1-key.pem (key) at the repo root.
# Run from the repo root: bash scripts/gen_cert.sh
# Pass --force to overwrite existing files.

set -u

CERT="localhost+1.pem"
KEY="localhost+1-key.pem"
FORCE=0

for arg in "$@"; do
  if [ "$arg" = "--force" ]; then
    FORCE=1
  fi
done

if [ -f "$CERT" ] && [ -f "$KEY" ] && [ "$FORCE" -eq 0 ]; then
  echo "Cert files already exist ($CERT, $KEY). Pass --force to overwrite."
  exit 0
fi

rm -f "$CERT" "$KEY"
# MSYS_NO_PATHCONV=1 prevents Git Bash on Windows from mangling /CN=... into a path.
# The leading // in the subject is a portable belt-and-suspenders for the same issue.
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$KEY" \
  -out "$CERT" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

if [ $? -ne 0 ]; then
  echo "ERROR: openssl failed. Make sure openssl is on your PATH." >&2
  exit 1
fi

echo ""
echo "Done! Generated $CERT and $KEY."
echo "Next: visit https://localhost:3443/app.html in your browser and accept the certificate warning."
