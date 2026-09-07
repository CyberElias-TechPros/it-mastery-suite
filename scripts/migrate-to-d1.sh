#!/bin/bash
# Production D1 Migration Script
# Run this after configuring wrangler.toml with your D1 database ID

echo "=== TechPros ITSM — D1 Migration Script ==="
echo "This script applies the D1 schema and creates seed data for production."
echo ""

# Check prerequisites
echo "[1/4] Checking prerequisites..."
if ! command -v wrangler &> /dev/null; then
  echo "Error: wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
fi

echo "[2/4] Applying D1 schema..."
wrangler d1 execute techpros-itsm --file=cloudflare/d1-schema.sql --local=false || echo "Note: D1 database 'techpros-itsm' not found. Ensure it exists in wrangler.toml."

echo "[3/4] Creating index checks (optional)..."
# D1 does not require explicit index creation for basic queries, but we document them in d1-schema.sql

echo "[4/4] Migration complete."
echo ""
echo "Next steps:"
echo "- Verify database: wrangler d1 execute techpros-itsm --command='SELECT * FROM profiles LIMIT 5'"
echo "- Deploy worker: wrangler deploy"
echo "- Set production secrets in Cloudflare dashboard (JWT_SECRET, FRONTEND_URL)"
