// Migración segura de datos:  data.json (local) → DATA_FILE (disco)  o  → base de datos Postgres/Neon (--db)
// Uso:  node migrate.js <origen.json> [destino.json]      (destino por defecto: la variable DATA_FILE)
//       node migrate.js <origen.json> [destino.json] --force   (reemplaza el destino, guardando antes una copia .bak-FECHA)
//       node migrate.js <origen.json> --db [--force]            (usa la variable DATABASE_URL)
// Nunca sobrescribe un destino existente sin --force. Detén o reinicia el servidor justo después de migrar.
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),force=args.includes('--force'),[src,dstArg]=args.filter(a=>!a.startsWith('--')),useDb=args.includes('--db'),dst=dstArg||process.env.DATA_FILE;
const die=m=>{console.error('✖ '+m);process.exit(1)};
if(!src)die('Falta el archivo de origen.  Uso: node migrate.js <origen.json> [destino.json] [--force]');
if(!dst&&!useDb)die('No hay destino: pásalo como segundo argumento, define DATA_FILE o usa --db.');
if(!useDb&&path.resolve(src)===path.resolve(dst))die('El origen y el destino son el mismo archivo.');
let raw,j;try{raw=fs.readFileSync(src,'utf8');j=JSON.parse(raw)}catch(e){die(`No se pudo leer ${src} como JSON (${e.message}). No se tocó nada.`)}
if(!j||!Array.isArray(j.users)||!Array.isArray(j.ideas))die('El origen no parece un data.json de esta aplicación (faltan users/ideas). No se tocó nada.');
const count=d=>`usuarios ${d.users.length}, ideas ${d.ideas.length}, comentarios ${(d.comments||[]).length}, respuestas ${(d.answers||[]).length}, actividades ${(d.activities||[]).length}, evidencias ${(d.evidence||[]).length}`;
if(useDb){const url=process.env.DATABASE_URL;if(!url)die('Define la variable DATABASE_URL (la cadena de conexión de Neon).');
 (async()=>{const {Client}=require('pg'),c=new Client({connectionString:url});await c.connect();
  await c.query('CREATE TABLE IF NOT EXISTS app_state(id int PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
  const r=await c.query('SELECT data FROM app_state WHERE id=1');
  if(r.rows[0]){if(!force){await c.end();die(`Ya hay datos en la base (${count(r.rows[0].data)}).\n  No se sobrescribió nada. Para reemplazarlos: node migrate.js ${src} --db --force  (antes se guarda una copia local).`)}
   const bak=`db-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;fs.writeFileSync(bak,JSON.stringify(r.rows[0].data));console.log('Copia de lo que había en la base guardada en '+bak)}
  await c.query('INSERT INTO app_state(id,data,updated_at) VALUES(1,$1::jsonb,now()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',[raw]);await c.end();
  console.log(`✔ Migrado ${src} → base de datos\n  ${count(j)}\n  Reinicia el servicio para que cargue estos datos.`)})().catch(e=>die(e.message));return}
if(fs.existsSync(dst)){let cur='?';try{cur=count(JSON.parse(fs.readFileSync(dst,'utf8')))}catch{}
 if(!force)die(`Ya existe ${dst} (${cur}).\n  No se sobrescribió nada. Si de verdad quieres reemplazarlo: node migrate.js ${src} ${dst} --force  (antes se guarda una copia).`);
 const bak=`${dst}.bak-${new Date().toISOString().replace(/[:.]/g,'-')}`;fs.copyFileSync(dst,bak);console.log('Copia del destino actual guardada en '+bak)}
fs.mkdirSync(path.dirname(dst),{recursive:true});const tmp=dst+'.tmp';fs.writeFileSync(tmp,raw);fs.renameSync(tmp,dst);
console.log(`✔ Migrado ${src} → ${dst}\n  ${count(j)}\n  Reinicia el servicio para que cargue estos datos.`);
