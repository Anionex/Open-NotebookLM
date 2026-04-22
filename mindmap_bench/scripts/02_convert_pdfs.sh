#!/usr/bin/env bash
# Convert every PDF in papers/ to Markdown in papers_md/ via mineru-open-api.
# Idempotent: skips a PDF if its <stem>.md already exists and is >1KB.
set -euo pipefail

BENCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAPERS_DIR="$BENCH_DIR/papers"
MD_DIR="$BENCH_DIR/papers_md"

mkdir -p "$MD_DIR"

todo=()
for pdf in "$PAPERS_DIR"/*.pdf; do
    stem="$(basename "$pdf" .pdf)"
    out="$MD_DIR/$stem.md"
    if [[ -f "$out" && $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") -gt 1024 ]]; then
        echo "skip: $stem.md already present"
        continue
    fi
    todo+=("$pdf")
done

if [[ ${#todo[@]} -eq 0 ]]; then
    echo "All PDFs already converted."
    exit 0
fi

echo "Converting ${#todo[@]} PDFs via mineru-open-api extract..."
mineru-open-api extract "${todo[@]}" -o "$MD_DIR/" -l en -f md

echo
echo "MD files now in papers_md/:"
ls -1 "$MD_DIR"/*.md | wc -l
