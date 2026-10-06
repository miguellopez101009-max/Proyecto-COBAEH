# Cuidando nuestro COBAEH — V1.5
Node 18+, sin dependencias externas. La página y la API salen del mismo servidor (rutas relativas, sin CORS).

## Uso local
    npm install
    npm start
Con clave de administración (la clave nunca va en el código):
- Windows CMD: `set "ADMIN_KEY=tu_clave" && npm start`
- PowerShell: `$env:ADMIN_KEY="tu_clave"; npm start`
- Mac/Linux: `ADMIN_KEY=tu_clave npm start`

La terminal imprime la dirección local y la del Wi-Fi. Sin `DATA_FILE`, los datos se guardan en `data.json` junto a `server.js` (está en `.gitignore`).

## Despliegue en Render con disco persistente
**Requisito:** el Persistent Disk solo existe en servicios **de pago** (no en el plan gratis). Revisa precios actuales en render.com. Un servicio con disco es de **una sola instancia** y cada redeploy tiene una breve interrupción (no hay despliegues sin caída).

### 1. Crear el Web Service
1. Sube el proyecto a GitHub (sin los archivos de la sección "No subir").
2. Render → **New → Web Service** → conecta el repositorio.
3. Configura:

| Campo | Valor |
|---|---|
| Language / Runtime | Node |
| Branch | la rama que usas (p. ej. `main`) |
| Root Directory | vacío (o la subcarpeta si `server.js` no está en la raíz del repo) |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | un plan de **pago** (necesario para el disco) |
| Health Check Path | `/health` (debe responder `{"ok":true}`) |

### 2. Variables de entorno (Environment)
| Variable | Valor |
|---|---|
| `ADMIN_KEY` | una clave larga y propia (solo aquí, nunca en GitHub, frontend ni README) |
| `DATA_FILE` | `/data/data.json` |

`PORT` la pone Render sola; no la definas.

### 3. Montar el Persistent Disk
En el servicio → **Disks → Add Disk**:
- **Name:** `cobaeh-data` (cualquiera)
- **Mount Path:** `/data`   ← exactamente esto, debe coincidir con `DATA_FILE`
- **Size:** 1 GB es suficiente (los datos son JSON pequeño)

Solo lo que se escribe bajo `/data` sobrevive a reinicios y redeploys. Añadir el disco provoca un redeploy. El disco solo está disponible mientras el servicio corre (no durante el build).
Al arrancar, el servidor imprime en los Logs `Datos: /data/data.json`. Si ves `⚠ /data no parece un disco persistente montado`, el disco no está montado en `/data`: corrige el Mount Path **antes** de usar la página.

### 4. Comprobar
- `https://TU-SERVICIO.onrender.com/health` → `{"ok":true}`
- Abre la URL desde el celular con datos móviles: crea cuenta, publica una idea, comenta, responde una encuesta.
- ⋮ → Administración → `ADMIN_KEY` → **Descargar respaldo**.

### 5. Migrar tus datos locales (opcional)
Si tus `data.json` actuales son solo de pruebas, lo más limpio es **empezar vacío** y no migrar nada. Si quieres conservarlos:
1. Servicio → Settings → **SSH**: agrega tu llave pública (Render documenta cómo; requiere servicio de pago).
2. Copia el archivo al disco con otro nombre (nunca directo sobre `data.json`):
   `scp -s data.json TU_SERVICIO@ssh.TU_REGION.render.com:/data/incoming.json`
3. En el **Shell** del servicio (o por SSH), dentro de la carpeta del proyecto:
   `node migrate.js /data/incoming.json /data/data.json`
   - Si ya existe `/data/data.json` **NO lo sobrescribe** y te lo dice. Solo con `--force` lo reemplaza, guardando antes una copia `data.json.bak-FECHA`.
   - Valida que el origen sea un JSON de esta aplicación antes de tocar nada.
4. **Reinicia el servicio** (Manual Deploy → Restart) para que cargue los datos. Hazlo antes de que alguien use la página: un servidor en marcha mantiene sus datos en memoria y podría pisar el archivo recién migrado.
5. Borra `/data/incoming.json`.

### 6. Comprobar que los datos sobreviven a un reinicio
1. Crea una cuenta de prueba, publica una idea y comenta. Descarga un respaldo y anota cuántos usuarios/ideas hay (Resultados).
2. Render → **Manual Deploy → Restart service** (y luego prueba también *Deploy latest commit*).
3. Espera a que `/health` responda. Entra con la misma cuenta y PIN: deben seguir tu cuenta, la idea y el comentario, y los números de Resultados deben ser iguales.
4. En los Logs debe aparecer otra vez `Datos: /data/data.json` sin avisos `⚠`.

### No subir a GitHub
`data.json` y sus copias (`data.json.*`, `*.bak*`), respaldos `backup-*.json`, `.env`, `node_modules/` y cualquier archivo con tu `ADMIN_KEY`. Ya están en `.gitignore`. La `ADMIN_KEY` solo vive en las variables de entorno de Render.

## Moderación: nombre real y bloqueo de cuentas
- Al crear cuenta se pide **alias** (público) y **nombre y primer apellido** (solo lo ve Administración). Los alumnos nunca ven el nombre real; el inicio de sesión sigue siendo alias + grupo + PIN.
- En Administración → **Usuarios**: nombre real, grupo, número de ideas y comentarios, **Historial** de cada alumno y botón **Bloquear / Desbloquear**.
- Un usuario bloqueado no puede iniciar sesión, publicar, comentar, apoyar ni votar, y tampoco crear otra cuenta con el mismo nombre real y grupo.
- Las cuentas creadas antes de este cambio no tienen nombre real (aparece "—").
- Los respaldos incluyen los nombres reales: guárdalos en un lugar privado.

## Seguridad de los datos
- El servidor **no sobrescribe datos ilegibles**: si `DATA_FILE` existe pero está corrupto, se detiene con un mensaje claro en vez de empezar vacío.
- Escrituras agrupadas (250 ms), atómicas (archivo temporal + reemplazo) y vaciadas al apagar (SIGTERM/Ctrl+C).
- PIN: solo hash (scrypt), nunca se devuelve ni se muestra. Los tokens de sesión nunca salen del servidor.

## Respaldo manual
Administración → **Descargar respaldo** → `backup-AAAA-MM-DD_HH-MM.json` (hora UTC). Contiene usuarios, ideas (con apoyos), comentarios, encuestas, respuestas, actividades, álbumes, evidencias, estadísticas, grupos y palabras bloqueadas. No incluye `ADMIN_KEY`, variables de entorno ni tokens de sesión.
Estructura: `{ app, backupVersion, createdAt, data: { users, ideas, comments, surveys, answers, activities, albums, evidence, stats, groups, badWords } }`.
Los PIN van solo como hash (`pinHash` + `pinSalt`). Un PIN de 4 dígitos se puede adivinar a partir de su hash: **el respaldo es un archivo privado**. La restauración automática aún no existe. Descarga un respaldo antes de cada cambio importante y antes de la conferencia.

## Límites anti-abuso (por usuario, no por escuela)
| Acción | Límite (1 min) |
|---|---|
| Escrituras de un usuario | 60 |
| Ideas | 3 (máx. 5 por usuario) |
| Comentarios | 3 |
| Apoyos | 30 |
| Respuestas de encuestas | 20 |
| PIN incorrecto | 5 intentos → esa cuenta se bloquea 10 min |
| Registros / inicios de sesión por red | 600 |
| Tope por red (IP) | 3000 escrituras |
| Clave de Administración incorrecta | 10 intentos → esa red se bloquea 10 min |

## Prueba de carga
Con un `DATA_FILE` de pruebas (crea usuarios "carga…"):

    node loadtest.js http://localhost:3000 10

Simula N alumnos a la vez y compara lo confirmado por el servidor con lo guardado. Termina con `RESULTADO: OK` o lista los problemas.

## Notas funcionales
- Grupos incluidos: 1101-1103, 3101-3103 y 5101-5103 (más desde Administración). Semestres 2/4/6: `SEMESTERS` en `server.js`.
- Filtro de lenguaje: lista base en `server.js` (`BAD`); se amplía en Administración → Lenguaje bloqueado.
- Fotos: URLs externas (WebP optimizadas); videos: enlaces de YouTube. No hay subida de archivos.
