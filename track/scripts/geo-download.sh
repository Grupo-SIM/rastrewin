#!/bin/sh
# Baixa as bases gratuitas da DB-IP (formato mmdb):
#   - "IP to City Lite": geolocalização (obrigatória);
#   - "IP to ASN Lite": dono do IP, usado para ignorar robôs da Meta/Google (opcional: sem ela, só não há filtro).
# Licença: CC BY 4.0 — exige atribuição ("IP Geolocation by DB-IP", https://db-ip.com), exibida no painel.
# Uso: sh scripts/geo-download.sh [pasta-destino]   (padrão: data/geo)
set -eu
DEST="${1:-data/geo}"
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

# download <base> → baixa dbip-<base>-AAAA-MM (mês atual ou anterior) para $DEST/dbip-<base>.mmdb
download() {
  file="$DEST/dbip-$1.mmdb"
  for period in "$current" "$prev"; do
    url="https://download.db-ip.com/free/dbip-$1-$period.mmdb.gz"
    echo "→ baixando $url"
    if fetch "$url" "$file.gz.tmp"; then
      gunzip -c "$file.gz.tmp" > "$file.tmp"
      rm -f "$file.gz.tmp"
      mv "$file.tmp" "$file"
      echo "$period" > "$DEST/VERSION"
      echo "✓ base $1 $period salva em $file"
      return 0
    fi
  done
  rm -f "$file.gz.tmp"
  return 1
}

download city-lite || { echo "✗ não foi possível baixar a base DB-IP de geolocalização" >&2; exit 1; }
download asn-lite || echo "⚠ base de ASN indisponível: o filtro de robôs fica desligado" >&2
