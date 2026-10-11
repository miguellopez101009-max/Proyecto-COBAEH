# Cuidando nuestro COBAEH — V1.5
Node 18+, sin dependencias externas. La página y la API salen del mismo servidor (rutas relativas, sin CORS).

## Uso local
    npm install
    npm start
Con clave de administración (la clave nunca va en el código):
- Windows CMD: `set "ADMIN_KEY=tu_clave" && npm start`
- PowerShell: `$env:ADMIN_KEY="tu_clave"; npm start`
- Mac/Linux: `ADMIN_KEY=tu_clave npm start`

La terminal imprime la dirección local y la del Wi-Fi. Sin `DATABASE_URL` ni `DATA_FILE`, los datos se guardan en `data.json` junto a `server.js` (está en `.gitignore`). `npm install` solo hace falta si usas `DATABASE_URL` (instala `pg`).

## Despliegue GRATIS: Render (gratis) + Neon (base de datos gratis)
Los datos se guardan en una base de datos Postgres externa (Neon), así que **sobreviven** cuando el servicio de Render se duerme, se reinicia o se vuelve a desplegar. Todo gratis, sin tarjeta.

### 1. Crear la base de datos en Neon
1. Entra a **neon.com**, crea una cuenta (puedes usar GitHub) y crea un proyecto (nombre libre, región cercana a la de Render).
2. En el panel del proyecto toca **Connect** / **Connection string** y copia la cadena (empieza con `postgresql://` e incluye usuario, contraseña y `sslmode=require`).
3. Esa cadena es un **secreto**: no la pegues en GitHub, README ni en ningún archivo. Solo va en Render (paso 2).
No hay que crear tablas: el servidor crea la suya solo la primera vez.

### 2. Crear el Web Service en Render
Render → **New → Web Service** → conecta tu repositorio de GitHub.

| Campo | Valor |
|---|---|
| Language / Runtime | Node |
| Root Directory | vacío (o la subcarpeta si `server.js` no está en la raíz del repo) |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/health` (en *Advanced*) |

**Environment Variables:**
| Variable | Valor |
|---|---|
| `ADMIN_KEY` | una clave larga y propia |
| `DATABASE_URL` | la cadena de conexión de Neon (pégala tal cual, sin comillas) |

No definas `DATA_FILE` ni agregues disco (solo se usan sin `DATABASE_URL`). `PORT` la pone Render.

### 3. Comprobar
- Logs de Render: debe decir `Datos: base de datos Postgres` y nada con `✖`.
- `https://TU-SERVICIO.onrender.com/health` → `{"ok":true}`.
- Desde el celular con datos móviles: crea una cuenta, publica una idea.
- ⋮ → Administración → `ADMIN_KEY` → **Descargar respaldo**.

### 4. Comprobar que los datos sobreviven
1. Crea una cuenta de prueba y una idea.
2. Render → **Manual Deploy → Restart service** (o espera ~15 min sin visitas a que se duerma).
3. Abre la página otra vez (la primera visita tarda hasta ~1 minuto en despertar) y entra con la misma cuenta y PIN: la cuenta y la idea deben seguir ahí.

### Cosas que debes saber (plan gratis)
- **El servicio se duerme tras ~15 min sin visitas** y la primera persona espera cerca de un minuto. Ábrelo tú unos minutos antes de la presentación o conferencia. Los datos no se pierden.
- Neon gratis: 0.5 GB (de sobra) y su cómputo se suspende tras 5 min sin uso; despierta solo en una fracción de segundo.
- Si no se puede conectar a la base al arrancar, el servidor **se detiene** (con un mensaje claro) en vez de empezar vacío: así nunca pisa datos buenos.
- Si la base se cae un momento con la página en marcha, la página sigue funcionando y los cambios pendientes se guardan solos cuando vuelve.
- **Descarga un respaldo** (Administración) antes de presentar y al terminar: es tu copia propia.

### Migrar tus datos locales a Neon (opcional)
Si tus `data.json` actuales son solo de pruebas, empieza vacío. Si quieres conservarlos: en tu computadora, en la carpeta del proyecto, con `npm install` hecho y la cadena de Neon:
- CMD: `set "DATABASE_URL=la_cadena_de_neon" && node migrate.js data.json --db`
- PowerShell: `$env:DATABASE_URL="la_cadena_de_neon"; node migrate.js data.json --db`
No sobrescribe una base que ya tenga datos; con `--force` la reemplaza guardando antes una copia `db-backup-FECHA.json`. Reinicia el servicio después.

### Alternativa de pago: disco persistente
En un plan de pago de Render puedes usar un **Persistent Disk** en vez de Neon: Disks → Add Disk con Mount Path `/data`, variable `DATA_FILE=/data/data.json` y sin `DATABASE_URL`. Los datos se guardan en ese archivo. `migrate.js <origen> /data/data.json` copia datos de forma segura sin sobrescribir.

### No subir a GitHub
`data.json` y sus copias, respaldos (`backup-*.json`, `db-backup-*.json`), `.env`, `node_modules/` y cualquier archivo con tu `ADMIN_KEY` o tu cadena de Neon. Ya están en `.gitignore`.

## Seguridad de los datos
- El servidor **no sobrescribe datos ilegibles**: si `DATA_FILE` está corrupto o la base de datos no responde al arrancar, se detiene con un mensaje claro en vez de empezar vacío.
- Escrituras agrupadas (250 ms), vaciadas al apagar (SIGTERM/Ctrl+C); en archivo son atómicas (temporal + reemplazo) y en Postgres se guardan en una sola fila.
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

## Actualización V1.6 (identidad COBAEH, cuentas y encuestas)

**Cómo actualizar en Render sin perder datos:**
1. En Administración → *Grupos y configuración* → **Descargar respaldo** (guárdalo en privado).
2. Sube a GitHub los archivos cambiados: `server.js`, `README.md`, `public/index.html`, `public/app.js`, `public/style.css`. Render redeploya solo.
3. Al arrancar con datos del esquema anterior, el servidor guarda una copia automática (en Postgres: tabla `app_state_backup`; en archivo: `data.json.bak-v16`) y migra sin borrar nada.

**Qué cambió:** logo de huella de jaguar + "PLANTEL ALMOLOYA"; textos de acceso nuevos; cuentas con estado (activa/suspendida/eliminada); administración en 7 bloques; encuestas de 4 tipos (única, Sí/No, escala 1–5 con etiquetas, múltiple) con borrador/publicada/oculta, edición segura y resultados por tipo; 4 encuestas iniciales sembradas **como borrador** (una sola vez, nunca duplicadas).

**Suspender:** bloquea inicio de sesión y toda acción en el servidor (aunque la sesión siga abierta). El motivo es interno y nunca sale en la API pública.
**Eliminar definitivamente:** borra cuenta y PIN y libera el nombre; ideas, comentarios, apoyos y respuestas se conservan como "Cuenta eliminada" para no alterar estadísticas.
**Editar encuestas con respuestas:** se puede corregir texto o añadir opciones; si cambia el tipo o quitas/renombras opciones, se crea una versión nueva y la original se conserva oculta.

## Cambios V1.7
- **Conecta con nosotros:** botones a los perfiles. Los enlaces se pegan en `public/app.js`, en la constante `LINKS` (arriba del archivo). Vacío = botón "Próximamente".
- **Eliminar definitivamente:** borra la cuenta y TODO su historial (ideas con sus comentarios y apoyos, comentarios, apoyos y respuestas). No se puede deshacer.
- **Suspender:** mientras dure, su contenido se oculta y no cuenta en estadísticas; al reactivar vuelve.
- Más palabras en la lista de lenguaje bloqueado.
