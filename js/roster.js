/* Gestión del catálogo: ver, editar y eliminar estudiantes y cursos (en ⚙️ Ajustes). */
let ROSTER_CLS = "", ED_ID = "";
function rosterOpen(c){ ROSTER_CLS = (ROSTER_CLS===c ? "" : c); renderRoster(); }
function renderRoster(){
  const box = $("rosterPanel"); if(!box) return;
  document.querySelectorAll("#hmClasses .cls").forEach(el=>el.classList.toggle("on", el.dataset.cls===ROSTER_CLS));
  if(!ROSTER_CLS){ box.innerHTML = '<p class="muted small" style="margin-top:12px">'+esc(t("rs_hint"))+'</p>'; return; }
  const q = Importer.norm(($("rsSearch")&&$("rsSearch").value)||"");
  const all = studentList().filter(s=>s.cls===ROSTER_CLS).sort((a,b)=>a.name.localeCompare(b.name));
  const list = q ? all.filter(s=>Importer.norm(s.name).includes(q)) : all;
  box.innerHTML = '<div class="roster-head"><h3 style="margin:0">'+esc(t("rs_title"))+' '+esc(ROSTER_CLS)+' <span class="muted small">('+all.length+')</span></h3>'+
    '<button class="btn" onclick="rosterDeleteClass()">🗑️ '+esc(t("rs_class_delete"))+'</button></div>'+
    '<input id="rsSearch" placeholder="'+esc(t("search_student"))+'" value="'+esc(($("rsSearch")&&$("rsSearch").value)||"")+'" oninput="renderRoster();document.getElementById(\'rsSearch\').focus()">'+
    '<div class="roster-list">'+(list.map(s=>'<div class="roster-row"><div class="roster-name"><b>'+esc(s.name)+'</b><div class="muted small">'+esc([s.email1,s.email2].filter(Boolean).join(" · ")||t("ml_noemail"))+'</div></div>'+
      '<button class="btn" data-ed="'+esc(s.id)+'" title="'+esc(t("rs_edit"))+'">✏️</button><button class="btn" data-del="'+esc(s.id)+'" title="'+esc(t("rs_delete"))+'">🗑️</button></div>').join("")||'<p class="muted small">'+esc(t("no_students"))+'</p>')+'</div>';
  box.querySelectorAll("[data-ed]").forEach(b=>b.addEventListener("click",()=>rosterEdit(b.dataset.ed)));
  box.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>rosterDelete(b.dataset.del)));
}
function rosterEdit(id){
  const s = STUDENTS[id]; if(!s) return; ED_ID = id;
  $("edName").value = s.name||""; $("edE1").value = s.email1||""; $("edE2").value = s.email2||""; msg($("edMsg"),"");
  $("editModalBg").classList.add("show");
}
function rosterCloseEdit(){ $("editModalBg").classList.remove("show"); }
async function rosterSave(){
  const name = Importer.clean($("edName").value), e1 = $("edE1").value.trim().toLowerCase(), e2 = $("edE2").value.trim().toLowerCase();
  if(!name){ msg($("edMsg"), t("err_map_required")); return; }
  if((e1&&!Importer.EMAIL_RE.test(e1)) || (e2&&!Importer.EMAIL_RE.test(e2))){ msg($("edMsg"), t("err_bad_email")); return; }
  try{ await uref("students/"+ED_ID).update({name, email1:e1, email2:e2}); rosterCloseEdit(); }
  catch(err){ console.error(err); msg($("edMsg"), t("err_generic")); }
}
function pointsOf(id){ return Object.values(HISTORY[id]||{}).reduce((a,e)=>a+(Number(e.p)||0),0); }
async function safeBackup(label){ try{ await bkLoadIndex(); await bkWrite(bkKeyNow(true), label); }catch(e){ console.warn("backup", e); } }
async function rosterDelete(id){
  const s = STUDENTS[id]; if(!s) return;
  if(!confirm(t("rs_del_confirm")+" "+s.name+" ("+pointsOf(id)+" "+t("pts")+")?")) return;
  await safeBackup("pre-delete");
  try{ const up = {}; up["students/"+id] = null; up["history/"+id] = null; await uref().update(up); }
  catch(e){ console.error(e); alert(t("err_generic")); }
}
async function rosterDeleteClass(){
  const list = studentList().filter(s=>s.cls===ROSTER_CLS); if(!list.length) return;
  const pts = list.reduce((a,s)=>a+pointsOf(s.id),0);
  if(!confirm(t("rs_class_confirm")+" "+ROSTER_CLS+" ("+list.length+" "+t("home_students")+", "+pts+" "+t("pts")+")?")) return;
  await safeBackup("pre-delete");
  try{
    const up = {}; list.forEach(s=>{ up["students/"+s.id] = null; up["history/"+s.id] = null; }); up["classes/"+Importer.slug(ROSTER_CLS)] = null;
    await uref().update(up); ROSTER_CLS = ""; renderRoster();
  }catch(e){ console.error(e); alert(t("err_generic")); }
}
