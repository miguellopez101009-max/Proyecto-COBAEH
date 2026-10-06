// Backend sin dependencias. Datos en JSON (DATA_FILE). Admin protegido con ADMIN_KEY (variable de entorno).
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
process.env.UV_THREADPOOL_SIZE=process.env.UV_THREADPOOL_SIZE||'8'; // más hilos para el cifrado de PIN (no bloquea el servidor)
const PORT=process.env.PORT||3000,ADMIN_KEY=process.env.ADMIN_KEY||'',DB=process.env.DATA_FILE||path.join(__dirname,'data.json');
const SEMESTERS=['1','3','5']; // añadir '2','4','6' cuando participen
const OPTIONS=['Áreas verdes','Canchas','Salones','Baños','Pasillos','Otra'];
const DEFAULT_GROUPS=['1101','1102','1103','3101','3102','3103','5101','5102','5103'];
// Palabras bloqueadas base (el filtro es solo del backend). Se amplían desde Administración (db.badWords).
const BAD='puto puta putos putas pendejo pendeja pendejos pendejas pendejada cabron cabrona cabrones chingar chingada chingado chingados chinga chingas chingatumadre verga vergas mierda culero culera culeros culo marica maricon maricones joto jotos idiota idiotas imbecil estupido estupida mamada mamadas mames puneta hijueputa hdp ctm'.split(' ');
let db={users:[],ideas:[],comments:[],evidence:[],albums:[],activities:[],answers:[],badWords:[],stats:{waste_kg:null,areas:null},groups:DEFAULT_GROUPS.slice(),
 surveys:[{id:'s1',question:'¿Qué área del plantel consideras que necesita más atención?',type:'single',options:OPTIONS,hidden:false}]};
if(fs.existsSync(DB)){try{const raw=fs.readFileSync(DB,'utf8');if(raw.trim()){const j=JSON.parse(raw);if(!j.comments)fs.copyFileSync(DB,DB+'.bak-v1'); // respaldo antes de migrar a V1.5
 db=Object.assign(db,j)}}catch(e){console.error('\n✖ No se pudo leer '+DB+' ('+e.message+').\n  Para NO sobrescribir tus datos, el servidor se detiene. Revisa o restaura ese archivo.\n');process.exit(1)}}
db.groups=[...new Set([...(db.groups||[]),...DEFAULT_GROUPS])].sort();
if(db.survey&&!db.answers.length){db.answers=db.survey.map(s=>({...s,surveyId:'s1'}));delete db.survey}
db.comments=db.comments||[];db.badWords=db.badWords||[];db.surveys.forEach(s=>s.type=s.type||'single'); // migración: encuestas antiguas = opción única
try{fs.mkdirSync(path.dirname(DB),{recursive:true})}catch{} // permite DATA_FILE=/data/data.json aunque la carpeta aún no exista
let dirty=false,timer=null; // las escrituras se agrupan (250 ms) y se vacían al apagar el servidor; el archivo se reemplaza de forma atómica
const flush=()=>{if(timer){clearTimeout(timer);timer=null}if(!dirty)return;dirty=false;const j=JSON.stringify(db),t=DB+'.tmp';fs.writeFileSync(t,j);try{fs.renameSync(t,DB)}catch{fs.writeFileSync(DB,j)}};
function storageWarn(){const prod=process.env.RENDER||process.env.NODE_ENV==='production';if(!process.env.DATA_FILE)return prod?'\n  ⚠ DATA_FILE no definido: en un hosting los datos se perderán al reiniciar':'';
 try{if(process.env.RENDER&&fs.statSync(path.dirname(DB)).dev===fs.statSync('/').dev)return '\n  ⚠ '+path.dirname(DB)+' no parece un disco persistente montado: los datos se perderían al reiniciar (revisa Disks → Mount Path)'}catch{}return ''}
const save=()=>{dirty=true;if(!timer)timer=setTimeout(flush,250)};
['SIGTERM','SIGINT'].forEach(g=>process.on(g,()=>{try{flush()}catch{}process.exit(0)}));process.on('exit',()=>{try{flush()}catch{}});
const id=()=>crypto.randomBytes(6).toString('hex'),clean=s=>String(s||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(),squash=w=>w.replace(/(.)\1+/g,'$1');
const LEET={0:'o',1:'i',3:'e',4:'a',5:'s',7:'t','@':'a','$':'s'};
function bad(text){const set=new Set([...BAD,...db.badWords].map(w=>squash(norm(w))));  // coincide por palabra completa
 return norm(text).split(/[^a-z0-9@$]+/).some(t=>t&&(set.has(squash(t))||(/[a-z]/.test(t)&&set.has(squash(t.replace(/[013457@$]/g,c=>LEET[c]))))))}
const LANG='Tu publicación contiene lenguaje no permitido. Modifícala e inténtalo de nuevo.',LINK=/https?:|www\.|\b[\w-]+\.(com|mx|net|org|me|ly|gg)\b/i;
const fails={},RL={};
// Límites (ventana fija). La IP se comparte en una escuela, así que su tope es muy alto: el control real es por usuario y por acción.
const LIM={ipFlood:[3000,6e4],reg:[600,6e4],login:[600,6e4],userWrites:[60,6e4],idea:[3,6e4],support:[30,6e4],survey:[20,6e4]};
const rl=(key,[max,ms])=>{const n=Date.now(),e=RL[key];if(!e||n>e.t+e.ms){RL[key]={n:1,t:n,ms};return false}return ++e.n>max};
const BANMSG='Tu cuenta fue suspendida por el equipo del proyecto. Habla con ellos para resolverlo.';
const TOO_FAST='Vas muy rápido. Espera un momento e inténtalo de nuevo.';
setInterval(()=>{const n=Date.now();for(const k in RL)if(n>RL[k].t+RL[k].ms)delete RL[k];for(const k in fails){fails[k]=fails[k].filter(t=>n-t<6e5);if(!fails[k].length)delete fails[k]}},3e5).unref();
const locked=(k,max=5)=>{const n=Date.now();fails[k]=(fails[k]||[]).filter(t=>n-t<6e5);return fails[k].length>=max};
const ipOf=r=>(r.headers['x-forwarded-for']||r.socket.remoteAddress||'').split(',')[0].trim();
const hashPin=(pin,salt)=>new Promise((ok,no)=>crypto.scrypt(pin,salt,32,(e,k)=>e?no(e):ok(k.toString('hex')))),ukey=u=>norm(u.name)+'|'+u.group; // asíncrono: no congela el servidor con muchos registros
const okPin=async(pin,u)=>{try{return /^\d{4}$/.test(pin)&&crypto.timingSafeEqual(Buffer.from(await hashPin(pin,u.salt),'hex'),Buffer.from(u.pin,'hex'))}catch{return false}};
const session=u=>({id:u.id,token:u.token,name:u.name,group:u.group});
const user=r=>db.users.find(u=>u.id===r.headers['x-user-id']&&u.token===r.headers['x-token']);
const isAdmin=r=>ADMIN_KEY&&r.headers['x-admin-key']===ADMIN_KEY;
class E extends Error{constructor(m,c=400){super(m);this.c=c}}
const https=u=>/^https:\/\/\S+$/.test(u||'');
// Respaldo: todo lo necesario para restaurar. Sin ADMIN_KEY, variables de entorno ni tokens de sesión. Los PIN van solo como hash (pinHash/pinSalt): es un archivo PRIVADO.
const backup=()=>({app:'cuidando-nuestro-cobaeh',backupVersion:1,createdAt:new Date().toISOString(),data:{users:db.users.map(({token,pin,salt,...u})=>({...u,pinHash:pin||null,pinSalt:salt||null})),ideas:db.ideas,comments:db.comments,surveys:db.surveys,answers:db.answers,activities:db.activities,albums:db.albums,evidence:db.evidence,stats:db.stats,groups:db.groups,badWords:db.badWords}});
const answered=s=>new Set(db.answers.filter(a=>a.surveyId===s).map(a=>a.userId));
function state(r){const u=user(r),who=i=>{const x=db.users.find(x=>x.id===i);return x?{name:x.name,group:x.group}:null};
 const ideas=db.ideas.filter(i=>!i.hidden).sort((a,b)=>b.supports.length-a.supports.length||b.date.localeCompare(a.date)).map(i=>({id:i.id,name:i.name,group:i.group,text:i.text,date:i.date,
  supports:i.supports.length,mine:!!u&&i.supports.includes(u.id),supporters:i.supports.map(who).filter(Boolean),
  comments:db.comments.filter(c=>c.ideaId===i.id&&!c.hidden).map(c=>({id:c.id,name:c.name,group:c.group,text:c.text,date:c.date}))}));
 const surveys=db.surveys.filter(s=>!s.hidden).map(s=>{const a=db.answers.filter(x=>x.surveyId===s.id),counts={};a.forEach(x=>counts[x.option]=(counts[x.option]||0)+1);const ppl=answered(s.id);
  return{id:s.id,question:s.question,type:s.type,options:s.options,counts,total:ppl.size,voted:!!u&&ppl.has(u.id),avg:s.type==='scale'&&a.length?Math.round(a.reduce((n,x)=>n+Number(x.option),0)/a.length*10)/10:null}});
 const ev=db.evidence.filter(e=>!e.hidden);
 return{me:u?{hasPin:!!u.pin}:null,groups:db.groups,ideas,surveys,albums:db.albums,activities:db.activities,evidence:ev,
  stats:{participants:db.users.length,ideas:ideas.length,ideasSupported:ideas.filter(i=>i.supports).length,supports:db.ideas.reduce((n,i)=>n+i.supports.length,0),comments:db.comments.filter(c=>!c.hidden).length,
  answers:new Set(db.answers.map(a=>a.surveyId+'|'+a.userId)).size,activities:db.activities.filter(a=>a.status==='Realizada').length,evidence:ev.length,...db.stats}}}
async function route(r,m,p,b){let x;
 if(m==='GET'&&p==='/api/health')return{ok:true,admin:!!ADMIN_KEY};
 if(m==='GET'&&p==='/api/state')return state(r);
 if(m==='POST'&&p==='/api/register'){if(rl('reg|'+ipOf(r),LIM.reg))throw new E('Muchos registros desde esta red. Espera un momento.',429);const name=clean(b.name),real=clean(b.real),g=clean(b.group),pin=String(b.pin||'');
  if(name.length<2||name.length>30)throw new E('El nombre o alias debe tener de 2 a 30 caracteres.');
  if(!db.groups.includes(g))throw new E('Selecciona un grupo de la lista.');
  if(!/^\d{4}$/.test(pin))throw new E('El PIN debe tener exactamente 4 dígitos.');
  if(bad(name))throw new E('El nombre o alias contiene lenguaje no permitido.');
  if(real.length<5||real.length>40||real.split(' ').length<2||!/^[\p{L}][\p{L}\s.'-]*$/u.test(real))throw new E('Escribe tu nombre real y tu primer apellido (solo lo ve el equipo del proyecto).');
  if(bad(real))throw new E('El nombre real contiene lenguaje no permitido.');
  if(db.users.some(x=>x.banned&&x.real&&norm(x.real)===norm(real)&&x.group===g))throw new E('No se puede crear una cuenta con esos datos. Habla con el equipo del proyecto.',403);
  const ex=db.users.find(u=>ukey(u)===norm(name)+'|'+g);
  if(ex)throw new E(ex.pin?'Ya existe una cuenta con ese nombre y grupo. Usa "Iniciar sesión" con tu PIN.':'Esa cuenta ya existe y aún no tiene PIN. Entra desde el dispositivo donde la creaste para protegerla.',409);
  const salt=crypto.randomBytes(8).toString('hex'),ph=await hashPin(pin,salt);
  if(db.users.some(u=>ukey(u)===norm(name)+'|'+g))throw new E('Ya existe una cuenta con ese nombre y grupo. Usa "Iniciar sesión" con tu PIN.',409); // revisa de nuevo tras esperar el cifrado
  const u={id:id(),token:crypto.randomBytes(16).toString('hex'),name,real,group:g,date:new Date().toISOString(),salt,pin:ph};db.users.push(u);save();return session(u)}
 if(m==='POST'&&p==='/api/login'){if(rl('login|'+ipOf(r),LIM.login))throw new E('Muchos intentos desde esta red. Espera un momento.',429);const name=clean(b.name),g=clean(b.group),k=norm(name)+'|'+g,ik='ip|'+ipOf(r);
  if(locked(k)||locked(ik,300))throw new E('Demasiados intentos. Espera 10 minutos.',429);
  const u=db.users.find(u=>ukey(u)===k);
  if(!(u&&u.pin&&await okPin(String(b.pin||''),u))){(fails[k]=fails[k]||[]).push(Date.now());(fails[ik]=fails[ik]||[]).push(Date.now());
   throw new E(u&&!u.pin?'Esa cuenta aún no tiene PIN. Entra desde el dispositivo donde la creaste.':'Nombre, grupo o PIN incorrectos.',403)}
  delete fails[k];if(u.banned)throw new E(BANMSG,403);return session(u)}
 if(p.startsWith('/api/admin/')){const ak='adm|'+ipOf(r);if(locked(ak,10))throw new E('Demasiados intentos de clave. Espera 10 minutos.',429);
  if(!isAdmin(r)){(fails[ak]=fails[ak]||[]).push(Date.now());throw new E(ADMIN_KEY?'Clave incorrecta.':'ADMIN_KEY no está configurada en el servidor.',401)}
  if(m==='GET'&&p==='/api/admin/data')return{users:db.users.map(({token,pin,salt,...u})=>u),ideas:db.ideas.map(i=>({...i,supports:i.supports.length})),
   comments:db.comments.map(c=>({...c,idea:((db.ideas.find(i=>i.id===c.ideaId)||{}).text||'').slice(0,40)})),answers:db.answers,surveys:db.surveys.map(s=>({...s,respondents:answered(s.id).size})),
   evidence:db.evidence,albums:db.albums,activities:db.activities,groups:db.groups,stats:db.stats,badWords:db.badWords};
  if(m==='POST'&&(x=p.match(/^\/api\/admin\/(ideas|evidence|surveys|comments)\/(\w+)\/hide$/))){const it=db[x[1]].find(i=>i.id===x[2]);if(!it)throw new E('No existe',404);it.hidden=!it.hidden;save();return{hidden:it.hidden}}
  if(m==='POST'&&(x=p.match(/^\/api\/admin\/users\/(\w+)\/ban$/))){const it=db.users.find(i=>i.id===x[1]);if(!it)throw new E('No existe',404);it.banned=!it.banned;save();return{banned:it.banned}}
  if(m==='POST'&&p==='/api/admin/stats'){for(const k of['waste_kg','areas']){if(b[k]===''||b[k]==null)db.stats[k]=null;else{const n=Number(b[k]);if(!(n>=0&&n<1e6))throw new E('Valor inválido: '+k);db.stats[k]=n}}save();return db.stats}
  if(m==='POST'&&p==='/api/admin/evidence'){if(!https(b.url))throw new E('La URL debe iniciar con https://');let album='';
   if(b.activity){const a=db.activities.find(a=>a.id===b.activity);if(!a)throw new E('Actividad no encontrada');if(!a.album||!db.albums.some(x=>x.id===a.album)){a.album=id();db.albums.push({id:a.album,name:a.name})}album=a.album}
   else if(db.albums.some(a=>a.id===b.album))album=b.album;
   const e={id:id(),type:b.type==='video'?'video':'foto',desc:clean(b.desc).slice(0,200),date:/^\d{4}-\d\d-\d\d$/.test(b.date)?b.date:new Date().toISOString().slice(0,10),album,url:b.url,thumb:https(b.thumb)?b.thumb:'',hidden:false};db.evidence.push(e);save();return e}
  if(m==='POST'&&p==='/api/admin/activities'){const n=clean(b.name).slice(0,60);if(!n)throw new E('Nombre requerido');let album=db.albums.some(a=>a.id===b.album)?b.album:'';
   if(!album&&(b.auto===true||b.auto==='on'||b.auto==='1')){album=id();db.albums.push({id:album,name:n})}
   db.activities.push({id:id(),name:n,desc:clean(b.desc).slice(0,300),date:clean(b.date).slice(0,30),status:['Planeada','En proceso','Realizada'].includes(b.status)?b.status:'Planeada',album});save();return{ok:1}}
  if(m==='POST'&&p==='/api/admin/surveys'){const q=clean(b.question).slice(0,150),type=['single','yesno','scale','multi'].includes(b.type)?b.type:'single';
   const o=type==='yesno'?['Sí','No']:type==='scale'?['1','2','3','4','5']:String(b.options||'').split('\n').map(clean).filter(Boolean).slice(0,10);
   if(!q)throw new E('Escribe la pregunta.');if(o.length<2)throw new E('Escribe al menos 2 opciones (una por línea).');if(o.some(x=>x.length>60))throw new E('Cada opción debe tener máximo 60 caracteres.');
   if(bad(q)||o.some(bad))throw new E(LANG);db.surveys.push({id:id(),question:q,type,options:o,hidden:false});save();return{ok:1}}
  if(m==='POST'&&p==='/api/admin/groups'){const g=clean(b.group);if(!/^\d{4}$/.test(g)||!SEMESTERS.includes(g[0]))throw new E('Grupo inválido (4 dígitos; semestres '+SEMESTERS.join(', ')+').');if(!db.groups.includes(g))db.groups.push(g);db.groups.sort();save();return{ok:1}}
  if(m==='POST'&&p==='/api/admin/badwords'){const w=norm(b.word);if(!/^[a-z0-9]{2,30}$/.test(w))throw new E('Escribe una sola palabra (2 a 30 letras o números).');if(!db.badWords.includes(w))db.badWords.push(w);save();return{ok:1}}
  if(m==='DELETE'&&(x=p.match(/^\/api\/admin\/badwords\/(\w+)$/))){db.badWords=db.badWords.filter(w=>w!==x[1]);save();return{ok:1}}
  if(m==='DELETE'&&(x=p.match(/^\/api\/admin\/(evidence|albums|activities|comments)\/(\w+)$/))){db[x[1]]=db[x[1]].filter(e=>e.id!==x[2]);save();return{ok:1}}
  throw new E('No existe',404)}
 const u=user(r);if(!u)throw new E('Regístrate o inicia sesión primero en Inicio.',401);
 if(u.banned)throw new E(BANMSG,403);
 if(m==='POST'&&rl('uw|'+u.id,LIM.userWrites))throw new E(TOO_FAST,429);
 if(m==='POST'&&p==='/api/pin'){const pin=String(b.pin||'');if(u.pin)throw new E('Tu cuenta ya tiene PIN.');if(!/^\d{4}$/.test(pin))throw new E('El PIN debe tener exactamente 4 dígitos.');const sl=crypto.randomBytes(8).toString('hex'),ph=await hashPin(pin,sl);if(u.pin)throw new E('Tu cuenta ya tiene PIN.');u.salt=sl;u.pin=ph;save();return{ok:1}}
 if(m==='POST'&&p==='/api/ideas'){if(rl('idea|'+u.id,LIM.idea))throw new E(TOO_FAST,429);const t=clean(b.text);if(t.length<10||t.length>300)throw new E('La idea debe tener de 10 a 300 caracteres.');
  if(LINK.test(t))throw new E('No se permiten enlaces en las ideas.');if(/(.)\1{9,}/.test(t))throw new E('Texto inválido.');if(bad(t))throw new E(LANG);
  if(db.ideas.some(i=>i.userId===u.id&&i.text===t))throw new E('Ya enviaste esa idea.');
  if(db.ideas.filter(i=>i.userId===u.id).length>=5)throw new E('Máximo 5 ideas por usuario.');
  db.ideas.push({id:id(),userId:u.id,name:u.name,group:u.group,text:t,date:new Date().toISOString(),supports:[],hidden:false});save();return{ok:1}}
 if(m==='POST'&&(x=p.match(/^\/api\/ideas\/(\w+)\/comments$/))){const i=db.ideas.find(i=>i.id===x[1]&&!i.hidden);if(!i)throw new E('No existe',404);const t=clean(b.text);
  if(t.length<2||t.length>250)throw new E('El comentario debe tener de 2 a 250 caracteres.');if(LINK.test(t))throw new E('No se permiten enlaces en los comentarios.');if(/(.)\1{9,}/.test(t))throw new E('Texto inválido.');if(bad(t))throw new E(LANG);
  const mine=db.comments.filter(c=>c.userId===u.id),now=Date.now();
  if(mine.filter(c=>now-new Date(c.date)<6e4).length>=3)throw new E('Vas muy rápido. Espera un momento para comentar de nuevo.',429);
  if(mine.some(c=>c.ideaId===i.id&&c.text===t))throw new E('Ya enviaste ese comentario.');
  db.comments.push({id:id(),ideaId:i.id,userId:u.id,name:u.name,group:u.group,text:t,date:new Date().toISOString(),hidden:false});save();return{ok:1}}
 if(m==='POST'&&(x=p.match(/^\/api\/ideas\/(\w+)\/support$/))){if(rl('sup|'+u.id,LIM.support))throw new E(TOO_FAST,429);const i=db.ideas.find(i=>i.id===x[1]&&!i.hidden);if(!i)throw new E('No existe',404);
  if(i.userId===u.id)throw new E('No puedes apoyar tu propia idea.');if(i.supports.includes(u.id))throw new E('Ya apoyaste esta idea.');i.supports.push(u.id);save();return{ok:1}}
 if(m==='POST'&&(x=p.match(/^\/api\/surveys\/(\w+)\/answer$/)||(p==='/api/survey'&&['','s1']))){if(rl('svy|'+u.id,LIM.survey))throw new E(TOO_FAST,429);const sid=x[1]||'s1',s=db.surveys.find(s=>s.id===sid&&!s.hidden);if(!s)throw new E('Encuesta no disponible',404);
  const picks=s.type==='multi'?[...new Set(Array.isArray(b.options)?b.options:[])]:[b.option];
  if(!picks.length||!picks.every(o=>s.options.includes(o)))throw new E('Opción inválida.');
  if(answered(sid).has(u.id))throw new E('Ya respondiste esta encuesta.');
  const d=new Date().toISOString();picks.forEach(o=>db.answers.push({surveyId:sid,userId:u.id,name:u.name,group:u.group,option:o,date:d}));save();return{ok:1}}
 throw new E('No existe',404)}
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res)=>{const url=new URL(req.url,'http://x'),p=url.pathname;
 const send=(c,o,h={})=>{res.writeHead(c,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff',...h});res.end(JSON.stringify(o))};
 if(p==='/health')return send(200,{ok:true},{'Cache-Control':'no-store'});
 if(p==='/api/admin/backup'&&req.method==='GET'){const ak='adm|'+ipOf(req);if(locked(ak,10))return send(429,{error:'Demasiados intentos de clave. Espera 10 minutos.'});
  if(!isAdmin(req)){(fails[ak]=fails[ak]||[]).push(Date.now());return send(401,{error:ADMIN_KEY?'Clave incorrecta.':'ADMIN_KEY no está configurada en el servidor.'})}
  const n=new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');return send(200,backup(),{'Content-Disposition':`attachment; filename="backup-${n}.json"`,'Cache-Control':'no-store'})}
 if(p.startsWith('/api/')){let raw='';req.on('data',d=>{raw+=d;if(raw.length>1e4)req.destroy()});
  req.on('end',async()=>{try{if(req.method!=='GET'&&rl('ip|'+ipOf(req),LIM.ipFlood))throw new E('Demasiadas solicitudes desde esta red. Espera un momento.',429);
   send(200,await route(req,req.method,p,raw?JSON.parse(raw):{}),{'Cache-Control':'no-store'})}catch(e){send(e.c||400,{error:e instanceof E?e.message:'Solicitud inválida'})}});return}
 const f=path.join(__dirname,'public',p==='/'?'index.html':path.normalize(p).replace(/^(\.\.[\/\\])+/,''));
 if(!f.startsWith(path.join(__dirname,'public')))return send(403,{});
 fs.readFile(f,(e,d)=>e?send(404,{error:'No encontrado'}):(res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'}),res.end(d)))
}).listen(PORT,'0.0.0.0',()=>{const ips=Object.values(require('os').networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>'http://'+i.address+':'+PORT);
 console.log('\nCOBAEH listo.\n  En esta computadora: http://localhost:'+PORT+'\n  En el celular (mismo Wi-Fi): '+(ips.join('  |  ')||'(no se detectó red)')+'\n'+'  Datos: '+DB+storageWarn()+'\n'+(ADMIN_KEY?'  Administración: activa':'  ⚠ Define ADMIN_KEY para activar Administración')+'\n')});
