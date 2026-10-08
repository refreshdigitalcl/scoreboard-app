/* Marcador + Podio. Datos: users/{uid}/history/{studentId}/{pushId} = {t, p, r, d(YYYY-MM-DD)} */
let HISTORY = {}, curClass = localStorage.getItem("sb_cls") || "", curTab = "prep", boardRefs = [];
let SOUND_ON = localStorage.getItem("sb_sound") !== "off";
const PALETTE = ["#a855f7","#06b6d4","#22c55e","#f97316","#ec4899","#3b82f6","#eab308","#14b8a6","#f43f5e","#8b5cf6"];
const REASONS = [
  {code:"participacion", emoji:"🗣️", key:"reason_part", c1:"#22d3ee", c2:"#7c3aed"},
  {code:"actitud",       emoji:"🌟", key:"reason_att",  c1:"#ffd166", c2:"#ff5d5d"}
];
const LEVELS = [{min:0,key:"lvl0",emoji:"🌱"},{min:10,key:"lvl1",emoji:"📘"},{min:25,key:"lvl2",emoji:"🗣️"},{min:50,key:"lvl3",emoji:"⚔️"},{min:80,key:"lvl4",emoji:"🎓"},{min:120,key:"lvl5",emoji:"👑"}];
function levelOf(total){ let c = LEVELS[0]; LEVELS.forEach(l=>{ if(total>=l.min) c = l; }); return c; }
function reasonOf(code){ return REASONS.find(r=>r.code===code) || {emoji:"🎉", c1:"#8ce99a", c2:"#22c55e"}; }

/* ----- Fechas y puntajes ----- */
const pad2 = n => String(n).padStart(2,"0");
function dstr(dt){ return dt.getFullYear()+"-"+pad2(dt.getMonth()+1)+"-"+pad2(dt.getDate()); }
function todayStr(){ return dstr(new Date()); }
function mondayStr(){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return dstr(d); }
function prevMondayStr(){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7) - 7); return dstr(d); }
function pointsFor(id, today, monday, month, prevMonday){
  const out = {total:0, today:0, week:0, month:0, prev:0, gain:0}, h = HISTORY[id];
  if(!h) return out;
  Object.values(h).forEach(e=>{
    const p = Number(e.p)||0, d = e.d || "";
    out.total += p;
    if(d===today) out.today += p;
    if(d>=monday) out.week += p;
    else if(prevMonday && d>=prevMonday) out.prev += p;
    if(d.slice(0,7)===month) out.month += p;
  });
  out.gain = out.week - out.prev;
  return out;
}
function studentList(){ return Object.keys(STUDENTS).map(id=>Object.assign({id}, STUDENTS[id])); }
function classNames(){ return [...new Set(studentList().map(s=>s.cls))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); }
function clsColor(c){ const i = classNames().indexOf(c); return PALETTE[(i<0?0:i)%PALETTE.length]; }
function computeAll(){
  const today = todayStr(), monday = mondayStr(), month = today.slice(0,7), pm = prevMondayStr(), P = {};
  studentList().forEach(s=>{ P[s.id] = pointsFor(s.id, today, monday, month, pm); });
  return P;
}

/* ----- Sincronización ----- */
function startBoardSync(){
  stopBoardSync();
  const rh = uref("history"), rs = uref("students"), rset = uref("settings"), rvc = uref("voiceCmd");
  rvc.on("value", snap=>{ if(typeof onVoiceCmd==="function") onVoiceCmd(snap.val()); });
  rset.on("value", snap=>{ SETTINGS = snap.val() || {}; settingsLoaded(); });
  rh.on("value", snap=>{ HISTORY = snap.val() || {}; boardRender(); if(toolActive==="calendar" && curTab==="tools") renderCalendar(); });
  rs.on("value", snap=>{ STUDENTS = snap.val() || {}; renderHome(); boardRender(); });
  boardRefs = [rh, rs, rset, rvc];
  setTimeout(()=>{ if(USER && typeof maybeAutoBackup==="function") maybeAutoBackup(); }, 4000);
  if(curTab==="board" && !$("v-home").classList.contains("hidden")) boardRender();
}
function stopBoardSync(){ if(typeof stopVoice==="function") stopVoice(); boardRefs.forEach(r=>r.off()); boardRefs = []; HISTORY = {}; }

/* ----- Navegación ----- */
function showTab(name){
  curTab = name;
  if(name!=="podium" && typeof podStop==="function") podStop();
  if(name==="settings" && typeof bkRender==="function") bkRender();
  ["prep","board","podium","end","settings","tools"].forEach(n=>{
    $("pane-"+n).classList.toggle("hidden", n!==name);
    if($("tab-"+n)) $("tab-"+n).classList.toggle("on", n===name);
  });
  if(name!=="tools"){ document.querySelectorAll(".tool-dock button").forEach(x=>x.classList.remove("active")); }
  $("clsChips").classList.toggle("hidden", name==="settings");
  boardRender();
}
function setClass(c){ curClass = c; localStorage.setItem("sb_cls", c); boardRender(); if(typeof toolsOnClassChange==="function") toolsOnClassChange(); }
function toggleSound(){ SOUND_ON = !SOUND_ON; localStorage.setItem("sb_sound", SOUND_ON?"on":"off"); $("soundBtn").textContent = SOUND_ON ? "🔊" : "🔇"; }

function renderChips(){
  const names = classNames();
  if(curClass && !names.includes(curClass)) curClass = names[0] || "";
  if(!curClass && names.length===1) curClass = names[0];
  $("clsChips").innerHTML =
    '<button class="chip'+(curClass===""?" on":"")+'" data-c="">'+esc(t("all_classes"))+'</button>' +
    names.map(n=>'<button class="chip'+(curClass===n?" on":"")+'" data-c="'+esc(n)+'"><i style="background:'+clsColor(n)+'"></i>'+esc(n)+'</button>').join("");
  $("clsChips").querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>setClass(b.dataset.c)));
}
function boardRender(){
  if($("v-home").classList.contains("hidden")) return;
  $("soundBtn").textContent = SOUND_ON ? "🔊" : "🔇";
  renderChips();
  if(curTab==="board") renderBoardTable();
  if(curTab==="podium") renderPodium();
  if(curTab==="settings" && typeof renderSettings==="function"){ renderSettings(); }
  if((curTab==="prep"||curTab==="end") && typeof routinesOnClassChange==="function") routinesOnClassChange();
}

/* ----- Marcador ----- */
function renderBoardTable(){
  const P = computeAll();
  let list = studentList();
  if(curClass) list = list.filter(s=>s.cls===curClass);
  const q = Importer.norm($("bSearch").value);
  if(q) list = list.filter(s=>Importer.norm(s.name).includes(q));
  const by = $("bSort").value;
  if(by==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
  else list.sort((a,b)=>P[b.id][by]-P[a.id][by] || a.name.localeCompare(b.name));
  $("statCount").textContent = list.length;
  $("statToday").textContent = list.reduce((a,s)=>a+P[s.id].today,0);
  $("statWith").textContent = list.filter(s=>P[s.id].today>0).length;
  $("bRows").innerHTML = list.map((s,i)=>{
    const p = P[s.id], lv = levelOf(p.total);
    const rc = by==="name" ? "" : (i===0?"top1":i===1?"top2":i===2?"top3":"");
    const medal = by==="name" ? (i+1) : (i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1));
    return '<tr class="'+rc+'" data-id="'+esc(s.id)+'"><td><span class="rankbadge">'+medal+'</span></td>'+
      '<td><span class="sname">'+esc(s.name)+'</span><span class="tagcls" style="background:'+clsColor(s.cls)+'">'+esc(s.cls)+'</span><span class="level">'+lv.emoji+' '+esc(t(lv.key))+'</span></td>'+
      '<td class="c-today" data-l="'+esc(t("th_today"))+'">'+p.today+'</td><td data-l="'+esc(t("th_week"))+'">'+p.week+'</td><td class="total" data-l="'+esc(t("th_total"))+'">'+p.total+'</td>'+
      '<td><div class="actions-cell">'+REASONS.map(r=>'<button class="rbtn" style="background:linear-gradient(135deg,'+r.c1+','+r.c2+')" data-id="'+esc(s.id)+'" data-r="'+r.code+'"><b>+2</b> '+r.emoji+' '+esc(t(r.key))+'</button>').join("")+
      '<button class="rbtn btn-undo" data-undo="'+esc(s.id)+'" title="'+esc(t("undo"))+'" aria-label="'+esc(t("undo"))+'"><span class="ui">⟲</span><span class="ul"> '+esc(t("undo"))+'</span></button></div></td></tr>';
  }).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">'+esc(t("no_students"))+'</td></tr>';
  $("bRows").querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",ev=>addPoint(b.dataset.id,2,ev,b.dataset.r)));
  $("bRows").querySelectorAll("[data-undo]").forEach(b=>b.addEventListener("click",()=>undoLast(b.dataset.undo)));
}
function playEarn(){
  if(!SOUND_ON) return;
  try{ if(!playEarn.a) playEarn.a = new Audio(SND_EARN_POINT); playEarn.a.currentTime = 0; playEarn.a.play().catch(()=>{}); }catch(e){}
}
function addPoint(id, pts, ev, reason){
  if(!STUDENTS[id]) return;
  uref("history/"+id).push({t:Date.now(), p:pts, r:reason||null, d:todayStr()});
  playEarn();
  if(ev){
    const info = reasonOf(reason), f = document.createElement("div");
    f.className = "floatpts"; f.style.left = (ev.clientX-10)+"px"; f.style.top = (ev.clientY-20)+"px";
    f.style.color = info.c1; f.textContent = "+"+pts+" "+info.emoji;
    document.body.appendChild(f); setTimeout(()=>f.remove(), 900);
  }
  requestAnimationFrame(()=>{
    const row = document.querySelector('tr[data-id="'+CSS.escape(id)+'"]');
    if(!row) return;
    row.classList.add("flash");
    const a = row.querySelector(".c-today"), b = row.querySelector(".total");
    a && a.classList.add("bump"); b && b.classList.add("bump");
    setTimeout(()=>{ row.classList.remove("flash"); a&&a.classList.remove("bump"); b&&b.classList.remove("bump"); }, 900);
  });
}
function undoLast(id){
  const h = HISTORY[id]; if(!h) return;
  let key = null, tmax = -1;
  Object.keys(h).forEach(k=>{ const tt = h[k].t||0; if(tt>=tmax){ tmax = tt; key = k; } });
  if(!key) return;
  if(!confirm(t("undo_confirm")+" "+STUDENTS[id].name+"?")) return;
  uref("history/"+id+"/"+key).remove();
}

/* ----- Podio deslizable: Hoy · Semana · Mes · Total · Más mejorado · Salón de la Fama ----- */
const POD_SLIDES = [
  {m:"today", tab:"pod_today", head:"pod_h_today"},
  {m:"week",  tab:"pod_week",  head:"pod_h_week"},
  {m:"month", tab:"pod_month", head:"pod_h_month"},
  {m:"total", tab:"pod_total", head:"pod_h_total"},
  {m:"gain",  tab:"pod_gain",  head:"pod_h_gain"},
  {m:"hall",  tab:"pod_hall",  head:"pod_h_hall"}
];
let POD_I = (function(){ const v = localStorage.getItem("sb_pod"); const n = v===null ? 1 : Number(v); return (n>=0 && n<POD_SLIDES.length) ? n : 1; })();
let podTimer = null, podScrollT = null, podP = {};

function podRanked(P, m){
  const all = studentList().filter(s=>s.cls===curClass);
  const val = s => P[s.id][m];
  const list = m==="total" ? all : all.filter(s=>val(s)>0);
  return list.sort((a,b)=>val(b)-val(a) || (m==="gain" ? P[b.id].week-P[a.id].week : 0) || a.name.localeCompare(b.name));
}
function podLabel(v, m){ return (m==="gain" ? "+" : "") + v + " " + t("pts"); }
function podStageHtml(ranked, P, m){
  if(!ranked.length) return '<div class="pod-empty">'+esc(t(m==="total" ? "no_students" : "pod_none"))+'</div>';
  const top = ranked.slice(0,5), order = [3,1,0,2,4];
  return '<div class="stage">'+order.map(idx=>{
    const s = top[idx]; if(!s) return '<div class="pod-col"></div>';
    const pos = idx+1, ini = s.name.split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
    return '<div class="pod-col pod-'+pos+'">'+(pos===1?'<div class="crown">👑</div>':'')+
      '<div class="pod-avatar" style="background:'+clsColor(curClass)+'">'+esc(ini)+'</div>'+
      '<div class="pod-name">'+esc(s.name)+'</div><div class="pod-pts">'+esc(podLabel(P[s.id][m], m))+'</div>'+
      '<div class="pod-block">'+pos+'°</div></div>';
  }).join("")+'</div>';
}

/* Salón de la Fama: se calcula desde el historial (no requiere guardar nada) */
function weekStartOf(d){
  const p = String(d).split("-"); if(p.length!==3) return "";
  const dt = new Date(+p[0], +p[1]-1, +p[2]); if(isNaN(dt)) return "";
  dt.setDate(dt.getDate() - ((dt.getDay()+6)%7)); return dstr(dt);
}
function podWeekLabel(mon){
  const p = mon.split("-"), a = new Date(+p[0], +p[1]-1, +p[2]), b = new Date(a); b.setDate(b.getDate()+6);
  const f = {day:"numeric", month:"short"}, loc = LANG==="en" ? "en-US" : "es-CL";
  return a.toLocaleDateString(loc,f)+" – "+b.toLocaleDateString(loc,f);
}
function hallData(){
  const ids = studentList().filter(s=>s.cls===curClass).map(s=>s.id), wk = {};
  ids.forEach(id=>{
    const h = HISTORY[id]; if(!h) return;
    Object.values(h).forEach(e=>{
      const p = Number(e.p)||0, w = weekStartOf(e.d||""); if(!w || !p) return;
      wk[w] = wk[w] || {}; wk[w][id] = (wk[w][id]||0) + p;
    });
  });
  const cur = mondayStr(), done = [], titles = {}; let live = null;
  Object.keys(wk).sort().reverse().forEach(w=>{
    const m = wk[w], max = Math.max.apply(null, Object.values(m)); if(max<=0) return;
    const champs = Object.keys(m).filter(id=>m[id]===max), row = {w, champs, pts:max};
    if(w===cur) live = row;
    else if(w<cur){ done.push(row); champs.forEach(id=>{ titles[id] = (titles[id]||0)+1; }); }
  });
  return {done, live, titles};
}
function hallNames(ids){ return ids.map(id=>STUDENTS[id] ? STUDENTS[id].name : "").filter(Boolean).join(" · "); }
function hallHtml(){
  const d = hallData();
  if(!d.done.length && !d.live) return '<div class="pod-empty">'+esc(t("pod_hall_empty"))+'</div>';
  let h = '<div class="hall">';
  if(d.live) h += '<div class="hall-row live"><span class="hall-wk">'+esc(t("pod_inprog"))+'<small>'+esc(podWeekLabel(d.live.w))+'</small></span><span class="hall-champ">🔥 '+esc(hallNames(d.live.champs))+'</span><b>'+d.live.pts+'</b></div>';
  d.done.slice(0,12).forEach(r=>{
    h += '<div class="hall-row"><span class="hall-wk">'+esc(podWeekLabel(r.w))+'</span><span class="hall-champ">🏆 '+esc(hallNames(r.champs))+'</span><b>'+r.pts+'</b></div>';
  });
  h += '</div>';
  const top = Object.keys(d.titles).filter(id=>STUDENTS[id]).sort((a,b)=>d.titles[b]-d.titles[a] || STUDENTS[a].name.localeCompare(STUDENTS[b].name)).slice(0,3);
  if(top.length) h += '<div class="hall-top"><span>'+esc(t("pod_titles"))+'</span>'+top.map((id,i)=>'<em>'+["🥇","🥈","🥉"][i]+' '+esc(STUDENTS[id].name)+' <b>×'+d.titles[id]+'</b></em>').join("")+'</div>';
  return h;
}

function renderPodium(){
  const body = $("podBody"), box = $("rankBox"), car = $("podCar");
  if(!curClass){
    $("podTitle").textContent = "🏆 "+t("podium");
    $("podSub").style.display = "block"; body.style.display = "none"; box.style.display = "none"; podStop(); return;
  }
  $("podSub").style.display = "none"; body.style.display = "block";
  $("podTitle").textContent = "🏆 "+t("podium")+" "+curClass;
  podP = computeAll();
  car.innerHTML = POD_SLIDES.map((sl,i)=>{
    const inner = sl.m==="hall" ? hallHtml() : podStageHtml(podRanked(podP, sl.m), podP, sl.m);
    return '<div class="pod-slide" data-i="'+i+'">'+inner+'</div>';
  }).join("");
  if(!car._bound){
    car._bound = true;
    car.addEventListener("scroll", ()=>{
      clearTimeout(podScrollT);
      podScrollT = setTimeout(()=>{
        const w = car.clientWidth; if(!w) return;
        const i = Math.max(0, Math.min(POD_SLIDES.length-1, Math.round(car.scrollLeft / w)));
        if(i!==POD_I){ POD_I = i; localStorage.setItem("sb_pod", String(i)); podSync(false); }
      }, 90);
    }, {passive:true});
  }
  podSync(true);
}
function podSync(restore){
  const car = $("podCar"), sl = POD_SLIDES[POD_I];
  if(restore && car.clientWidth){ car.style.scrollBehavior = "auto"; car.scrollLeft = POD_I * car.clientWidth; car.style.scrollBehavior = ""; }
  $("podTabs").innerHTML = POD_SLIDES.map((s,i)=>'<button class="'+(i===POD_I?'on':'')+'" onclick="podGo('+i+')">'+esc(t(s.tab))+'</button>').join("");
  $("podDots").innerHTML = POD_SLIDES.map((s,i)=>'<i class="'+(i===POD_I?'on':'')+'" onclick="podGo('+i+')"></i>').join("");
  $("podHead").textContent = t(sl.head);
  $("podAutoBtn").textContent = podTimer ? t("pod_auto_off") : t("pod_auto");
  const box = $("rankBox");
  if(sl.m==="hall"){ box.style.display = "none"; return; }
  box.style.display = "block";
  const ranked = podRanked(podP, sl.m);
  $("rankRows").innerHTML = ranked.slice(5).map((s,i)=>'<tr><td><span class="rankbadge">'+(i+6)+'</span></td><td class="sname">'+esc(s.name)+'</td><td class="total">'+esc((sl.m==="gain"?"+":"")+podP[s.id][sl.m])+'</td></tr>').join("") ||
    '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:14px">'+esc(ranked.length ? t("all_on_podium") : t(sl.m==="total" ? "no_students" : "pod_none"))+'</td></tr>';
}
function podGo(i){
  const n = POD_SLIDES.length, car = $("podCar");
  POD_I = ((i % n) + n) % n; localStorage.setItem("sb_pod", String(POD_I));
  if(car.clientWidth) car.scrollTo({left: POD_I * car.clientWidth, behavior: "smooth"});
  podSync(false);
}
function podMove(d){ podGo(POD_I + d); }
function podStop(){
  if(podTimer){ clearInterval(podTimer); podTimer = null; }
  const b = $("podAutoBtn"); if(b) b.textContent = t("pod_auto");
}
function podToggleAuto(){
  if(podTimer){ podStop(); return; }
  podTimer = setInterval(()=>{ if(curTab!=="podium"){ podStop(); return; } podMove(1); }, 7000);
  $("podAutoBtn").textContent = t("pod_auto_off");
}
document.addEventListener("keydown", e=>{
  if(curTab!=="podium" || $("v-home").classList.contains("hidden")) return;
  if(/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) return;
  if(e.key==="ArrowLeft") podMove(-1); else if(e.key==="ArrowRight") podMove(1);
});
window.addEventListener("resize", ()=>{ if(curTab==="podium" && curClass) podSync(true); });

/* ----- Celebración ----- */
let confettiP = [];
function celebrate(){
  const cv = $("confetti"); cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#ffd166","#22d3ee","#7c3aed","#22c55e","#ef4444","#f97316"];
  confettiP = Array.from({length:140},()=>({x:Math.random()*cv.width,y:-20-Math.random()*200,r:4+Math.random()*6,c:colors[Math.floor(Math.random()*colors.length)],vy:2+Math.random()*3,vx:(Math.random()-.5)*2.5,rot:Math.random()*360,vr:(Math.random()-.5)*10}));
  if(SOUND_ON){ try{
    const ac = celebrate.ac = celebrate.ac || new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1046].forEach((f,i)=>{ const o=ac.createOscillator(), g=ac.createGain(); o.type="triangle"; o.frequency.value=f; o.connect(g); g.connect(ac.destination);
      const t0=ac.currentTime+i*0.12; g.gain.setValueAtTime(0.001,t0); g.gain.linearRampToValueAtTime(0.18,t0+0.02); g.gain.exponentialRampToValueAtTime(0.001,t0+0.35); o.start(t0); o.stop(t0+0.4); });
  }catch(e){} }
  requestAnimationFrame(tickConfetti);
}
function tickConfetti(){
  const cv = $("confetti"), c = cv.getContext("2d");
  c.clearRect(0,0,cv.width,cv.height);
  confettiP.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; c.save(); c.translate(p.x,p.y); c.rotate(p.rot*Math.PI/180); c.fillStyle=p.c; c.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6); c.restore(); });
  confettiP = confettiP.filter(p=>p.y < cv.height+30);
  if(confettiP.length) requestAnimationFrame(tickConfetti); else c.clearRect(0,0,cv.width,cv.height);
}
