#!/usr/bin/env bash
# Regenerates the template gallery thumbnails in public/templates/.
# Requires poppler (pdftoppm) and ImageMagick (convert).
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

VARIANTS=invoice DPI=110 npx tsx --tsconfig tsconfig.scripts.json scripts/render-templates.tsx "$tmp"
mkdir -p public/templates
for png in "$tmp"/*-invoice-1.png; do
  id=$(basename "$png" -invoice-1.png)
  convert "$png" -resize 640x -background white -flatten -strip -quality 82 "public/templates/$id.jpg"
done
ls -la public/templates
