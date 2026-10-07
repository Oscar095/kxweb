# Cotizador Kos para Azure App Service (contenedor Linux). Ver GUIA_AZURE.md.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Bogota \
    PORT=8000 \
    COTIZADOR_DATA=/home/cotizador/data \
    COTIZADOR_SALIDAS=/home/cotizador/salidas \
    COTIZADOR_PDF_MOTOR=auto

# LibreOffice sin interfaz arma el PDF con la plantilla Word de Kos (en Linux no hay Word).
# Fuentes compatibles con Arial y Times New Roman (Liberation) y con Calibri (Carlito).
# tzdata: hora de Colombia en las fechas de las cotizaciones.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer-nogui fonts-liberation fonts-crosextra-carlito fonts-dejavu-core tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN sed -i 's/\r$//' azure/iniciar.sh && chmod +x azure/iniciar.sh

EXPOSE 8000
CMD ["/app/azure/iniciar.sh"]
