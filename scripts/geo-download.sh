#!/bin/sh
# Baixa a base gratuita DB-IP "IP to City Lite" (formato mmdb).
# Licença: CC BY 4.0 — exige atribuição ("IP Geolocation by DB-IP", https://db-ip.com), exibida no painel.
# Uso: sh scripts/geo-download.sh [pasta-destino]   (padrão: data/geo)
set -eu
DEST="${1:-data/geo}"
FILE="$DEST/dbip-city-lite.mmdb"
mkdir -p "$DEST"

year=$(date -u +%Y)
month=$(date -u +%m)
current="$year-$month"
# mês anterior (POSIX sh, sem `date -d`)
m=$(expr "$month" + 0)
if [ "$m" -eq 1 ]; then prev="$(expr "$year" - 1)-12"; else prev="$year-$(printf '%02d' "$(expr "$m" - 1)")"; fi

fetch() { # curl se existir; senão wget (já vem nas imagens alpine)
  if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 --max-time 600 "$1" -o "$2"
  else wget -q -T 600 -O "$2" "$1"; fi
}

for period in "$current" "$prev"; do
  url="https://download.db-ip.com/free/dbip-city-lite-$period.mmdb.gz"
  echo "→ baixando $url"
  if fetch "$url" "$FILE.gz.tmp"; then
    gunzip -c "$FILE.gz.tmp" > "$FILE.tmp"
    rm -f "$FILE.gz.tmp"
    mv "$FILE.tmp" "$FILE"
    echo "$period" > "$DEST/VERSION"
    echo "✓ base de geolocalização $period salva em $FILE"
    exit 0
  fi
done
echo "✗ não foi possível baixar a base DB-IP" >&2
exit 1
