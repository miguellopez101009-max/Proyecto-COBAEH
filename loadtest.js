// Prueba de carga básica (sin dependencias, Node 18+).
// Uso:  node loadtest.js [URL] [usuarios]      ej.  node loadtest.js http://localhost:3000 10
// Simula N alumnos AL MISMO TIEMPO (misma IP): registro, inicio de sesión, idea, apoyos, comentarios y encuestas.
// IMPORTANTE: crea usuarios "carga..." de prueba. Úsala con un DATA_FILE de pruebas, no con tus datos reales.
const BASE=(process.argv[2]||'http://localhost:3000').replace(/\/$/,''),N=+process.argv[3]||8,codes={};let maxMs=0,errs=[];
const call=async(m,p,b,s)=>{const t=Date.now();let r,j={};try{r=await fetch(BASE+'/api'+p,{method:m,headers:{'Content-Type':'application/json',...(s?{'x-user-id':s.id,'x-token':s.token}:{})},body:b?JSON.stringify(b):undefined});try{j=await r.json()}catch{}}catch(e){r={status:0};j={error:String(e.message)}}
 const ms=Date.now()-t;maxMs=Math.max(maxMs,ms);codes[r.status]=(codes[r.status]||0)+1;if(r.status!==200)errs.push(`${m} ${p} → ${r.status} ${j.error||''}`);return{s:r.status,j}};
const ok={reg:0,login:0,idea:0,sup:0,com:0,ans:0};
(async()=>{const t0=Date.now(),before=(await call('GET','/state')).j.stats,tag=Date.now().toString(36).slice(-4);
 const st0=(await call('GET','/state')).j,groups=st0.groups,sess=[];
 // Etapa 1 (todos a la vez): registro + login + idea
 await Promise.all(Array.from({length:N},async(_,i)=>{const name=`carga${tag}${i}`,g=groups[i%groups.length],pin=String(1000+i%9000);
  const r=await call('POST','/register',{name,real:'Carga Prueba',group:g,pin});if(r.s!==200)return;ok.reg++;const l=await call('POST','/login',{name,group:g,pin});if(l.s===200)ok.login++;
  const s=l.j;sess[i]={...s};const d=await call('POST','/ideas',{text:`Idea de prueba de carga ${tag} número ${i} para revisar el sistema`},s);if(d.s===200)ok.idea++}));
 // Etapa 2 (todos a la vez): apoyos, comentarios y encuestas
 const st1=(await call('GET','/state')).j,mine=st1.ideas.filter(i=>i.text.includes(`carga ${tag} `));
 await Promise.all(sess.map(async(s,i)=>{if(!s)return;const others=mine.filter(x=>x.name!==s.name);
  for(const k of [0,1,2]){const t=others[(i+k)%others.length];if(t&&(await call('POST',`/ideas/${t.id}/support`,{},s)).s===200)ok.sup++}
  for(const k of [0,1]){const t=others[(i+k+3)%others.length];if(t&&(await call('POST',`/ideas/${t.id}/comments`,{text:`Comentario de prueba ${k} del usuario ${i}`},s)).s===200)ok.com++}
  for(const q of st1.surveys){const b=q.type==='multi'?{options:[q.options[0]]}:{option:q.options[i%q.options.length]};if((await call('POST',`/surveys/${q.id}/answer`,b,s)).s===200)ok.ans++}}));
 const after=(await call('GET','/state')).j.stats,d=(a,b)=>a-b;
 const rows=[['usuarios',ok.reg,d(after.participants,before.participants)],['ideas',ok.idea,d(after.ideas,before.ideas)],['apoyos',ok.sup,d(after.supports,before.supports)],['comentarios',ok.com,d(after.comments,before.comments)],['respuestas de encuesta',ok.ans,d(after.answers,before.answers)]];
 console.log(`\nPrueba con ${N} usuarios simultáneos en ${((Date.now()-t0)/1000).toFixed(1)} s  (respuesta más lenta: ${maxMs} ms)`);console.log('Códigos HTTP:',JSON.stringify(codes));
 let bad=false;for(const [n,a,b] of rows){const good=a===b;if(!good)bad=true;console.log(`  ${n.padEnd(24)} confirmados por el servidor: ${String(a).padEnd(5)} guardados: ${String(b).padEnd(5)} ${good?'OK':'<-- NO COINCIDE (pérdida de datos)'}`)}
 const flagged=Object.keys(codes).filter(c=>c==='429'||c==='0'||+c>=500);if(flagged.length)bad=true;if(errs.length)console.log('Errores:',[...new Set(errs)].slice(0,8));
 console.log(bad?'\nRESULTADO: HAY PROBLEMAS (revisa arriba)':'\nRESULTADO: OK — sin 429, sin errores 500 y sin pérdida de datos');process.exit(bad?1:0)})();
