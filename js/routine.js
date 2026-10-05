/* Class Preparation (inicio) y End of Class (cierre): 2 pasos de 1 minuto + lista de "no listos" + punto masivo.
   Los textos están en inglés a propósito: son lo que ven y leen los estudiantes en la pantalla del aula. */
const ROUTINES = {
  prep:{
    title:"🎯 CLASS PREPARATION", steps:["📦 Materials Out","🪑 Sit &amp; Ready"],
    phases:[{label:"📦 Step 1: Get your materials ready!",secs:60},{label:"🪑 Step 2: Sit down with your materials on your desk!",secs:60}],
    done:"🔔 Class has started! Let's begin! 🎉", reason:"inicio",
    nrTitle:"⚠️ Students Who Were Not Ready", nrVerb:"not ready", nrHint:"mark them as not ready today"
  },
  end:{
    title:"🔔 END OF CLASS", steps:["📦 Materials Away","📘 Next Class Ready"],
    phases:[{label:"📦 Step 1: Put away your English materials!",secs:60},{label:"📘 Step 2: Get out your materials for your next class!",secs:60}],
    done:"🔔 Class is over. See you next time! 👋", reason:"fin_clase",
    nrTitle:"⚠️ Students Who Did Not Finish", nrVerb:"did not finish", nrHint:"mark them as not finished today"
  }
};
const RS = {};
Object.keys(ROUTINES).forEach(k=>{ RS[k] = {phase:0, remaining:60, iv:null, nr:new Set()}; });

function buildRoutinePanes(){
  Object.keys(ROUTINES).forEach(p=>{
    const R = ROUTINES[p];
    $("pane-"+p).innerHTML =
    '<div class="card start-wrap"><h2 class="start-title">'+R.title+'</h2><p class="start-sub">Press Start and follow the steps together as a class.</p>'+
    '<div class="start-steps"><div class="start-step" id="'+p+'Step1"><div class="step-circle" id="'+p+'Circle1">1</div><div class="step-label">'+R.steps[0]+'</div></div>'+
    '<div class="start-line" id="'+p+'Line"></div>'+
    '<div class="start-step" id="'+p+'Step2"><div class="step-circle" id="'+p+'Circle2">2</div><div class="step-label">'+R.steps[1]+'</div></div></div>'+
    '<div class="start-phase-label" id="'+p+'Label">Press Start to begin</div>'+
    '<div class="timer-display" id="'+p+'Display">01:00</div>'+
    '<div class="timer-progress-wrap"><div class="timer-progress-bar" id="'+p+'Bar"></div></div>'+
    '<div class="timer-controls" style="margin-top:20px"><button class="tbtn tbtn-primary" onclick="routineStart(\''+p+'\')">▶ Start</button>'+
    '<button class="tbtn tbtn-ghost" onclick="routineReset(\''+p+'\')">⟲ Reset</button><button class="tbtn tbtn-ghost" onclick="toggleFullscreen()">🔳 Fullscreen</button></div></div>'+
    '<div class="card not-ready-card"><h3 style="margin:0 0 10px">'+R.nrTitle+'</h3>'+
    '<p class="session-note" style="margin:0 0 12px" id="'+p+'Hint"></p>'+
    '<div class="nr-search-wrap"><input id="'+p+'Search" class="nr-search" placeholder="🔍 Search student name..." autocomplete="off" oninput="nrSuggest(\''+p+'\')" onfocus="nrSuggest(\''+p+'\')"><div class="nr-suggestions" id="'+p+'Sugg"></div></div>'+
    '<div class="nr-chips" id="'+p+'Chips"></div>'+
    '<div class="timer-controls" style="margin-top:16px"><button class="tbtn tbtn-primary" onclick="routinePoint(\''+p+'\')">✅ +1 to Everyone Except These</button>'+
    '<button class="tbtn tbtn-ghost" onclick="nrClear(\''+p+'\')">🗑️ Clear list</button></div></div>';
    routineUI(p); nrRender(p);
  });
}
function routineUI(p){
  const R = ROUTINES[p], S = RS[p];
  if(!$(p+"Display")) return;
  $(p+"Display").textContent = fmt(S.remaining);
  const total = (S.phase===1||S.phase===2) ? R.phases[S.phase-1].secs : 60;
  const danger = S.remaining<=10 && S.phase>0 && S.phase<3;
  $(p+"Bar").style.width = Math.max(0,Math.min(100,S.remaining/total*100))+"%";
  $(p+"Bar").classList.toggle("danger", danger); $(p+"Display").classList.toggle("danger", danger);
  const lab = $(p+"Label");
  if(S.phase===0){ lab.textContent = "Press Start to begin"; lab.classList.remove("done-msg"); }
  else if(S.phase===3){ lab.textContent = R.done; lab.classList.add("done-msg"); }
  else { lab.textContent = R.phases[S.phase-1].label; lab.classList.remove("done-msg"); }
  $(p+"Step1").classList.toggle("active", S.phase===1); $(p+"Step1").classList.toggle("done", S.phase>=2); $(p+"Circle1").textContent = S.phase>=2 ? "✓" : "1";
  $(p+"Step2").classList.toggle("active", S.phase===2); $(p+"Step2").classList.toggle("done", S.phase>=3); $(p+"Circle2").textContent = S.phase>=3 ? "✓" : "2";
  $(p+"Line").classList.toggle("done", S.phase>=2);
}
function playMinuteEnd(){
  if(!SOUND_ON) return;
  try{ if(!playMinuteEnd.a) playMinuteEnd.a = new Audio(SND_MINUTE_END); playMinuteEnd.a.currentTime = 0; playMinuteEnd.a.play().catch(()=>{}); }catch(e){}
}
function routineStart(p){
  const R = ROUTINES[p], S = RS[p];
  clearInterval(S.iv); S.phase = 1; S.remaining = R.phases[0].secs; routineUI(p);
  S.iv = setInterval(()=>{
    S.remaining--;
    if(S.remaining<=0){
      if(S.phase===1){ S.phase = 2; S.remaining = R.phases[1].secs; playMinuteEnd(); }
      else { clearInterval(S.iv); S.phase = 3; S.remaining = 0; playMinuteEnd(); celebrate(); }
    }
    routineUI(p);
  }, 1000);
}
function routineReset(p){ const S = RS[p]; clearInterval(S.iv); S.phase = 0; S.remaining = 60; routineUI(p); }

/* ----- Lista de "no listos" (se guarda por profesor + curso + rutina en este navegador) ----- */
const nrKey = p => "sb_nr_"+p+"__"+(USER?USER.uid:"x")+"__"+curClass;
function nrLoad(p){
  try{ const raw = JSON.parse(localStorage.getItem(nrKey(p))||"[]"); RS[p].nr = new Set(Array.isArray(raw)?raw:[]); }catch(e){ RS[p].nr = new Set(); }
}
function nrSave(p){ try{ localStorage.setItem(nrKey(p), JSON.stringify([...RS[p].nr])); }catch(e){} }
function nrAdd(p,id){ RS[p].nr.add(id); nrSave(p); nrRender(p); const i = $(p+"Search"); i.value = ""; i.focus(); nrSuggest(p); }
function nrRemove(p,id){ RS[p].nr.delete(id); nrSave(p); nrRender(p); nrSuggest(p); }
function nrClear(p){ RS[p].nr.clear(); nrSave(p); nrRender(p); nrSuggest(p); }
function nrRender(p){
  const box = $(p+"Chips"); if(!box) return;
  const hint = $(p+"Hint"), inp = $(p+"Search");
  if(!curClass){
    box.innerHTML = ""; inp.disabled = true; inp.placeholder = "Select a course above first...";
    hint.textContent = "Select a course above, then search and click a student's name to "+ROUTINES[p].nrHint+".";
    return;
  }
  inp.disabled = false; inp.placeholder = "🔍 Search student name...";
  hint.textContent = "Search and click a student's name to "+ROUTINES[p].nrHint+".";
  const items = [...RS[p].nr].map(id=>STUDENTS[id]?{id,name:STUDENTS[id].name}:null).filter(Boolean);
  box.innerHTML = items.length ? items.map(it=>'<span class="nr-chip">'+esc(it.name)+'<button data-rm="'+esc(it.id)+'" title="Remove">✕</button></span>').join("") : '<span style="color:var(--muted);font-size:12.5px">No students marked yet.</span>';
  box.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>nrRemove(p,b.dataset.rm)));
}
function nrSuggest(p){
  const inp = $(p+"Search"), list = $(p+"Sugg"); if(!inp||!list||!curClass){ if(list){ list.classList.remove("show"); list.innerHTML = ""; } return; }
  const q = Importer.norm(inp.value);
  const roster = classStudents().filter(s=>!RS[p].nr.has(s.id));
  const matches = (q ? roster.filter(s=>Importer.norm(s.name).includes(q)) : roster).slice(0,8);
  if(!matches.length){ list.classList.remove("show"); list.innerHTML = ""; return; }
  list.innerHTML = matches.map(s=>'<div class="nr-suggestion-item" data-id="'+esc(s.id)+'">'+esc(s.name)+'</div>').join("");
  list.classList.add("show");
  list.querySelectorAll("[data-id]").forEach(d=>d.addEventListener("mousedown",ev=>{ ev.preventDefault(); nrAdd(p,d.dataset.id); }));
}
document.addEventListener("click", ev=>{ if(!ev.target.closest || !ev.target.closest(".nr-search-wrap")) document.querySelectorAll(".nr-suggestions").forEach(l=>l.classList.remove("show")); });
function routinePoint(p){
  if(!curClass){ alert("Select a course above first."); return; }
  const roster = classStudents();
  if(!roster.length){ alert("This course has no students registered."); return; }
  const up = {}; let given = 0, skipped = 0; const d = todayStr(), now = Date.now();
  roster.forEach(s=>{
    if(RS[p].nr.has(s.id)){ skipped++; return; }
    up[s.id+"/"+uref("history/"+s.id).push().key] = {t:now, p:1, r:ROUTINES[p].reason, d};
    given++;
  });
  uref("history").update(up).then(()=>{ playEarn(); celebrate(); alert("✅ +1 point given to "+given+" student(s)."+(skipped?" "+skipped+" student(s) skipped ("+ROUTINES[p].nrVerb+").":"")); }).catch(e=>{ console.error(e); alert(t("err_generic")); });
}
function routinesOnClassChange(){ Object.keys(ROUTINES).forEach(p=>{ nrLoad(p); nrRender(p); }); }
