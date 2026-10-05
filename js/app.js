/* SCOREBOARD — Etapa 1: login, asistente de configuración e importación de catálogo.
   Datos en Firebase: users/{uid}/profile, users/{uid}/classes/{id}, users/{uid}/students/{id} */
const $ = id => document.getElementById(id);
let auth = null, db = null, USER = null, PROFILE = null, STUDENTS = {}, CLASSES = {};
let wzStep = 1, PARSED = null, FILE_NAME = "", WIZ_BUILT = null, WIZ_ALL = null, PICKED = new Set();

const cfgOk = () => firebaseConfig && firebaseConfig.apiKey && !/PEGAR/.test(firebaseConfig.apiKey);
function show(view){
  ["v-login","v-wizard","v-home"].forEach(v=>$(v).classList.toggle("hidden", v!=="v-"+view));
  $("logoutBtn").classList.toggle("hidden", view==="login");
  $("settingsBtn").classList.toggle("hidden", view!=="home");
}
function msg(el, text, kind){ el.textContent = text||""; el.className = "msg" + (text ? " "+(kind||"err") : ""); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function authErr(e){
  const c = (e && e.code) || "";
  if(/invalid-credential|wrong-password|user-not-found/.test(c)) return t("err_invalid");
  if(/email-already-in-use/.test(c)) return t("err_email_in_use");
  if(/weak-password/.test(c)) return t("err_weak");
  if(/invalid-email/.test(c)) return t("err_bad_email");
  if(/popup-closed|cancelled-popup/.test(c)) return t("err_popup");
  return t("err_generic");
}

/* ---------- Arranque ---------- */
window.onLangChange = ()=>{ $("langSel").value = LANG; $("pfLang").value = LANG; if(!$("v-home").classList.contains("hidden")){ renderHome(); if(typeof boardRender==="function") boardRender(); if(typeof spellRenderLevels==="function") spellRenderLevels(); if(typeof toolsOnClassChange==="function") toolsOnClassChange(); } if(!$("v-wizard").classList.contains("hidden")) wzRender(); };
function init(){
  document.documentElement.lang = LANG; applyI18n(); $("langSel").value = LANG; $("pfLang").value = LANG;
  if(!cfgOk()){ show("login"); $("cfgMsg").style.display="block"; return; }
  $("cfgMsg").style.display = "none";
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth(); db = firebase.database();
  auth.onAuthStateChanged(async u=>{
    USER = u;
    if(!u){ PROFILE = null; if(typeof stopBoardSync==="function") stopBoardSync(); show("login"); return; }
    await loadData();
    if(PROFILE && PROFILE.lang && I18N[PROFILE.lang]) setLang(PROFILE.lang);
    if(!PROFILE || !PROFILE.setupDone){ wzStart(1); } else { renderHome(); show("home"); startBoardSync(); }
  });
}

/* ---------- Login ---------- */
async function loginGoogle(){
  msg($("lgMsg"),"");
  try{ await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch(e){ msg($("lgMsg"), authErr(e)); }
}
async function loginEmail(create){
  const em = $("lgEmail").value.trim(), pw = $("lgPass").value;
  msg($("lgMsg"),"");
  try{
    if(create) await auth.createUserWithEmailAndPassword(em, pw);
    else await auth.signInWithEmailAndPassword(em, pw);
  }catch(e){ msg($("lgMsg"), authErr(e)); }
}
async function resetPass(){
  const em = $("lgEmail").value.trim();
  if(!em){ msg($("lgMsg"), t("need_email")); return; }
  try{ await auth.sendPasswordResetEmail(em); msg($("lgMsg"), t("reset_sent"), "ok"); }
  catch(e){ msg($("lgMsg"), authErr(e)); }
}
function doLogout(){ if(auth) auth.signOut(); }

/* ---------- Datos ---------- */
const uref = p => db.ref("users/"+USER.uid+(p?"/"+p:""));
async function loadData(){
  // Se leen solo estas ramas (no todo el nodo del usuario, que incluye respaldos pesados).
  const [p,c,s] = await Promise.all(["profile","classes","students"].map(k=>uref(k).once("value")));
  PROFILE = p.val() || null; CLASSES = c.val() || {}; STUDENTS = s.val() || {};
}

/* ---------- Asistente ---------- */
function wzStart(step){
  if(step===1){
    $("pfName").value = (PROFILE && PROFILE.name) || (USER && USER.displayName) || "";
    $("pfSchool").value = (PROFILE && PROFILE.school) || "";
    $("pfSubject").value = (PROFILE && PROFILE.subject) || "";
    $("pfLang").value = LANG;
  }
  wzStep = step; PARSED = null; WIZ_BUILT = null; WIZ_ALL = null; PICKED = new Set(); FILE_NAME = ""; $("fileInfo").textContent = ""; $("fileIn").value = "";
  show("wizard"); wzRender();
}
function wzRender(){
  [1,2,3,4,5].forEach(n=>$("s"+n).classList.toggle("hidden", n!==wzStep));
  $("wzN").textContent = wzStep;
  [...$("wzSteps").children].forEach((el,i)=>el.classList.toggle("on", i<wzStep));
  $("wzBack").classList.toggle("hidden", wzStep===1 || (wzStep===2 && PROFILE && PROFILE.setupDone && false));
  $("wzNext").textContent = wzStep===5 ? t("save") : t("next");
  $("wzNext").disabled = (wzStep===2 && !PARSED);
  msg($("wzMsg"),"");
}
async function wzGo(dir){
  msg($("wzMsg"),"");
  if(dir<0){ wzStep = Math.max(1, wzStep-1); wzRender(); return; }
  if(wzStep===1){
    const name = $("pfName").value.trim();
    if(!name){ $("pfName").focus(); return; }
    await uref("profile").update({name, school:$("pfSchool").value.trim(), subject:$("pfSubject").value.trim(), lang:LANG});
    PROFILE = Object.assign({}, PROFILE, {name, school:$("pfSchool").value.trim(), subject:$("pfSubject").value.trim(), lang:LANG});
    wzStep = 2; wzRender(); return;
  }
  if(wzStep===2){ wzStep = 3; fillMapping(); wzRender(); onMapChange(); return; }
  if(wzStep===3){
    if(!computeBuilt()) return;
    wzStep = 4; PICKED = new Set(); renderClsPick(); wzRender(); return;
  }
  if(wzStep===4){
    if(!PICKED.size){ msg($("wzMsg"), t("err_pick")); return; }
    WIZ_BUILT = Importer.filterByClasses(WIZ_ALL, PICKED);
    wzStep = 5; renderReview(); wzRender(); return;
  }
  if(wzStep===5) await saveCatalog();
}
async function skipImport(){ await finishSetup(); }
async function finishSetup(){
  await uref("profile").update({setupDone:true});
  PROFILE = Object.assign({}, PROFILE, {setupDone:true});
  await loadData(); renderHome(); show("home"); startBoardSync();
}

/* ---------- Archivo ---------- */
function onFile(file){
  if(!file) return;
  FILE_NAME = file.name;
  const reader = new FileReader();
  reader.onload = ev=>{
    try{
      const wb = XLSX.read(ev.target.result, {type:"array"});
      const sheets = wb.SheetNames.map(n=>({name:n, rows:XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:"", raw:false})}));
      PARSED = Importer.parseSheets(sheets);
      if(!PARSED.length) throw new Error("empty");
      $("fileInfo").textContent = "✔ "+FILE_NAME+" · "+PARSED.length+" · "+PARSED.reduce((a,s)=>a+s.data.length,0);
      msg($("wzMsg"),"");
    }catch(e){ PARSED = null; $("fileInfo").textContent = ""; msg($("wzMsg"), t("err_file")); }
    wzRender();
  };
  reader.readAsArrayBuffer(file);
}
function downloadTemplate(){
  const rows = [[t("tpl_class"),t("tpl_name"),t("tpl_e1"),t("tpl_e2")],
    ["7A","Ana Pérez Soto","apoderado1@correo.cl","apoderado2@correo.cl"],
    ["7A","Luis Rojas Díaz","apoderado@correo.cl",""]];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Catalogo");
  XLSX.writeFile(wb, t("tpl_file"));
}

/* ---------- Mapeo ---------- */
function allHeaders(){ const set = []; PARSED.forEach(s=>s.headers.forEach(h=>{ if(h && !set.includes(h)) set.push(h); })); return set; }
function fillMapping(){
  const hs = allHeaders(), g = Importer.guessMapping(hs);
  const opts = '<option value="">'+esc(t("col_none"))+'</option>' + hs.map(h=>'<option value="'+esc(h)+'">'+esc(h)+'</option>').join("");
  [["mapCls",g.cls],["mapName",g.name],["mapE1",g.email1],["mapE2",g.email2]].forEach(([id,val])=>{ $(id).innerHTML = opts; $(id).value = val || ""; });
  $("mapSheet").checked = !g.cls && PARSED.length>1;
  $("mapClsBox").classList.toggle("hidden", $("mapSheet").checked);
}
function onMapChange(){
  $("mapClsBox").classList.toggle("hidden", $("mapSheet").checked);
}
function currentMap(){ return {cls:$("mapCls").value, name:$("mapName").value, email1:$("mapE1").value, email2:$("mapE2").value}; }
function computeBuilt(){
  const m = currentMap(), fromSheet = $("mapSheet").checked;
  if(!m.name || (!fromSheet && !m.cls)){ msg($("wzMsg"), t("err_map_required")); return false; }
  WIZ_ALL = Importer.buildStudents(PARSED, m, fromSheet);
  WIZ_BUILT = WIZ_ALL;
  if(!WIZ_ALL.list.length){ msg($("wzMsg"), t("err_no_rows")); return false; }
  return true;
}
/* ---------- Selección de cursos ---------- */
function classCounts(){ const c = {}; WIZ_ALL.list.forEach(s=>{ c[s.cls] = (c[s.cls]||0)+1; }); return c; }
function renderClsPick(){
  const counts = classCounts(), q = Importer.norm($("clsSearch").value);
  const names = Object.keys(counts).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).filter(n=>!q || Importer.norm(n).includes(q));
  $("clsPick").innerHTML = names.map(n=>'<div class="cls pick'+(PICKED.has(n)?' on':'')+'" data-c="'+esc(n)+'"><b>'+esc(n)+'</b><span class="muted small">'+counts[n]+' '+esc(t("home_students"))+'</span></div>').join("");
  $("clsPick").querySelectorAll(".pick").forEach(el=>el.addEventListener("click",()=>{
    const c = el.dataset.c; if(PICKED.has(c)) PICKED.delete(c); else PICKED.add(c);
    el.classList.toggle("on"); $("clsPicked").textContent = PICKED.size;
  }));
  $("clsPicked").textContent = PICKED.size;
}
function clsPickAll(on){
  const q = Importer.norm($("clsSearch").value);
  Object.keys(classCounts()).filter(n=>!q || Importer.norm(n).includes(q)).forEach(n=>{ if(on) PICKED.add(n); else PICKED.delete(n); });
  renderClsPick();
}
function renderReview(){
  const s = WIZ_BUILT.stats;
  const card = (n,l,cls)=>'<div class="stat '+(cls||"")+'"><b>'+n+'</b>'+esc(l)+'</div>';
  $("stats").innerHTML = card(s.total,t("s4_students")) + card(WIZ_BUILT.classes.length,t("s4_classes")) + card(s.withEmail,t("s4_with_email")) +
    card(s.noEmail,t("s4_no_email"), s.noEmail?"warn":"") + card(s.invalid,t("s4_invalid"), s.invalid?"bad":"") + (s.dups?card(s.dups,t("s4_dups"),"warn"):"");
  $("prevTable").innerHTML = '<tr><th>'+esc(t("col_class"))+'</th><th>'+esc(t("col_name"))+'</th><th>'+esc(t("col_email1"))+'</th><th>'+esc(t("col_email2"))+'</th></tr>' +
    WIZ_BUILT.list.slice(0,60).map(x=>'<tr><td>'+esc(x.cls)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.mails[0])+'</td><td>'+esc(x.mails[1])+'</td></tr>').join("");
}

/* ---------- Guardado (solo agrega/actualiza; nunca borra) ---------- */
async function saveCatalog(){
  $("wzNext").disabled = true; $("wzNext").textContent = t("saving");
  try{
    const up = {};
    WIZ_BUILT.classes.forEach(c=>{ up["classes/"+Importer.slug(c)] = {name:c}; });
    WIZ_BUILT.list.forEach(s=>{ up["students/"+s.id] = {name:s.name, cls:s.cls, email1:s.mails[0]||"", email2:s.mails[1]||""}; });
    await uref().update(up);
    await finishSetup();
  }catch(e){ console.error(e); msg($("wzMsg"), t("err_generic")); $("wzNext").disabled = false; $("wzNext").textContent = t("save"); }
}
function startImport(){ wzStart(2); }

/* ---------- Inicio ---------- */
function renderHome(){
  $("hmName").textContent = (PROFILE && PROFILE.name) || "";
  $("hmSchool").textContent = [PROFILE&&PROFILE.school, PROFILE&&PROFILE.subject].filter(Boolean).join(" · ");
  const counts = {};
  Object.values(STUDENTS).forEach(s=>{ counts[s.cls] = (counts[s.cls]||0)+1; });
  const names = Object.keys(counts).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  $("hmClasses").innerHTML = names.map(n=>'<div class="cls"><b>'+esc(n)+'</b><span class="muted small">'+counts[n]+' '+esc(t("home_students"))+'</span></div>').join("");
  $("hmEmpty").classList.toggle("hidden", names.length>0);
  $("clsList").innerHTML = names.map(n=>'<option value="'+esc(n)+'">').join("");
}
async function addStudent(){
  const name = Importer.clean($("adName").value), cls = Importer.clean($("adCls").value);
  const e1 = $("adE1").value.trim().toLowerCase(), e2 = $("adE2").value.trim().toLowerCase();
  if(!name || !cls){ msg($("adMsg"), t("err_map_required")); return; }
  if((e1 && !Importer.EMAIL_RE.test(e1)) || (e2 && !Importer.EMAIL_RE.test(e2))){ msg($("adMsg"), t("err_bad_email")); return; }
  const id = Importer.slug(cls)+"::"+Importer.slug(name);
  try{
    const up = {}; up["classes/"+Importer.slug(cls)] = {name:cls}; up["students/"+id] = {name, cls, email1:e1, email2:e2};
    await uref().update(up);
    STUDENTS[id] = {name, cls, email1:e1, email2:e2};
    ["adName","adE1","adE2"].forEach(i=>$(i).value="");
    renderHome(); msg($("adMsg"), t("added"), "ok");
  }catch(e){ msg($("adMsg"), t("err_generic")); }
}
if(typeof setTimerMode==="function") setTimerMode("countdown");
if(typeof buildRoutinePanes==="function") buildRoutinePanes();
init();
