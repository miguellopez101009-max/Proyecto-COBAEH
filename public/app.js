const $=s=>document.querySelector(s),H=(t,a={},...c)=>{const e=document.createElement(t);for(const k in a)k in e?e[k]=a[k]:e.setAttribute(k,a[k]);e.append(...c);return e};
const S=['inicio','proyecto','actividades','participa'],X=['admin','info','futuro'],L={inicio:'Inicio',proyecto:'Proyecto',actividades:'Actividades y evidencias',participa:'Participa'};
let me=JSON.parse(localStorage.pecUser||'null'),st=null,AK=sessionStorage.ak||'';
async function api(p,m='GET',b,admin){const h={'Content-Type':'application/json'};if(me){h['x-user-id']=me.id;h['x-token']=me.token}if(admin)h['x-admin-key']=AK;let r,j;
 try{r=await fetch('/api'+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined})}catch{throw new Error('No se pudo conectar con el servidor. Revisa tu internet o que el servicio esté activo (en Render gratis puede tardar ~1 min en despertar).')}
 try{j=await r.json()}catch{throw new Error('El servidor no devolvió datos válidos. ¿La página está en un hosting sin el backend (server.js)?')}
 if(r.status===401&&me&&!admin&&!p.startsWith('/admin')){me=null;delete localStorage.pecUser;if(st)draw();throw new Error('Tu registro ya no es válido (el servidor se reinició). Regístrate de nuevo en Participa.')}
 if(!r.ok)throw new Error(j.error||'Error');return j}
const msg=(id,t,ok)=>{const e=$(id);if(e){e.textContent=t;e.className='msg '+(ok?'k':'e')}};
const fd=d=>new Date(d.length===10?d+'T12:00':d).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
const SEC={ideas:'participa',encuestas:'participa',resultados:'participa',evidencias:'actividades'},ALL=S.concat(X);let tab='ideas';const open=new Set(),showRes=new Set(),supOpen=new Set(),comOpen=new Set();
const nav=$('#nav');S.forEach(s=>nav.append(H('a',{href:'#'+s,id:'n-'+s,textContent:L[s]})));
$('#mb').onclick=e=>{e.stopPropagation();$('#mn').classList.toggle('open')};document.addEventListener('click',()=>$('#mn').classList.remove('open'));
function go(){let h=location.hash.slice(1);if(['ideas','encuestas','resultados'].includes(h))tab=h;h=SEC[h]||h;const s=ALL.includes(h)?h:'inicio';ALL.forEach(x=>$('#'+x).classList.toggle('on',x===s));S.forEach(x=>$('#n-'+x).classList.toggle('on',x===s));$('#mn').classList.remove('open');scrollTo(0,0);
 if(s==='admin')adminInit();else load()}
async function load(){try{st=await api('/state');$('#net').className='msg';draw()}catch(e){msg('#net',e.message)}}
const alb=id=>(st.albums.find(a=>a.id===id)||{}).name;
const av=n=>{const h=[...n].reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7),hue=[140,95,45,200,170,25][Math.abs(h)%6];return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="hsl(${hue} 38% 28%)"/><circle cx="20" cy="15" r="6.5" fill="#e8f1ea"/><path d="M7 42c0-9 5.8-14 13-14s13 5 13 14z" fill="#e8f1ea"/></svg>`};
const ago=d=>{const s=(Date.now()-new Date(d))/1e3;return s<60?'hace un momento':s<3600?'hace '+Math.floor(s/60)+' min':s<86400?'hace '+Math.floor(s/3600)+' h':fd(d)};
const ico=n=>{const r=[['limpie','🧹'],['verde','🌳'],['conferen','🎤'],['recicl','♻️'],['folleto','📄'],['video','🎬']].find(([k])=>n.toLowerCase().includes(k));return r?r[1]:'📌'};
function evCard(e){const yt=(e.url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/)||[])[1],th=e.thumb||(yt?`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`:''),src=e.type==='foto'?(e.thumb||e.url):th;
 const thumb=()=>[src?H('img',{src,alt:e.desc||'Evidencia',loading:'lazy',decoding:'async',onerror(){this.replaceWith(document.createTextNode(e.type==='video'?'Video':'Imagen no disponible'))}}):'Video',...(e.type==='video'?[H('span',{className:'play'},'▶')]:[])];
 const box=H('div',{className:'ph',role:'button',tabIndex:0,'aria-label':e.type==='video'?'Reproducir video':'Abrir foto'},...thumb()),cb=H('button',{className:'sm o',type:'button',textContent:'✕ Cerrar video',style:'display:none;margin-bottom:8px'});
 cb.onclick=()=>{box.style.aspectRatio='';box.replaceChildren(...thumb());cb.style.display='none'}; // descarga el iframe y vuelve a la miniatura
 box.onclick=()=>{if(e.type==='foto'||!yt)return window.open(e.url,'_blank','noopener');if(cb.style.display==='')return;box.style.aspectRatio='16/9';
  box.replaceChildren(H('iframe',{src:`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0`,allow:'autoplay;encrypted-media;fullscreen;picture-in-picture',allowFullscreen:true,title:e.desc||'Video'}));cb.style.display=''};
 box.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();box.onclick()}};
 return H('div',{className:'card'},box,cb,H('p',{},e.desc||'Sin descripción'),H('p',{className:'m'},(e.type==='video'?'🎬 ':'📷 ')+fd(e.date)))}
function albumCard(key,icon,title,date,desc,status,list){const ph=list.filter(e=>e.type==='foto').length,vd=list.length-ph,body=H('div',{style:'margin-top:10px'}),btn=H('button',{className:'sm o'});
 const fill=()=>{const o=open.has(key);btn.textContent=o?'Ocultar evidencias':'Ver evidencias';body.replaceChildren(...(o?[H('div',{className:'grid'},...list.map(evCard))]:[]))};btn.onclick=()=>{open.has(key)?open.delete(key):open.add(key);fill()};fill();
 return H('div',{className:'card'},...(status?[H('span',{className:'tag'},status)]:[]),H('h3',{},icon+' '+title),...(date?[H('p',{className:'m',style:'margin:0 0 6px'},'📅 '+date)]:[]),...(desc?[H('p',{style:'margin:0 0 8px'},desc)]:[]),
  ...(list.length?[H('p',{style:'margin:0 0 6px'},...(ph?[H('span',{className:'chip'},'📷 '+ph+(ph>1?' fotos':' foto'))]:[]),...(vd?[H('span',{className:'chip'},'🎬 '+vd+(vd>1?' videos':' video'))]:[])),btn,body]:[H('p',{className:'m',style:'margin:0'},'Las evidencias aparecerán aquí conforme avance el proyecto.')]))}
function drawGroups(l){$('#gb').replaceChildren(...l.map(g=>{const b=H('button',{type:'button',textContent:g,className:$('#g').value===g?'sel':'o'});b.onclick=()=>{$('#g').value=g;drawGroups(l)};return b}))}
function ideaCard(i){const sb=H('button',{className:'sm o',textContent:i.mine?'❤️ Apoyada':'🤍 Apoyar',disabled:i.mine}),
 sn=H('button',{className:'link',textContent:i.supports+(i.supports===1?' apoyo':' apoyos'),disabled:!i.supports}),cn=H('button',{className:'link',textContent:'💬 '+i.comments.length+(i.comments.length===1?' comentario':' comentarios')});
 sb.onclick=async()=>{try{await api('/ideas/'+i.id+'/support','POST');load()}catch(e){msg('#im',e.message)}};
 sn.onclick=()=>{supOpen.has(i.id)?supOpen.delete(i.id):supOpen.add(i.id);draw()};cn.onclick=()=>{comOpen.has(i.id)?comOpen.delete(i.id):comOpen.add(i.id);draw()};const ex=[];
 if(supOpen.has(i.id)&&i.supporters.length)ex.push(H('div',{className:'sub'},H('b',{},'Apoyaron'),H('div',{className:'m'},i.supporters.map(s=>s.name+' · '+s.group).join(', '))));
 if(comOpen.has(i.id)){const inp=H('input',{maxLength:250,placeholder:'Escribe un comentario…',autocomplete:'off',style:'margin:0;flex:1;min-width:0'}),bt=H('button',{className:'sm',textContent:'Comentar'}),er=H('div',{className:'msg'});
  bt.onclick=async()=>{try{await api('/ideas/'+i.id+'/comments','POST',{text:inp.value});load()}catch(e){er.textContent=e.message;er.className='msg e'}};
  ex.push(H('div',{className:'sub'},...(i.comments.length?i.comments.map(c=>H('div',{className:'post cm'},H('span',{className:'av s',innerHTML:av(c.name)}),H('div',{},H('div',{},H('b',{},c.name),' · '+c.group+' · ',H('span',{className:'m'},ago(c.date))),H('div',{},c.text)))):[H('p',{className:'m'},'Sé el primero en comentar.')]),H('div',{style:'display:flex;gap:8px'},inp,bt),er))}
 return H('div',{className:'card'},H('div',{className:'post'},H('span',{className:'av s',innerHTML:av(i.name)}),H('div',{},H('div',{},H('b',{},i.name),' · '+i.group),H('div',{className:'m'},ago(i.date)))),H('p',{style:'margin:8px 0'},'💡 “'+i.text+'”'),H('div',{className:'row',style:'align-items:center;gap:2px'},sb,sn,cn),...ex)}
function surveyCard(q){const res=q.voted||showRes.has(q.id),send=async body=>{try{await api('/surveys/'+q.id+'/answer','POST',body);msg('#sm','Respuesta registrada.',1);load()}catch(e){msg('#sm',e.message)}};let ui=[];
 if(!q.voted){if(q.type==='multi'){const ch=new Set(),bs=q.options.map(o=>{const b=H('button',{className:'o',type:'button',style:'width:100%;margin:4px 0',textContent:o});b.onclick=()=>{ch.has(o)?ch.delete(o):ch.add(o);b.className=ch.has(o)?'sel':'o'};return b}),go=H('button',{textContent:'Enviar respuesta',style:'width:100%;margin-top:6px'});go.onclick=()=>ch.size?send({options:[...ch]}):msg('#sm','Elige al menos una opción.');ui=[H('p',{className:'m',style:'margin:0'},'Puedes elegir varias opciones.'),...bs,go]}
  else if(q.type==='scale')ui=[H('div',{className:'scale'},...q.options.map(o=>{const b=H('button',{className:'o',textContent:o});b.onclick=()=>send({option:o});return b})),H('p',{className:'m'},'1 = nada · 5 = muchísimo')];
  else ui=q.options.map(o=>{const b=H('button',{className:'o',style:'width:100%;margin:4px 0',textContent:o});b.onclick=()=>send({option:o});return b});
  if(!res){const t=H('button',{className:'link',textContent:'Ver resultados'});t.onclick=()=>{showRes.add(q.id);draw()};ui.push(t)}}
 const bars=q.options.map(o=>{const n=q.counts[o]||0,p=q.total?Math.round(n*100/q.total):0;return H('div',{},H('div',{className:'row',style:'justify-content:space-between'},H('span',{},o),H('b',{},p+'% ('+n+')')),H('div',{className:'bar2'},H('i',{style:'width:'+p+'%'})))});
 return H('div',{className:'card'},H('h3',{},'📊 '+q.question),...(q.voted?[H('p',{className:'ok2'},'✔ Respuesta registrada.')]:[]),...ui,...(res?[H('p',{className:'m'},q.total+(q.total===1?' participante':' participantes')+(q.avg!=null?' · promedio '+q.avg+' / 5':'')+(q.type==='multi'?' · varias respuestas por persona':'')),...bars]:[]))}
function draw(){if(me&&!st.me){me=null;delete localStorage.pecUser}$('#pinset').style.display=me&&st.me&&!st.me.hasPin?'':'none';drawGroups(st.groups);
 $('#reg').style.display=me?'none':'';$('#in').style.display=me?'':'none';if(me){$('#me').textContent=me.name;$('#mg').textContent=me.group;$('#av').innerHTML=av(me.name)}$('#pnote').style.display=me?'none':'';
 const used=new Set(st.activities.map(a=>a.album).filter(Boolean)),loose=st.evidence.filter(e=>!e.album||!st.albums.some(a=>a.id===e.album));
 const cards=[...st.activities.map(a=>albumCard('a'+a.id,ico(a.name),a.name,a.date,a.desc,a.status,st.evidence.filter(e=>a.album&&e.album===a.album))),
  ...st.albums.filter(a=>!used.has(a.id)).map(a=>albumCard('b'+a.id,'📁',a.name,'','','',st.evidence.filter(e=>e.album===a.id))),...(loose.length?[albumCard('loose','📁','Otras evidencias','','','',loose)]:[])];
 $('#acts').replaceChildren(...(cards.length?cards:[H('div',{className:'card'},'Las actividades aparecerán aquí conforme avance nuestro proyecto.')]));
 $('#tabs').querySelectorAll('button').forEach(b=>b.className=b.dataset.t===tab?'':'o');['ideas','encuestas','resultados'].forEach(t=>$('#p-'+t).style.display=t===tab?'':'none');
 $('#il').replaceChildren(...(st.ideas.length?st.ideas.map(ideaCard):[H('p',{className:'m'},'Aún no hay ideas. ¡Sé el primero en compartir una!')]));
 $('#sv').replaceChildren(...(st.surveys.length?st.surveys.map(surveyCard):[H('div',{className:'card'},'No hay encuestas activas por ahora.')]));
 const s=st.stats,cs=[['Participantes',s.participants],['Ideas recibidas',s.ideas],['Apoyos',s.supports],['Comentarios',s.comments],['Encuestas respondidas',s.answers],['Actividades realizadas',s.activities],['Evidencias registradas',s.evidence]];
 if(s.waste_kg!=null)cs.push(['Residuos recolectados (kg)',s.waste_kg]);if(s.areas!=null)cs.push(['Áreas atendidas',s.areas]);
 $('#rs').replaceChildren(...cs.map(([k,x])=>H('div',{className:'card'},H('div',{className:'stat'},String(x)),H('div',{className:'m'},k))));
 $('#rn').textContent=s.waste_kg==null&&s.areas==null?'Residuos recolectados y áreas atendidas: Sin datos registrados todavía.':''}
$('#tabs').onclick=e=>{const t=e.target.dataset&&e.target.dataset.t;if(t){tab=t;if(st)draw()}};
$('#ish').onclick=()=>{const f=$('#iform');f.style.display=f.style.display==='none'?'':'none'};
let mode='new';const clr=id=>$(id).className='msg';
function drawMode(){const n=mode==='new';$('#rb').textContent=n?'Crear cuenta':'Iniciar sesión';$('#rt').textContent=n?'¿Ya tienes una cuenta? Iniciar sesión':'¿Eres nuevo? Crear cuenta';$('#realw').style.display=n?'':'none';$('#rh').textContent=n?'Crea tu cuenta con alias, nombre real, grupo y un PIN de 4 dígitos.':'Escribe tu alias, grupo y PIN.';$('#pin').autocomplete=n?'new-password':'current-password'}
$('#rt').onclick=()=>{mode=mode==='new'?'in':'new';drawMode();clr('#rm')};drawMode();
$('#rb').onclick=async()=>{try{me=await api(mode==='new'?'/register':'/login','POST',{name:$('#n').value,real:$('#real').value,group:$('#g').value,pin:$('#pin').value});$('#pin').value='';$('#real').value='';localStorage.pecUser=JSON.stringify(me);clr('#rm');await load()}catch(e){msg('#rm',e.message)}};
$('#pb').onclick=async()=>{try{await api('/pin','POST',{pin:$('#pin2').value});$('#pin2').value='';msg('#pm','PIN guardado.',1);load()}catch(e){msg('#pm',e.message)}};
$('#out').onclick=()=>{me=null;delete localStorage.pecUser;if(st)draw()};
$('#ib').onclick=async()=>{try{await api('/ideas','POST',{text:$('#it').value});$('#it').value='';$('#iform').style.display='none';msg('#im','¡Idea publicada!',1);load()}catch(e){msg('#im',e.message)}};
// Buscador: contenido estático (Inicio, Proyecto, Información) + actividades, álbumes, evidencias, ideas, comentarios y encuestas. No incluye datos de usuarios.
const nz=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),ST=[];
[['#proyecto .card','Proyecto','proyecto'],['#info .card','Información','info'],['#inicio .hero','Inicio','inicio']].forEach(([q,l,h])=>document.querySelectorAll(q).forEach(c=>ST.push([l,((c.querySelector('h3,h1')||{}).textContent||'').trim(),h,(((c.closest('section').querySelector('h2')||{}).textContent||'')+' '+c.textContent).replace(/\s+/g,' ').trim()])));
let tm;$('#q').oninput=()=>{clearTimeout(tm);tm=setTimeout(async()=>{const q=nz($('#q').value.trim()),b=$('#sres');if(q.length<2){b.style.display='none';return}if(!st)await load();
 const r=ST.filter(x=>nz(x[3]).includes(q)),add=(l,t,h)=>t&&nz(t).includes(q)&&r.push([l,'',h,t.replace(/\s+/g,' ').trim()]);
 if(st){st.activities.forEach(a=>add('Actividad',a.name+' — '+(a.desc||''),'actividades'));st.albums.forEach(a=>add('Álbum',a.name,'actividades'));st.evidence.forEach(e=>add('Evidencia',(e.desc||'')+' '+(alb(e.album)||''),'actividades'));
  st.ideas.forEach(i=>{add('Idea',i.text,'ideas');i.comments.forEach(c=>add('Comentario',c.text,'ideas'))});st.surveys.forEach(s=>add('Encuesta',s.question,'encuestas'))}
 b.replaceChildren(...(r.length?r.slice(0,8).map(([l,t,h,x])=>{const k=Math.max(0,nz(x).indexOf(q)-15),a=H('a',{href:'#'+h},H('b',{},l+': '),(t?t+' — ':'')+x.slice(k,k+70));a.onclick=()=>{b.style.display='none';$('#q').value=''};return a}):[H('p',{className:'m'},'Sin resultados.')]));b.style.display='block'},200)};
// Administración
async function adminInit(){try{const h=await api('/health');$('#hl').textContent=h.admin?'✅ Servidor conectado.':'⚠️ Servidor conectado, pero falta configurar ADMIN_KEY.'}catch(e){$('#hl').textContent='❌ '+e.message}if(AK)admin()}
$('#ab').onclick=()=>{AK=$('#ak').value;sessionStorage.ak=AK;admin()};
function form(fs,txt,fn){const f=H('form',{},...fs.flatMap(([n,l,t,o])=>t==='check'?[H('label',{className:'chk'},H('input',{name:n,type:'checkbox',checked:true}),l)]:[H('label',{},l),t==='select'?H('select',{name:n},...o.map(x=>H('option',{value:x[0]},x[1]))):t==='area'?H('textarea',{name:n,rows:3}):H('input',{name:n,type:t||'text'})]),H('button',{type:'submit',textContent:txt}));
 f.onsubmit=async e=>{e.preventDefault();try{await fn(Object.fromEntries(new FormData(f)));admin()}catch(x){msg('#am2',x.message);$('#am2').scrollIntoView({block:'center'})}};return f}
async function admin(){try{const d=await api('/admin/data','GET',null,1);$('#ag').style.display='none';const p=$('#ap');p.style.display='';
 const tb=(h,rows)=>H('div',{className:'tw'},H('table',{},H('tr',{},...h.map(x=>H('th',{},x))),...rows.map(r=>H('tr',{},...r.map(c=>H('td',{},c))))));
 const ab=(t,path,m='POST')=>{const b=H('button',{className:'sm o',textContent:t});b.onclick=async()=>{if(m==='DELETE'&&!confirm('¿Borrar?'))return;try{await api(path,m,null,1);admin()}catch(x){msg('#am2',x.message)}};return b};
 const rn=id=>{const r=(d.users.find(u=>u.id===id)||{}).real;return r?' ('+r+')':''},hd=(it,kind)=>ab(it.hidden?'Mostrar':'Ocultar','/admin/'+kind+'/'+it.id+'/hide'),TY={single:'Opción única',yesno:'Sí / No',scale:'Escala 1–5',multi:'Selección múltiple'};
 const A=[['','Ninguno']].concat(d.albums.map(a=>[a.id,a.name])),ACT=[['','Otras evidencias (sin actividad)']].concat(d.activities.map(a=>[a.id,a.name]));
 const actOf=e=>{const a=d.activities.find(a=>a.album&&a.album===e.album);return a?a.name:((d.albums.find(x=>x.id===e.album)||{}).name||'Otras evidencias')};
 const sq=H('input',{name:'question'}),stp=H('select',{},...Object.entries(TY).map(([v,l])=>H('option',{value:v},l))),so=H('textarea',{rows:4,placeholder:'Una opción por línea'}),sh=H('p',{className:'m'}),sbt=H('button',{type:'button',textContent:'Crear encuesta'});
 const upd=()=>{const t=stp.value;so.style.display=t==='single'||t==='multi'?'':'none';sh.textContent=t==='yesno'?'Se generarán automáticamente las opciones Sí y No.':t==='scale'?'Se generará la escala 1, 2, 3, 4, 5.':t==='multi'?'Una opción por línea. El alumno podrá elegir varias.':'Una opción por línea. El alumno elegirá una.'};stp.onchange=upd;upd();
 sbt.onclick=async()=>{try{await api('/admin/surveys','POST',{question:sq.value,type:stp.value,options:so.value},1);admin()}catch(x){msg('#am2',x.message);$('#am2').scrollIntoView({block:'center'})}};
 const bk=H('button',{textContent:'Descargar respaldo'});bk.onclick=async()=>{try{const r=await fetch('/api/admin/backup',{headers:{'x-admin-key':AK}});if(!r.ok){const e=await r.json();throw new Error(e.error||'Error')}
   const n=(/filename="([^"]+)"/.exec(r.headers.get('content-disposition')||'')||[])[1]||'backup.json',a=H('a',{href:URL.createObjectURL(await r.blob()),download:n});document.body.append(a);a.click();a.remove();msg('#am2','Respaldo descargado: '+n,1)}catch(x){msg('#am2',x.message)}};
 p.replaceChildren(H('div',{className:'msg',id:'am2'}),H('h3',{},'Respaldo de datos'),H('p',{className:'m'},'Copia de usuarios, ideas, comentarios, encuestas, actividades y evidencias. Es un archivo privado: no lo subas a GitHub ni lo compartas.'),bk,
  H('h3',{},'Ideas ('+d.ideas.length+')'),tb(['Autor','Idea','Apoyos',''],d.ideas.map(i=>[i.name+rn(i.userId)+' '+i.group,i.text+(i.hidden?' [OCULTA]':''),String(i.supports),hd(i,'ideas')])),
  H('h3',{},'Comentarios ('+d.comments.length+')'),tb(['Autor','Comentario',''],d.comments.map(c=>[c.name+rn(c.userId)+' '+c.group,c.text+(c.hidden?' [OCULTO]':'')+' — en: '+c.idea,H('div',{},hd(c,'comments'),ab('Borrar','/admin/comments/'+c.id,'DELETE'))])),
  H('h3',{},'Actividades'),form([['name','Nombre'],['desc','Descripción','area'],['date','Fecha (texto)'],['status','Estado','select',['Planeada','En proceso','Realizada'].map(x=>[x,x])],['album','Usar un álbum que ya existe (opcional)','select',A],['auto','Crear álbum automáticamente con el nombre de la actividad','check']],'Agregar actividad',b=>api('/admin/activities','POST',b,1)),
  tb(['Actividad','Estado','Álbum',''],d.activities.map(a=>[a.name,a.status,(d.albums.find(x=>x.id===a.album)||{}).name||'—',ab('Borrar','/admin/activities/'+a.id,'DELETE')])),
  H('h3',{},'Agregar evidencia'),H('p',{className:'m'},'Las fotos deben estar optimizadas para web. Los videos se recomiendan mediante enlaces de YouTube para evitar archivos pesados.'),
  form([['activity','¿A qué actividad pertenece?','select',ACT],['type','Tipo','select',[['foto','Foto'],['video','Video']]],['url','URL https:// (foto o enlace de YouTube)'],['thumb','Miniatura https:// (opcional, para video)'],['desc','Descripción (opcional)'],['date','Fecha','date']],'Agregar evidencia',b=>api('/admin/evidence','POST',b,1)),
  tb(['Evidencia','Actividad',''],d.evidence.map(e=>[e.type+': '+(e.desc||e.url.slice(0,30))+(e.hidden?' [OCULTA]':''),actOf(e),H('div',{},hd(e,'evidence'),ab('Borrar','/admin/evidence/'+e.id,'DELETE'))])),
  H('h3',{},'Álbumes (se crean con cada actividad)'),tb(['Álbum',''],d.albums.map(a=>[a.name,ab('Borrar','/admin/albums/'+a.id,'DELETE')])),
  H('h3',{},'Nueva encuesta'),H('div',{className:'card'},H('label',{},'Pregunta'),sq,H('label',{},'Tipo'),stp,so,sh,sbt),
  H('h3',{},'Encuestas existentes'),tb(['Pregunta','Tipo','Respuestas','Estado',''],d.surveys.map(s=>[s.question,TY[s.type]||'Opción única',String(s.respondents),s.hidden?'Oculta':'Visible',hd(s,'surveys')])),
  H('h3',{},'Estadísticas físicas (vacío = sin datos)'),form([['waste_kg','Residuos recolectados (kg)','number'],['areas','Áreas atendidas','number']],'Guardar',b=>api('/admin/stats','POST',b,1)),
  H('h3',{},'Grupos: '+d.groups.join(', ')),form([['group','Agregar grupo (ej. 3104)']],'Agregar grupo',b=>api('/admin/groups','POST',b,1)),
  H('h3',{},'Lenguaje bloqueado'),H('p',{className:'m'},'La lista base vive en el servidor. Aquí puedes añadir palabras extra (toca una para quitarla).'),H('div',{},...d.badWords.map(w=>ab(w+' ✕','/admin/badwords/'+w,'DELETE'))),form([['word','Palabra a bloquear']],'Añadir palabra',b=>api('/admin/badwords','POST',b,1)),
  H('h3',{},'Usuarios ('+d.users.length+')'),H('p',{className:'m'},'El nombre real solo se ve aquí. Bloquear a un usuario le impide iniciar sesión, publicar, comentar, apoyar y votar, y evita que cree otra cuenta con el mismo nombre real y grupo. Se puede revertir.'),
  tb(['Alias','Nombre real','Grupo','Ideas','Comentarios','Estado'],d.users.map(u=>{const mi=d.ideas.filter(i=>i.userId===u.id),mc=d.comments.filter(c=>c.userId===u.id);
   return[u.name,u.real||'—',u.group,String(mi.length),String(mc.length),H('div',{},H('span',{},u.banned?'🚫 Bloqueado ':'Activo '),ab(u.banned?'Desbloquear':'Bloquear','/admin/users/'+u.id+'/ban'),
    H('details',{},H('summary',{},'Historial'),...(mi.length||mc.length?[...mi.map(i=>H('p',{className:'m'},'💡 '+i.text+(i.hidden?' [OCULTA]':''))),...mc.map(c=>H('p',{className:'m'},'💬 '+c.text+(c.hidden?' [OCULTO]':'')))]:[H('p',{className:'m'},'Sin actividad.')])))]})))
 }catch(e){$('#ag').style.display='';msg('#am',e.message)}}
const hdr=$('header');function seen(el){const vh=window.visualViewport?visualViewport.height:innerHeight,top=hdr.offsetHeight+10,r=el.getBoundingClientRect();if(r.top<top||r.bottom>vh-12)scrollBy({top:r.top-top-Math.max(0,(vh-top-r.height)/3)})}
document.addEventListener('focusin',e=>{if(e.target.matches('input:not([type=hidden]),textarea')){document.body.classList.add('kb');if(!e.target.closest('header'))setTimeout(()=>seen(e.target),350)}});
document.addEventListener('focusout',()=>setTimeout(()=>{if(!document.activeElement||!document.activeElement.matches('input,textarea'))document.body.classList.remove('kb')},200));
drawGroups(['1101','1102','1103','3101','3102','3103','5101','5102','5103']); // se muestran aunque el servidor tarde
addEventListener('hashchange',go);go();
