#!/bin/sh
# Arranque del Cotizador Kos en el contenedor (Azure App Service).
set -e
mkdir -p "$COTIZADOR_DATA" "$COTIZADOR_SALIDAS"

# Primer arranque: la base de datos y el catalogo del paquete pasan al almacenamiento
# permanente (/home). Si ya existen no se tocan: cotizaciones y cambios se conservan.
for archivo in cotizador.db catalogo.xlsx; do
  if [ ! -f "$COTIZADOR_DATA/$archivo" ] && [ -f "/app/data_inicial/$archivo" ]; then
    cp "/app/data_inicial/$archivo" "$COTIZADOR_DATA/$archivo"
    echo "Dato inicial copiado: $archivo"
  fi
done

exec python -m streamlit run app.py \
  --server.port "${PORT:-8000}" \
  --server.address 0.0.0.0 \
  --server.headless true \
  --server.fileWatcherType none \
  --client.showErrorDetails false \
  --client.toolbarMode minimal \
  --browser.gatherUsageStats false
