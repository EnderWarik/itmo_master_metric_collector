#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${ROOT:-/Users/enderwar/Documents/Programming/itmo/micro-vue-third-pizza-start-source}"
OUT="/Users/enderwar/Documents/Programming/itmo/nir3/scripts/out"
mkdir -p "$OUT"

# Per-file CSV: project,file,size_bytes,gzip_bytes,kind
CSV="$OUT/bundle-files.csv"
{
  echo "Project;Filename;Size_bytes;Gzip_bytes;Kind"
  for proj in "frontend" "micro-frontends/shell" "micro-frontends/auth" "micro-frontends/cart" "micro-frontends/profile" "micro-frontends/order" "micro-frontends/pizza-builder"; do
    DIST="$ROOT/$proj/dist"
    NAME=$(basename "$proj")
    [[ -d "$DIST" ]] || continue
    while IFS= read -r f; do
      ext="${f##*.}"
      kind="other"
      [[ "$ext" == "js" ]] && kind="js"
      [[ "$ext" == "css" ]] && kind="css"
      [[ "$ext" == "html" ]] && kind="html"
      [[ "$ext" =~ ^(woff|woff2|ttf|otf|eot)$ ]] && kind="font"
      [[ "$ext" =~ ^(png|jpg|jpeg|svg|gif|webp|ico)$ ]] && kind="image"
      size=$(stat -f '%z' "$f")
      gzip_size=$(gzip -9c "$f" 2>/dev/null | wc -c | tr -d ' ')
      rel=${f#$DIST/}
      echo "$NAME;$rel;$size;$gzip_size;$kind"
    done < <(find "$DIST" -type f)
  done
} > "$CSV"

# Aggregated CSV per project
AGG="$OUT/bundle-summary.csv"
{
  echo "Project;Files_total;Files_JS;Files_CSS;Files_other;Size_total_bytes;Size_JS_bytes;Size_CSS_bytes;Gzip_total_bytes;Gzip_JS_bytes;Gzip_CSS_bytes"
  for proj in "frontend" "micro-frontends/shell" "micro-frontends/auth" "micro-frontends/cart" "micro-frontends/profile" "micro-frontends/order" "micro-frontends/pizza-builder"; do
    NAME=$(basename "$proj")
    awk -F';' -v n="$NAME" '
      $1==n {
        ft++
        if ($5=="js") { fjs++; sjs+=$3; gjs+=$4 }
        else if ($5=="css") { fcss++; scss+=$3; gcss+=$4 }
        else { foth++ }
        st+=$3; gt+=$4
      }
      END { printf "%s;%d;%d;%d;%d;%d;%d;%d;%d;%d;%d\n", n, ft+0, fjs+0, fcss+0, foth+0, st+0, sjs+0, scss+0, gt+0, gjs+0, gcss+0 }
    ' "$CSV"
  done
} > "$AGG"

# Comparison report
REPORT="$OUT/bundle-comparison.md"
{
  echo "# Bundle сравнение: Monolith vs MFE"
  echo ""
  echo "## По проектам"
  echo ""
  echo "| Project | Files | JS | CSS | Other | Total | JS gzip | Total gzip |"
  echo "|---|---|---|---|---|---|---|---|"
  awk -F';' 'NR>1 {
    printf "| %s | %d | %s KB (%d) | %s KB (%d) | %d | %s KB | %s KB | %s KB |\n",
      $1, $2, int($7/1024), $3, int($8/1024), $4, $5,
      int($6/1024), int($10/1024), int($9/1024)
  }' "$AGG"
  echo ""
  echo "## Сводка"
  echo ""
  awk -F';' '
    NR==1 { next }
    $1=="frontend" {
      mono_files=$2; mono_js_count=$3; mono_total=$6; mono_js=$7; mono_css=$8; mono_gzip_total=$9; mono_gzip_js=$10
    }
    $1!="frontend" {
      mfe_files+=$2; mfe_js_count+=$3; mfe_total+=$6; mfe_js+=$7; mfe_css+=$8; mfe_gzip_total+=$9; mfe_gzip_js+=$10
    }
    END {
      printf "**Монолит (frontend):**\n"
      printf "- Файлов: %d (JS: %d, CSS: %d)\n", mono_files, mono_js_count, $4
      printf "- Total dist: %d KB (gzip: %d KB)\n", int(mono_total/1024), int(mono_gzip_total/1024)
      printf "- JS only: %d KB (gzip: %d KB)\n\n", int(mono_js/1024), int(mono_gzip_js/1024)
      printf "**MFE (сумма всех 6 remotes):**\n"
      printf "- Файлов: %d (JS: %d)\n", mfe_files, mfe_js_count
      printf "- Total dist: %d KB (gzip: %d KB)\n", int(mfe_total/1024), int(mfe_gzip_total/1024)
      printf "- JS only: %d KB (gzip: %d KB)\n\n", int(mfe_js/1024), int(mfe_gzip_js/1024)
      printf "**Дельты:**\n"
      printf "- Файлов: %d → %d (×%.1f)\n", mono_files, mfe_files, mfe_files/mono_files
      printf "- JS-чанков: %d → %d (×%.1f)\n", mono_js_count, mfe_js_count, mfe_js_count/mono_js_count
      printf "- Total dist: %d KB → %d KB (×%.2f)\n", int(mono_total/1024), int(mfe_total/1024), mfe_total/mono_total
      printf "- JS bundle: %d KB → %d KB (×%.2f)\n", int(mono_js/1024), int(mfe_js/1024), mfe_js/mono_js
      printf "- JS gzip: %d KB → %d KB (×%.2f)\n", int(mono_gzip_js/1024), int(mfe_gzip_js/1024), mfe_gzip_js/mono_gzip_js
    }
  ' "$AGG"
} > "$REPORT"

echo "Files written:"
echo "  $CSV"
echo "  $AGG"
echo "  $REPORT"
echo ""
cat "$REPORT"
