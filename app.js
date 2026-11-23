'use strict';
const $=id=>document.getElementById(id);
const state={mode:'guardia',date:'',raw:[],items:[],position:null,map:null,markers:[],userMarker:null,loadNumber:0,counts:{},mapReady:false,cache:new Map(),currentCacheKey:'',lastLocalDate:''};
const els={status:$('status'),list:$('list'),heading:$('heading'),count:$('count'),search:$('search'),date:$('fecha')};
const safeText=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const val=(o,...keys)=>{for(const key of keys){if(o && o[key]!==undefined && o[key]!==null && String(o[key]).trim()!=='')return o[key];}return '';};
function entries(body){if(Array.isArray(body))return body; if(!body||typeof body!=='object')return [];for(const k of ['result','results','items','features','data','datos','farmacias','records','entries']){const value=body[k];if(Array.isArray(value))return value;if(value&&typeof value==='object'){const nested=entries(value);if(nested.length)return nested;}}return []}
function coords(o){let lat=Number(val(o,'latitud','latitude','lat')),lng=Number(val(o,'longitud','longitude','lon','lng'));const g=o.geometry||o.geojson;const pos=g?.coordinates;if(Array.isArray(pos)&&pos.length>1){lng=Number(pos[0]);lat=Number(pos[1]);}const ll=o.coordinates;if(Array.isArray(ll)&&ll.length>1){if(Math.abs(Number(ll[0]))<15){lng=Number(ll[0]);lat=Number(ll[1]);}else{lat=Number(ll[0]);lng=Number(ll[1]);}}if(lat>=40&&lat<=43&&lng>=-2.5&&lng<=1)return {lat,lng};return null}
// Deserialización de atributos textuales publicados como JSON dentro de una cadena.
// La fuente municipal puede entregar guardias como objeto o como texto JSON.
function readable(v){
 if(v===null||v===undefined)return '';
 let s=typeof v==='string'?v:String(v);
 // DOMParser trata las entidades HTML sin insertar contenido en el documento.
 if(/&(?:#\d+|#x[\da-f]+|[a-z]+);|<[^>]+>/i.test(s)){
   s=new DOMParser().parseFromString(s,'text/html').body.textContent||'';
 }
 return s.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
}
function unpack(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='object')return v;
 let s=readable(v);
 for(let n=0;n<2;n++){
   if(!/^[\[{"]/.test(s))break;
   try{const parsed=JSON.parse(s);if(typeof parsed==='string'){s=parsed;continue}return parsed;}catch{break}
 }
 return s;
}
function dutyObject(v){
 const parsed=unpack(v);
 if(Array.isArray(parsed))return parsed.map(dutyObject).filter(Boolean).flat();
 if(parsed && typeof parsed==='object'){
   const out={};
   for(const [key,value] of Object.entries(parsed)){
     const k=key.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
     if(['fecha','turno','horario','sector'].includes(k))out[k]=readable(value);
   }
   return Object.keys(out).length?[out]:[];
 }
 return parsed?[{texto:readable(parsed)}]:[];
}
function dutyHTML(p){
 const blocks=p.duties||[];
 if(blocks.length){return `<div class="hours"><strong>Guardia publicada</strong>${blocks.map(d=>`<div class="duty-record">${[['fecha','Fecha'],['turno','Turno'],['horario','Horario'],['sector','Sector'],['texto','Información']].filter(([k])=>d[k]).map(([k,label])=>`<div><b>${label}:</b> ${safeText(d[k])}</div>`).join('')}</div>`).join('')}</div>`}
 if(p.hours)return `<div class="hours"><b>Horario publicado:</b> ${safeText(p.hours)}</div>`;
 return '<div class="tags"><span class="tag warn">Horario individual no disponible</span></div>';
}
function normalize(record,index){const o=record.properties&&typeof record.properties==='object'?{...record,...record.properties}:record;
 const g=val(o,'guardia','deGuardia','de_guardia','horarioGuardia','horario_guardia','horarioDeGuardia','turnoGuardia');
 const hora=val(o,'horario','horarios','horarioApertura','horario_apertura','hours');
 const address=val(o,'direccion','dirección','address','calle','domicilio','via');
 const name=val(o,'title','nombre','name','titulo','denominacion','descripcion')||`Farmacia ${index+1}`;
 const duties=dutyObject(g);
 const horas=unpack(hora);
 const hours=typeof horas==='object'?(horas?Object.entries(horas).map(([k,v])=>`${readable(k)}: ${readable(v)}`).join(' · '):''):readable(horas);
 const phone=String(val(o,'telefono','teléfono','phone','tel','tlf')).replace(/[^\d+ ]/g,'').trim();
 const position=coords(o);
 return {id:String(val(o,'id','identifier','_id')||index),name:readable(name),address:readable(address),phone,hours,duties,sector:readable(val(o,'sector','barrio','zona')),turno:readable(val(o,'turno','tipoGuardia')),position,raw:o}; }
function todayISO(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function isoToCity(s){const [y,m,d]=s.split('-');return `${d}-${m}-${y}`}
function setStatus(text,error=false){els.status.textContent=text;els.status.classList.toggle('error',error)}
function distance(a,b){const r=Math.PI/180;const dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;const v=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
function directions(p,address){return p?`https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}&travelmode=walking`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address+' Zaragoza')}`}
function actionHTML(p){const url=directions(p.position,p.address);const phone=p.phone?`<a href="tel:${encodeURIComponent(p.phone.replace(/\s/g,''))}">☎ Llamar</a>`:'';const map=`<a target="_blank" rel="noopener noreferrer" href="${safeText(url)}">↗ Cómo llegar</a>`;return phone+map}
function showDetails(i){const item=state.items[i];if(!item||!item.position||!state.map)return;const marker=state.markers.find(o=>o.idx===i)?.marker;if(marker){state.map.setView([item.position.lat,item.position.lng],16);marker.openPopup();document.querySelector('.map-panel').scrollIntoView({block:'nearest',behavior:'smooth'})}}
function searchKey(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim()}
function update(){const q=searchKey(els.search.value);let list=state.items.map((p,i)=>({...p,idx:i})).filter(p=>searchKey([p.name,p.address,p.sector,...(p.duties||[]).map(d=>d.sector||'')].join(' ')).includes(q));if(state.position)list.sort((a,b)=>{const da=a.position?distance(a.position,state.position):Infinity;const db=b.position?distance(b.position,state.position):Infinity;return da-db});els.count.textContent=`${list.length} resultados`;
 els.list.innerHTML=list.length?list.map(p=>`<article class="pharmacy"><h3>${safeText(p.name)}</h3><p>📍 ${safeText(p.address||'Dirección no facilitada')}</p>${p.sector?`<p>Sector: ${safeText(p.sector)}</p>`:''}${dutyHTML(p)}<div class="tags"><span class="tag">${state.mode==='guardia'?'Incluida en el turno consultado':state.mode==='horarioAmpliado'?'Horario ampliado':'Directorio'}</span>${p.position&&state.position?`<span class="tag">${distance(p.position,state.position).toFixed(1)} km en línea recta</span>`:''}</div><div class="actions">${actionHTML(p)}${p.position?`<button type="button" data-focus="${p.idx}">Ver en mapa</button>`:''}</div></article>`).join(''):'<p class="empty">No hay farmacias que coincidan con esta búsqueda o no se han recibido registros.</p>';
 els.list.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>showDetails(Number(b.dataset.focus))));updateMarkers(list)}
function updateMarkers(list){if(!state.map)return;state.markers.forEach(o=>state.map.removeLayer(o.marker));state.markers=[];for(const p of list){if(!p.position)continue;const ico=L.divIcon({html:`<div class="marker-pin ${state.mode==='guardia'?'guard':''}"></div>`,className:'',iconSize:[22,22],iconAnchor:[11,11]});const marker=L.marker([p.position.lat,p.position.lng],{icon:ico}).addTo(state.map);marker.bindPopup(`<strong>${safeText(p.name)}</strong><div>${safeText(p.address)}</div>${(p.duties?.length||p.hours)?dutyHTML(p):''}<div class="popup-actions">${actionHTML(p)}</div>`);state.markers.push({idx:p.idx,marker})}}
function fit(){if(!state.map)return;const points=state.markers.map(o=>o.marker.getLatLng());if(state.position)points.push(L.latLng(state.position.lat,state.position.lng));if(points.length)state.map.fitBounds(L.latLngBounds(points).pad(.16),{maxZoom:15});else state.map.setView([41.6488,-0.8891],12)}

// Adaptador REST estático para GitHub Pages: el navegador consulta directamente la fuente.
// Si el municipio no admite CORS, no se inventan datos ni se emplea un proxy externo.
const MUNICIPAL='https://www.zaragoza.es/sede/servicio/farmacia.json';
async function municipalFetch(mode,date){
 const began=performance.now();const all=[];const signatures=new Set();let total=null,pages=0;
 for(let n=0;n<20;n++){
  const q=new URLSearchParams({srsname:'wgs84',rows:'200',start:String(all.length)});
  // El servicio municipal requiere tipo=todas explícito; si se omite, devuelve guardias.
  q.set('tipo',mode);
  if(mode==='guardia')q.set('fecha',isoToCity(date));
  const response=await fetch(MUNICIPAL+'?'+q,{mode:'cors',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('La API municipal devuelve HTTP '+response.status);
  const data=await response.json(),chunk=entries(data);
  if(n===0&&data&&typeof data==='object')for(const key of ['totalCount','total','totalElements','totalRecords','numFound'])if(Number.isInteger(data[key])){total=data[key];break;}
  if(!chunk.length)break;
  const fingerprint=JSON.stringify(chunk[0]).slice(0,500);
  if(signatures.has(fingerprint))break;
  signatures.add(fingerprint);all.push(...chunk);pages++;
  if(total!==null&&all.length>=total)break;
  if(total===null&&chunk.length<200)break;
 }
 const incomplete=pages>=20||(total!==null&&all.length<total);
 // No confundir la respuesta de guardias (7-14 registros) con el directorio municipal.
 if(mode==='todas'&&(incomplete||all.length<50))throw new Error('Directorio completo no verificado: se han recibido '+all.length+' registros (total declarado: '+(total??'desconocido')+'). No se mostrarán como «Todas».');
 return {origen:MUNICIPAL,fecha_consulta:new Date().toISOString(),datos:all,diagnostico:{paginas:pages,registros:all.length,total_origen:total,incompleto:incomplete,duracion_fuente_ms:Math.round(performance.now()-began)},cache:{origen:'red',edad_segundos:0}};
}

function keyFor(mode,date){return mode+'|'+(mode==='guardia'?date:'')}
function clientTtl(mode,date){
 if(mode!=='guardia')return 600000;
 if(date!==todayISO())return 600000;
 const now=new Date(),boundary=new Date(now);boundary.setHours(9,15,0,0);
 if(now>=boundary)boundary.setDate(boundary.getDate()+1);
 return Math.max(0,Math.min(90000,boundary.getTime()-now.getTime()));
}
function applyPayload(payload,elapsed,fromMemory=false){
 const raw=entries(payload.datos);if(!Array.isArray(raw)||!raw.length){state.items=[];update();setStatus('La API ha respondido sin registros. No se puede confirmar que no haya farmacias de guardia.',true);return}
 const start=performance.now();state.items=raw.map(normalize);state.counts[state.mode]=raw.length;update();fit();setTimeout(()=>{if(state.map){state.map.invalidateSize(true);fit()}},120);
 const process=performance.now()-start,noCoords=state.items.filter(x=>!x.position).length;
 const lowerBound=Math.max(state.counts.guardia||0,state.counts.horarioAmpliado||0);
 const suspect=state.mode==='todas'&&(state.items.length<lowerBound || payload.diagnostico?.incompleto);
 const diag=payload.diagnostico||{},cache=payload.cache||{};
 setStatus(`${state.items.length} registros recibidos del Ayuntamiento · Consulta original: ${new Date(payload.fecha_consulta).toLocaleString('es-ES')}${noCoords?' · '+noCoords+' sin coordenadas válidas':''}.${suspect?' ATENCIÓN: el directorio recibido parece INCOMPLETO.':''} La disponibilidad debe confirmarse por teléfono.`,Boolean(suspect));
 $('diagnostico').textContent=`Origen: ${fromMemory?'caché del navegador':cache.origen==='memoria'?'caché temporal':'API municipal'} · Tiempo petición: ${Math.round(elapsed)} ms · Procesamiento: ${Math.round(process)} ms · Tiempo API (si se consultó): ${diag.duracion_fuente_ms??'—'} ms · Páginas: ${diag.paginas??'?'} · Registros: ${diag.registros??raw.length}${cache.edad_segundos?' · Edad caché: '+cache.edad_segundos+' s':''}`;
}
async function load(force=false){
 const req=++state.loadNumber, date=els.date.value||todayISO(),key=keyFor(state.mode,date),now=Date.now();
 const cached=state.cache.get(key);
 if(!force&&cached&&cached.expires>now){applyPayload(cached.payload,0,true);return}
 // Carga directa: sin /api/farmacias y sin depender del equipo Windows.
 setStatus('Consultando datos oficiales…');els.list.innerHTML='<p class="empty">Obteniendo información del Ayuntamiento…</p>';
 const start=performance.now();
 try{const payload=await municipalFetch(state.mode,date);if(req!==state.loadNumber)return;
 const raw=entries(payload.datos),ttl=clientTtl(state.mode,date);
 if(raw.length&&!payload.diagnostico?.incompleto&&ttl>0)state.cache.set(key,{payload,expires:Date.now()+ttl});
 applyPayload(payload,performance.now()-start);
 }catch(e){if(req!==state.loadNumber)return;state.items=[];update();setStatus('Sin datos oficiales verificables. '+(e.message||'Error de conexión')+' Si el servicio bloquea el navegador por CORS, esta versión estática no podrá consultar los datos. Usa el enlace a la fuente oficial.',true)}
}
function setMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));els.date.disabled=mode!=='guardia';els.heading.textContent=mode==='guardia'?'Farmacias de guardia':mode==='horarioAmpliado'?'Horario ampliado':'Todas las farmacias';els.search.value='';load()}
function initializeMap(){if(typeof L==='undefined'){$('map').innerHTML='<p class="empty">No se pudo cargar Leaflet. La lista, teléfonos y enlaces de navegación seguirán disponibles. Comprueba la conexión a Internet.</p>';$('mapstatus').textContent='Mapa no disponible';return}state.map=L.map('map',{zoomControl:true}).setView([41.6488,-0.8891],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(state.map);setTimeout(()=>state.map.invalidateSize(true),200);window.addEventListener('resize',()=>state.map.invalidateSize(true));}
function geolocate(){if(!navigator.geolocation){setStatus('Este navegador no dispone de geolocalización.',true);return}setStatus('Solicitando permiso de ubicación…');navigator.geolocation.getCurrentPosition(p=>{state.position={lat:p.coords.latitude,lng:p.coords.longitude};if(state.map){if(state.userMarker)state.map.removeLayer(state.userMarker);state.userMarker=L.marker([state.position.lat,state.position.lng],{icon:L.divIcon({html:'<div class="user-pin"></div>',className:'',iconSize:[18,18]})}).addTo(state.map).bindPopup('Mi ubicación aproximada');}update();fit();setStatus('Ubicación obtenida. Resultados ordenados por distancia en línea recta; confirma horario antes de acudir.')},e=>setStatus('No se ha podido obtener la ubicación: '+e.message,true),{enableHighAccuracy:false,timeout:10000,maximumAge:300000})}
els.date.value=todayISO();document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));$('hoy').addEventListener('click',()=>{els.date.value=todayISO();if(state.mode==='guardia')load()});$('reload').addEventListener('click',()=>load(true));$('geo').addEventListener('click',geolocate);$('fit').addEventListener('click',fit);els.date.addEventListener('change',()=>{if(state.mode==='guardia')load()});els.search.addEventListener('input',update);initializeMap();load();
if('serviceWorker' in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js?v=022').catch(()=>{});

// Un cambio de fecha o del turno de 09:15 invalida la caché local.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.mode==='guardia'&&els.date.value===todayISO()){const key=keyFor(state.mode,els.date.value);const cached=state.cache.get(key);if(cached&&cached.expires<=Date.now())load()}});
