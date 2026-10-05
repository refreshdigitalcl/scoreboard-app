/* Herramientas: dock, Timer, Estudiante al azar, Grupos y Deletreo. Usan el curso elegido arriba (curClass). */
let toolActive = "";
function tf(key, vars){ let s = t(key); Object.keys(vars||{}).forEach(k=>{ s = s.split("{"+k+"}").join(vars[k]); }); return s; }
let actx = null;
function beep(freq, dur, type, vol){
  if(!SOUND_ON) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type||"sine"; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(vol||0.1, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+dur);
    o.start(); o.stop(actx.currentTime+dur);
  }catch(e){}
}
const playDing = () => beep(880, 0.25, "sine", 0.15);
const playTick = i => beep(300+(i%6)*40, 0.08, "square", 0.06);
function playFanfare(){
  if(!SOUND_ON) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1046].forEach((f,i)=>{ const o=actx.createOscillator(), g=actx.createGain(); o.type="triangle"; o.frequency.value=f; o.connect(g); g.connect(actx.destination);
      const t0=actx.currentTime+i*0.12; g.gain.setValueAtTime(0.001,t0); g.gain.linearRampToValueAtTime(0.18,t0+0.02); g.gain.exponentialRampToValueAtTime(0.001,t0+0.35); o.start(t0); o.stop(t0+0.4); });
  }catch(e){}
}

/* ----- Dock ----- */
function openTool(id){
  toolActive = id;
  document.querySelectorAll(".tool-dock button").forEach(b=>b.classList.toggle("active", b.dataset.tool===id));
  document.querySelectorAll(".toolpane").forEach(p=>p.classList.toggle("active", p.id==="tool-"+id));
  showTab("tools");
  if(id==="draw") updateDrawStatus();
  if(id==="groups") updateGroupStatus();
  if(id==="spell") spellRenderLevels();
}
function toggleFullscreen(){
  if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen();
}
document.addEventListener("fullscreenchange", ()=>document.body.classList.toggle("fs-active", !!document.fullscreenElement));
function toolsOnClassChange(){ updateDrawStatus(); updateGroupStatus(); }

/* ----- Timer ----- */
let timerMode="countdown", timerRunning=false, timerRemaining=0, timerElapsed=0, timerInterval=null, timerInitial=0;
function setTimerMode(mode){
  timerMode = mode; pauseTimer(); timerRemaining = 0; timerInitial = 0; timerElapsed = 0;
  $("modeCountdown").classList.toggle("tbtn-primary", mode==="countdown");
  $("modeStopwatch").classList.toggle("tbtn-primary", mode==="stopwatch");
  $("timerProgressWrap").style.display = mode==="countdown" ? "block" : "none";
  $("stepperMinus").disabled = $("stepperPlus").disabled = mode!=="countdown";
  updateTimerDisplay();
}
function fmt(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return (h>0 ? String(h).padStart(2,"0")+":" : "") + String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}
function updateTimerDisplay(){
  const el = $("timerDisplay");
  el.textContent = fmt(timerMode==="countdown" ? timerRemaining : timerElapsed);
  const danger = timerMode==="countdown" && timerRemaining<=10 && timerRunning;
  el.classList.toggle("danger", danger);
  if(timerMode==="countdown"){
    const bar = $("timerProgressBar");
    bar.style.width = (timerInitial>0 ? Math.max(0,Math.min(100,timerRemaining/timerInitial*100)) : 0)+"%";
    bar.classList.toggle("danger", danger);
  }
}
function adjustTimer(d){
  if(timerMode!=="countdown") return;
  timerRemaining = Math.max(0, timerRemaining+d);
  if(timerRemaining>timerInitial) timerInitial = timerRemaining;
  updateTimerDisplay();
}
function startTimer(){
  if(timerRunning) return;
  if(timerMode==="countdown" && timerRemaining<=0) return;
  timerRunning = true;
  timerInterval = setInterval(()=>{
    if(timerMode==="countdown"){ timerRemaining--; if(timerRemaining<=0){ timerRemaining = 0; updateTimerDisplay(); timerDone(); return; } }
    else timerElapsed++;
    updateTimerDisplay();
  }, 1000);
}
function pauseTimer(){ timerRunning = false; clearInterval(timerInterval); updateTimerDisplay(); }
function resetTimer(){ pauseTimer(); if(timerMode==="countdown") timerRemaining = timerInitial>0 ? timerInitial : 0; timerElapsed = 0; updateTimerDisplay(); }
function timerDone(){ pauseTimer(); celebrate(); let n = 0; const iv = setInterval(()=>{ playDing(); if(++n>=4) clearInterval(iv); }, 350); }

/* ----- Estudiante al azar ----- */
let DRAWN = {}, drawRaf = 0;
function classStudents(){ return curClass ? studentList().filter(s=>s.cls===curClass) : []; }
function drawPool(){
  const all = classStudents(), drawn = DRAWN[curClass] || [];
  let remaining = all.filter(s=>!drawn.includes(s.id));
  if(!remaining.length) remaining = all;
  return {all, remaining};
}
function updateDrawStatus(){
  const el = $("drawStatus"); if(!el) return;
  if(!curClass){ el.textContent = t("dr_pick"); return; }
  const {all, remaining} = drawPool();
  el.textContent = tf("dr_status", {c:curClass, r:remaining.length, a:all.length});
}
function resetDrawPool(){ if(!curClass){ alert(t("pick_class_alert")); return; } DRAWN[curClass] = []; updateDrawStatus(); }
function startRandomDraw(){
  if(!curClass){ alert(t("pick_class_alert")); return; }
  const {all, remaining} = drawPool();
  if(!all.length){ alert(t("dr_none")); return; }
  const winner = remaining[Math.floor(Math.random()*remaining.length)];
  $("drawModalBg").classList.add("show");
  $("drawClassLabel").textContent = "🎓 "+curClass;
  $("drawActions").style.display = "none";
  const nameEl = $("drawName"), subEl = $("drawSub");
  nameEl.classList.remove("reveal"); nameEl.classList.add("spinning"); subEl.textContent = "";
  cancelAnimationFrame(drawRaf);
  const MS = 4000, t0 = performance.now(); let next = 0, n = 0;
  function frame(now){
    const e = now - t0;
    if(e>=MS){ finishDraw(winner); return; }
    if(e>=next){
      nameEl.textContent = all[Math.floor(Math.random()*all.length)].name; playTick(n++);
      const x = e/MS; next = e + 55 + (380-55)*x*x;
    }
    drawRaf = requestAnimationFrame(frame);
  }
  drawRaf = requestAnimationFrame(frame);
}
function finishDraw(w){
  const nameEl = $("drawName");
  nameEl.classList.remove("spinning"); nameEl.textContent = w.name; nameEl.classList.add("reveal");
  $("drawSub").textContent = "🏅 "+w.cls+" · "+t("dr_ready");
  $("drawActions").style.display = "flex";
  (DRAWN[curClass] = DRAWN[curClass] || []);
  if(!DRAWN[curClass].includes(w.id)) DRAWN[curClass].push(w.id);
  celebrate(); playFanfare(); updateDrawStatus();
}
function closeDrawModal(){ cancelAnimationFrame(drawRaf); $("drawModalBg").classList.remove("show"); }

/* ----- Grupos ----- */
let groupSize = 2;
function setGroupSize(size){
  groupSize = size;
  document.querySelectorAll("#groupSizePicker .size-btn").forEach(b=>b.classList.toggle("active", size!=="custom" && b.dataset.size==size));
  if(size!=="custom") $("groupCustomSize").value = "";
}
function effectiveGroupSize(){
  const v = $("groupCustomSize").value.trim();
  if(v!==""){ const n = parseInt(v,10); return n>=2 ? n : null; }
  return typeof groupSize==="number" ? groupSize : 2;
}
function updateGroupStatus(){
  const el = $("groupStatus"); if(!el) return;
  el.textContent = curClass ? tf("gr_status", {c:curClass, n:classStudents().length}) : t("gr_pick");
}
function makeGroups(names, size){
  const sh = names.slice();
  for(let i=sh.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [sh[i],sh[j]] = [sh[j],sh[i]]; }
  const count = Math.max(1, Math.round(sh.length/size)), groups = Array.from({length:count},()=>[]);
  sh.forEach((n,i)=>groups[i%count].push(n));
  return groups;
}
function startRandomGroups(){
  if(!curClass){ alert(t("pick_class_alert")); return; }
  const names = classStudents().map(s=>s.name);
  if(names.length<2){ alert(t("gr_few")); return; }
  const size = effectiveGroupSize();
  if(!size){ alert(t("gr_size_err")); return; }
  const groups = makeGroups(names, size);
  $("groupResults").innerHTML = groups.map((g,i)=>'<div class="group-box" style="animation-delay:'+(i*0.06)+'s"><div class="group-badge">'+esc(t("gr_group"))+' '+(i+1)+'</div><ul class="group-members">'+g.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul></div>').join("");
  $("groupModalTitle").textContent = "👥 "+t("gr_modal")+" "+curClass;
  $("groupModalBg").classList.add("show"); playDing();
}
function closeGroupModal(){ $("groupModalBg").classList.remove("show"); }

/* ----- Deletreo ----- */
const SPELL_LEVELS = [
  {id:"starters",name:"Starters",sub:"sp_lv_starters"},{id:"movers",name:"Movers",sub:"sp_lv_movers"},{id:"flyers",name:"Flyers",sub:"sp_lv_flyers"},
  {id:"ket",name:"KET A2",sub:"sp_lv_ket"},{id:"b1",name:"B1",sub:"sp_lv_b1"},{id:"b2",name:"B2 FCE",sub:"sp_lv_b2"}
];
let spellLevel = "starters", spellUsed = {}, spellBusy = false, spellCurrent = "", spellRaf = 0, spellBarRaf = 0;
function spellRenderLevels(){
  const box = $("spellLevels"); if(!box) return;
  box.innerHTML = SPELL_LEVELS.map(l=>'<button class="spell-lv'+(l.id===spellLevel?' on':'')+'" data-l="'+l.id+'">'+l.name+'<small>'+esc(t(l.sub))+'</small></button>').join("");
  box.querySelectorAll("[data-l]").forEach(b=>b.addEventListener("click",()=>spellSetLevel(b.dataset.l)));
  spellUpdateCount();
}
function spellUpdateCount(){ const el = $("spellCount"); if(el) el.textContent = t("sp_used")+" "+(spellUsed[spellLevel]||[]).length+" / "+SPELL_POOLS[spellLevel].length; }
function spellSetLevel(id){
  if(spellBusy) return;
  spellLevel = id; spellCurrent = "";
  $("spellStage").classList.remove("reveal","spinning"); $("spellWord").textContent = "?"; $("spellSub").textContent = t("sp_ready");
  $("spellBarWrap").classList.remove("show"); cancelAnimationFrame(spellBarRaf); spellRenderLevels();
}
function spellReset(){ if(spellBusy) return; spellUsed[spellLevel] = []; spellUpdateCount(); $("spellSub").textContent = t("sp_pool_reset"); }
function spellPickVoice(){
  const vs = speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang));
  for(const re of [/google us english/i,/samantha/i,/microsoft (aria|jenny|guy).*online/i,/natural/i,/zira|david/i,/en[-_]us/i]){ const v = vs.find(v=>re.test(v.name)||re.test(v.lang)); if(v) return v; }
  return vs[0] || null;
}
if(window.speechSynthesis) speechSynthesis.getVoices();
function spellSpeak(){
  if(!spellCurrent || !window.speechSynthesis) return;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(spellCurrent); u.lang = "en-US"; u.rate = 0.7; const v = spellPickVoice(); if(v) u.voice = v; speechSynthesis.speak(u); }catch(e){}
}
function spellReveal(){
  if(spellBusy) return;
  const pool = SPELL_POOLS[spellLevel], used = spellUsed[spellLevel] = spellUsed[spellLevel] || [];
  const left = pool.filter(w=>!used.includes(w));
  if(!left.length){ $("spellSub").textContent = t("sp_empty"); return; }
  const word = left[Math.floor(Math.random()*left.length)];
  used.push(word); spellUpdateCount(); spellBusy = true; spellCurrent = word;
  const st = $("spellStage"), wEl = $("spellWord"), sub = $("spellSub"), btn = $("spellGo");
  btn.disabled = true; st.classList.remove("reveal"); st.classList.add("spinning");
  $("spellBarWrap").classList.remove("show"); cancelAnimationFrame(spellBarRaf); sub.textContent = t("sp_getready");
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", MS = 4000, LOCK = 1800, L = word.length, t0 = performance.now(); let next = 0, n = 0;
  function frame(now){
    const e = now - t0;
    if(e>=MS){ spellFinish(); return; }
    if(e>=next){
      const locked = e<LOCK ? 0 : Math.min(L, Math.floor((e-LOCK)/(MS-LOCK)*L)); let h = "";
      for(let i=0;i<L;i++) h += i<locked ? '<span class="lk">'+word[i].toUpperCase()+'</span>' : ABC[Math.floor(Math.random()*26)];
      wEl.innerHTML = h; playTick(n++); const x = e/MS; next = e + 45 + 160*x*x;
      if(e>2600) sub.textContent = t("sp_almost");
    }
    spellRaf = requestAnimationFrame(frame);
  }
  spellRaf = requestAnimationFrame(frame);
}
function spellFinish(){
  const st = $("spellStage"), sub = $("spellSub");
  st.classList.remove("spinning"); st.classList.add("reveal");
  $("spellWord").textContent = spellCurrent.toUpperCase(); sub.textContent = t("sp_spell");
  playFanfare(); spellSpeak(); $("spellGo").disabled = false; spellBusy = false;
  if($("spellTimerOn").checked){
    const wrap = $("spellBarWrap"), bar = $("spellBar"); wrap.classList.add("show"); const t0 = performance.now();
    const step = now=>{ const r = Math.max(0, 1-(now-t0)/4000); bar.style.width = (r*100)+"%"; if(r>0) spellBarRaf = requestAnimationFrame(step); else sub.textContent = t("sp_time"); };
    spellBarRaf = requestAnimationFrame(step);
  }
}
