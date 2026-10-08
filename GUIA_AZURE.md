# Subir el Cotizador Kos a Azure

**Para:** TI de Kos Colombia · **Responsable funcional:** Carlos Rojas (gerente)

## Cómo queda

- El cotizador corre como **contenedor Linux en Azure App Service** (Web App for Containers), con HTTPS y una dirección del tipo `https://<nombre>.azurewebsites.net`.
- **PDF de la oferta**: en Linux no hay Microsoft Word. El contenedor trae **LibreOffice**, que llena la misma plantilla Word de Kos, con fuentes equivalentes a Arial, Times y Calibri.
- **Datos**: la base de datos (usuarios y cotizaciones) y el catálogo quedan en el almacenamiento permanente de App Service (`/home/cotizador/data`). Sobreviven a reinicios y actualizaciones.
- **Primer arranque**: el paquete trae en `data_inicial/` una copia de la base y el catálogo del día en que se armó. Así los usuarios, contraseñas y cotizaciones actuales pasan a Azure.
- **Cargas del ERP y respaldos**: sin consola. El gerente lo hace en **Configuración → Datos del ERP**: subir el inventario (costos y productos) y el archivo de ventas (clientes, vendedores y referencia de precios), descargar y subir el catálogo, y descargar respaldos.
- Los comerciales solo necesitan el navegador. No instalan nada.

## 0. Antes de empezar

1. Armar el paquete **el mismo día** del despliegue. En el PC donde corre hoy el cotizador, desde su carpeta:

   ```cmd
   python azure\empaquetar.py
   ```

   Queda `dist\cotizador_azure_<fecha>.zip`. No trae claves temporales, respaldos ni informes.
2. Desde ese momento **nadie trabaja en la copia local**: lo que se haga allí no pasa a Azure.

> El .zip trae la base de datos con usuarios (contraseñas cifradas), cotizaciones y costos. Trátelo como información confidencial.

## 1. Construir la imagen (Azure Cloud Shell, sin instalar nada)

En [portal.azure.com](https://portal.azure.com), abrir **Cloud Shell** (ícono `>_`, modo **Bash**), subir el .zip con el botón **Upload** y ejecutar:

```bash
GRUPO=rg-cotizador-kos
REGION=eastus2
ACR=acrcotizadorkos            # nombre único en Azure: solo minúsculas y números

az group create -n $GRUPO -l $REGION
az acr create -g $GRUPO -n $ACR --sku Basic
unzip cotizador_azure_*.zip
cd cotizador_azure_*/
az acr build -r $ACR -t cotizador:v1 .
```

`az acr build` construye la imagen en Azure, sin Docker en el PC. Tarda unos minutos porque instala LibreOffice.

## 2. Crear la Web App (portal)

**Crear un recurso → Web App**:

| Campo | Valor |
|---|---|
| Grupo de recursos | `rg-cotizador-kos` |
| Nombre | p. ej. `cotizador-kos`, que da la dirección `https://cotizador-kos.azurewebsites.net` |
| Publicar | **Contenedor** |
| Sistema operativo | **Linux** |
| Región | la misma del paso 1 |
| Plan | uno nuevo, **Básico B2** (LibreOffice necesita memoria; B1 queda justo) |
| Contenedor → origen de la imagen | **Azure Container Registry**: registro `acrcotizadorkos`, imagen `cotizador`, etiqueta `v1` |
| Autenticación con el registro | **Identidad administrada** (o credenciales de administrador del registro) |

## 3. Configurar la Web App

1. **Configuración → Variables de entorno**:

   | Nombre | Valor | Para qué |
   |---|---|---|
   | `WEBSITES_PORT` | `8000` | Puerto del cotizador dentro del contenedor |
   | `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `true` | Almacenamiento permanente en `/home`, donde viven los datos |
   | `WEBSITES_CONTAINER_START_TIME_LIMIT` | `600` | El primer arranque tarda más (imagen con LibreOffice) |

2. **Configuración → Configuración general**: *Siempre activo* **Sí** · *Sockets web* **Sí** · *Afinidad ARR* **Sí** · *Solo HTTPS* **Sí**.
3. **Escalar horizontalmente**: **1 instancia**, sin escalado automático. La base de datos es un archivo SQLite y la sesión de cada usuario vive en una instancia.
4. **Reiniciar** la Web App.

## 4. Recomendado: ingreso con la cuenta de Microsoft de Kos

**Autenticación → Agregar proveedor de identidad → Microsoft** (inquilino actual), con *Requerir autenticación* y *Solicitudes no autenticadas: redirigir (HTTP 302)*.

Así, antes de la pantalla del cotizador, cada persona entra con su cuenta de Microsoft 365 de Kos. **Muy recomendado**: la pantalla de ingreso del cotizador muestra la lista de usuarios, y con esto solo la ven personas de Kos. Son **dos llaves**: la cuenta de Microsoft y el usuario y contraseña del cotizador. Si algún comercial no tiene cuenta de Kos, TI puede invitarlo como usuario invitado.

## 5. Verificar

1. Abrir `https://<nombre>.azurewebsites.net`. El primer arranque puede tardar 2 o 3 minutos.
2. Entrar eligiendo un usuario de la lista, con las mismas contraseñas de hoy.
3. Crear una cotización de prueba dentro de la política, generar el PDF y revisar que salga con la plantilla de Kos (membrete, tabla azul y marca de agua).
4. **Configuración → Datos del ERP**: descargar el respaldo y confirmar que el .zip trae `cotizador.db` y `catalogo.xlsx`.
5. Si algo falla: **Supervisión → Secuencia de registro** muestra los mensajes del contenedor.

## 6. Entregar a los comerciales

- La dirección `https://...` y su usuario (nombre y primer apellido).
- Clave temporal: el gerente la genera en **Usuarios → Restablecer clave**. Al entrar la primera vez deben cambiarla.

## Actualizar el cotizador (nueva versión)

1. Armar el paquete **sin datos**, para no pisar los de Azure:

   ```cmd
   python azure\empaquetar.py --sin-datos
   ```

2. En Cloud Shell, subirlo, descomprimirlo y construir con una etiqueta nueva: `az acr build -r $ACR -t cotizador:v2 .`
3. En la Web App: **Centro de implementación** → etiqueta `v2` → Guardar, y luego reiniciar.

Los datos de `/home` no se tocan: el cotizador solo copia `data_inicial/` cuando aún no hay base de datos.

## Respaldos

- **Configuración → Datos del ERP → Descargar respaldo** (gerente): base de datos y catálogo en un .zip. Conviene hacerlo cada semana o antes de cargas grandes.
- En planes **Estándar** o superiores, App Service también hace respaldos automáticos programados.
- **Restaurar**: en Kudu (*Herramientas avanzadas*), reemplazar `/home/cotizador/data/cotizador.db` por el del respaldo y reiniciar.

## Notas

- **Una sola instancia** (ver paso 3). Para muchos usuarios simultáneos, la siguiente etapa sería mover la base a Azure SQL o PostgreSQL.
- La **hora** del contenedor es la de Colombia (America/Bogota).
- El **PDF con LibreOffice** puede diferir mínimamente del de Word en espacios o saltos de línea. El contenido es el mismo.
- Si la subida de archivos en **Datos del ERP** responde «403», agregar la variable `STREAMLIT_SERVER_ENABLE_XSRF_PROTECTION` = `false` y reiniciar.
- El costo mensual depende del plan (B2), del registro de contenedores (Basic) y del almacenamiento: ver la calculadora de precios de Azure.
