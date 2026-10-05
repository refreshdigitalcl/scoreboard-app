/* Migración: importa el historial de puntos desde el respaldo (.json) del Scoreboard anterior.
   Es seguro repetirlo: cada punto usa una clave fija, así que importar dos veces no duplica nada. */
let MG_BACKUP = null, MG_PLAN = null, MG_ADD = new Set();
function mgReadFile(file){
  if(!file) return;
  const rd = new FileReader();
  rd.onload = ev=>{
    try{
      const d = JSON.parse(ev.target.result);
      if(!d || typeof d.students!=="object") throw new Error("bad");
      MG_BACKUP = d; MG_PLAN = null; MG_ADD = new Set(); $("mgResult").innerHTML = "";
      mgRenderMap(); msg($("mgMsg"), t("mg_loaded")+" "+Object.keys(d.students).length+" "+t("home_students"), "ok");
    }catch(e){ MG_BACKUP = null; $("mgMap").innerHTML = ""; msg($("mgMsg"), t("mg_bad_file")); }
  };
  rd.readAsText(file);
}
function mgRenderMap(){
  const oldC = [...new Set(Object.values(MG_BACKUP.students).filter(s=>(s.history||[]).length).map(s=>s.cls))].sort();
  const newC = classNames();
  const opts = '<option value="">'+esc(t("mg_skip"))+'</option>'+newC.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
  $("mgMap").innerHTML = '<div class="muted small" style="margin:10px 0">'+esc(t("mg_map_help"))+'</div>'+
    oldC.map(c=>'<div class="row" style="align-items:center;margin-bottom:6px"><div style="flex:0 0 120px"><b>'+esc(c)+'</b> →</div><select data-old="'+esc(c)+'">'+opts+'</select></div>').join("");
  $("mgMap").querySelectorAll("select").forEach(sel=>{ sel.value = Importer.guessClass(sel.dataset.old, newC); sel.addEventListener("change", mgPreview); });
  mgPreview();
}
function mgMapping(){ const m = {}; $("mgMap").querySelectorAll("select").forEach(s=>{ m[s.dataset.old] = s.value; }); return m; }
function mgPreview(){
  if(!MG_BACKUP) return;
  MG_PLAN = Importer.planMigration(MG_BACKUP, STUDENTS, mgMapping(), MG_ADD);
  const P = MG_PLAN;
  const cand = P.unmatched.filter(u=>u.why==="student"), other = P.unmatched.filter(u=>u.why!=="student");
  let un = "";
  if(cand.length){
    un += '<div class="msg err" style="display:block;margin-top:10px"><b>'+cand.length+' '+esc(t("mg_unmatched"))+'</b><div class="muted small" style="margin:4px 0 8px">'+esc(t("mg_add_help"))+'</div>'+
      cand.map(u=>'<label class="check" style="margin-top:6px"><input type="checkbox" data-add="'+esc(u.oldId)+'"><span>'+esc(u.name)+' <span class="muted">('+esc(u.cls)+' → '+esc(u.target)+') · '+u.pts+' '+esc(t("mg_points"))+'</span></span></label>').join("")+'</div>';
  }
  if(MG_ADD.size && Object.keys(P.adds).length){
    un += '<div class="msg ok" style="display:block;margin-top:10px">➕ '+Object.keys(P.adds).length+' '+esc(t("mg_will_add"))+': '+Object.values(P.adds).map(a=>esc(a.name)+" ("+esc(a.cls)+")").join(" · ")+'</div>';
  }
  if(other.length) un += '<div class="msg err" style="display:block;margin-top:10px"><b>'+other.length+' '+esc(t("mg_noclass"))+'</b><br>'+other.map(u=>esc(u.name)+" ("+esc(u.cls)+")").join(" · ")+'</div>';
  $("mgResult").innerHTML = '<div class="stats"><div class="stat"><b>'+P.matches.length+'</b>'+esc(t("mg_students"))+'</div><div class="stat"><b>'+P.entries+'</b>'+esc(t("mg_entries"))+'</div><div class="stat"><b>'+P.points+'</b>'+esc(t("mg_points"))+'</div></div>'+un+
    '<button class="btn btn-primary" style="margin-top:12px" onclick="mgRun()" '+(P.entries?'':'disabled')+'>'+esc(t("mg_run"))+'</button>';
  $("mgResult").querySelectorAll("[data-add]").forEach(c=>c.addEventListener("change",()=>{ if(c.checked) MG_ADD.add(c.dataset.add); else MG_ADD.delete(c.dataset.add); mgPreview(); }));
  // mantener marcadas las casillas ya elegidas (los alumnos agregados salen de "sin coincidencia", así que se muestran en el aviso verde)
}
async function mgRun(){
  if(!MG_PLAN || !MG_PLAN.entries) return;
  if(!confirm(t("mg_confirm")+" "+MG_PLAN.points+" "+t("mg_points")+"?")) return;
  const keys = Object.keys(MG_PLAN.updates); let done = 0;
  try{
    const adds = MG_PLAN.adds || {}, addUp = {};
    Object.keys(adds).forEach(id=>{ addUp["students/"+id] = {name:adds[id].name, cls:adds[id].cls, email1:"", email2:""}; addUp["classes/"+Importer.slug(adds[id].cls)] = {name:adds[id].cls}; });
    if(Object.keys(addUp).length) await uref().update(addUp);
    for(let i=0;i<keys.length;i+=400){
      const chunk = {}; keys.slice(i,i+400).forEach(k=>{ chunk[k] = MG_PLAN.updates[k]; });
      await uref().update(chunk); done += Object.keys(chunk).length;
      msg($("mgMsg"), t("saving")+" "+done+"/"+keys.length, "ok");
    }
    msg($("mgMsg"), "✅ "+t("mg_done")+" "+MG_PLAN.points+" "+t("mg_points"), "ok");
  }catch(e){ console.error(e); msg($("mgMsg"), t("err_generic")); }
}
