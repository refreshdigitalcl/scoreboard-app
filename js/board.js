/* Marcador + Podio. Datos: users/{uid}/history/{studentId}/{pushId} = {t, p, r, d(YYYY-MM-DD)} */
let HISTORY = {}, curClass = localStorage.getItem("sb_cls") || "", curTab = "board", boardRefs = [];
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
function pointsFor(id, today, monday, month){
  const out = {total:0, today:0, week:0, month:0}, h = HISTORY[id];
  if(!h) return out;
  Object.values(h).forEach(e=>{
    const p = Number(e.p)||0, d = e.d || "";
    out.total += p;
    if(d===today) out.today += p;
    if(d>=monday) out.week += p;
    if(d.slice(0,7)===month) out.month += p;
  });
  return out;
}
function studentList(){ return Object.keys(STUDENTS).map(id=>Object.assign({id}, STUDENTS[id])); }
function classNames(){ return [...new Set(studentList().map(s=>s.cls))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); }
function clsColor(c){ const i = classNames().indexOf(c); return PALETTE[(i<0?0:i)%PALETTE.length]; }
function computeAll(){
  const today = todayStr(), monday = mondayStr(), month = today.slice(0,7), P = {};
  studentList().forEach(s=>{ P[s.id] = pointsFor(s.id, today, monday, month); });
  return P;
}

/* ----- Sincronización ----- */
function startBoardSync(){
  stopBoardSync();
  const rh = uref("history"), rs = uref("students"), rset = uref("settings");
  rset.on("value", snap=>{ SETTINGS = snap.val() || {}; settingsLoaded(); });
  rh.on("value", snap=>{ HISTORY = snap.val() || {}; boardRender(); });
  rs.on("value", snap=>{ STUDENTS = snap.val() || {}; renderHome(); boardRender(); });
  boardRefs = [rh, rs, rset];
  if(curTab==="board" && !$("v-home").classList.contains("hidden")) boardRender();
}
function stopBoardSync(){ boardRefs.forEach(r=>r.off()); boardRefs = []; HISTORY = {}; }

/* ----- Navegación ----- */
function showTab(name){
  curTab = name;
  ["board","podium","courses","settings","tools"].forEach(n=>{
    $("pane-"+n).classList.toggle("hidden", n!==name);
    if($("tab-"+n)) $("tab-"+n).classList.toggle("on", n===name);
  });
  if(name!=="tools"){ document.querySelectorAll(".tool-dock button").forEach(x=>x.classList.remove("active")); }
  $("clsChips").classList.toggle("hidden", name==="courses" || name==="settings");
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
  if(curTab==="settings" && typeof renderSettings==="function") renderSettings();
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
      '<td class="c-today">'+p.today+'</td><td>'+p.week+'</td><td class="total">'+p.total+'</td>'+
      '<td><div class="actions-cell">'+REASONS.map(r=>'<button class="rbtn" style="background:linear-gradient(135deg,'+r.c1+','+r.c2+')" data-id="'+esc(s.id)+'" data-r="'+r.code+'"><b>+2</b> '+r.emoji+' '+esc(t(r.key))+'</button>').join("")+
      '<button class="rbtn btn-undo" data-undo="'+esc(s.id)+'">⟲ '+esc(t("undo"))+'</button></div></td></tr>';
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

/* ----- Podio ----- */
function renderPodium(){
  const stage = $("stage"), box = $("rankBox");
  if(!curClass){
    $("podTitle").textContent = "🏆 "+t("podium");
    $("podSub").style.display = "block"; stage.innerHTML = ""; box.style.display = "none"; return;
  }
  $("podSub").style.display = "none"; box.style.display = "block";
  $("podTitle").textContent = "🏆 "+t("podium")+" "+curClass;
  const P = computeAll(), metric = $("podMetric").value;
  const ranked = studentList().filter(s=>s.cls===curClass).sort((a,b)=>P[b.id][metric]-P[a.id][metric] || a.name.localeCompare(b.name));
  const top = ranked.slice(0,5), order = [3,1,0,2,4];
  stage.innerHTML = order.map(idx=>{
    const s = top[idx]; if(!s) return '<div class="pod-col"></div>';
    const pos = idx+1, ini = s.name.split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
    return '<div class="pod-col pod-'+pos+'">'+(pos===1?'<div class="crown">👑</div>':'')+
      '<div class="pod-avatar" style="background:'+clsColor(curClass)+'">'+esc(ini)+'</div>'+
      '<div class="pod-name">'+esc(s.name)+'</div><div class="pod-pts">'+P[s.id][metric]+' '+esc(t("pts"))+'</div>'+
      '<div class="pod-block">'+pos+'°</div></div>';
  }).join("");
  $("rankRows").innerHTML = ranked.slice(5).map((s,i)=>'<tr><td><span class="rankbadge">'+(i+6)+'</span></td><td class="sname">'+esc(s.name)+'</td><td class="total">'+P[s.id][metric]+'</td></tr>').join("") ||
    '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:14px">'+esc(ranked.length ? t("all_on_podium") : t("no_students"))+'</td></tr>';
}

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
