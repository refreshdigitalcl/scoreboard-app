/* Reporte semanal a apoderados. Usa HISTORY + STUDENTS; plantilla en settings.rpSubjectTpl / rpBodyTpl.
   Variables: {alumno} {curso} {asignatura} {profesor} {semana} {puntos_semana} {puntos_total} {nivel} {posicion} {comparacion} {destacado} */
let RP_SELECTED = new Set(), RP_CLS = null, RP_STATS = null, RP_DIRTY = false;

function rpAddDays(ds, n){ const p = ds.split("-"); return dstr(new Date(+p[0], +p[1]-1, +p[2]+n)); }
function rpWeekStart(){ const m = mondayStr(); return ($("rpWeek") && $("rpWeek").value==="last") ? rpAddDays(m, -7) : m; }

function rpCompute(){
  const ws = rpWeekStart(), we = rpAddDays(ws, 6), ps = rpAddDays(ws, -7);
  const list = studentList().filter(s=>s.cls===curClass), R = {};
  list.forEach(s=>{
    const r = {w:0, p:0, tot:0};
    Object.values(HISTORY[s.id] || {}).forEach(e=>{
      const v = Number(e.p) || 0, d = e.d || "";
      if(d > we) return;
      r.tot += v;
      if(d >= ws) r.w += v; else if(d >= ps) r.p += v;
    });
    r.gain = r.w - r.p; R[s.id] = r;
  });
  const maxW = Math.max.apply(null, [0].concat(list.map(s=>R[s.id].w)));
  const maxG = Math.max.apply(null, [0].concat(list.map(s=>R[s.id].gain)));
  list.forEach(s=>{
    const r = R[s.id];
    r.pos = 1 + list.filter(o=>R[o.id].w > r.w).length;
    r.champ = r.w > 0 && r.w === maxW;
    r.top = r.gain > 0 && r.gain === maxG;
  });
  return {ws, we, R, n:list.length, list};
}

function rpVars(s, st){
  const S = getSettings(), r = st.R[s.id], name = shortStudentName(s.name, S.nameOrder), lv = levelOf(r.tot);
  let cmp;
  if(r.w === 0) cmp = t("rp_cmp_zero");
  else if(r.w > r.p) cmp = tf("rp_cmp_up", {d:r.w-r.p, w:r.w, p:r.p});
  else if(r.w === r.p) cmp = tf("rp_cmp_same", {w:r.w});
  else cmp = tf("rp_cmp_down", {w:r.w, p:r.p});
  const hi = [];
  if(r.champ) hi.push(tf("rp_champ", {alumno:name}));
  if(r.top) hi.push(tf("rp_gain", {alumno:name}));
  return {
    alumno:name, curso:courseLabel(s.cls), profesor:(PROFILE && PROFILE.name) || "", asignatura:(PROFILE && PROFILE.subject) || "",
    semana:podWeekLabel(st.ws), puntos_semana:r.w, puntos_total:r.tot, nivel:t(lv.key),
    posicion: r.w > 0 ? tf("rp_pos", {n:r.pos, m:st.n}) : "–", comparacion:cmp, destacado:hi.join("\n")
  };
}
function rpBuild(s, st){
  const v = rpVars(s, st), subj = ($("rpSubj") && $("rpSubj").value) || getSettings().rpSubjectTpl, body = ($("rpBody") && $("rpBody").value) || getSettings().rpBodyTpl;
  return {subject:fillTemplate(subj, v), body:fillTemplate(body, v).replace(/\n{3,}/g, "\n\n").trim()};
}

function rpInit(){
  if(RP_DIRTY || !$("rpSubj")) return;
  const S = getSettings(); $("rpSubj").value = S.rpSubjectTpl; $("rpBody").value = S.rpBodyTpl;
}
function rpDirty(){ RP_DIRTY = true; }
function rpCount(){ $("rpCount").textContent = RP_SELECTED.size + " " + t("ml_selected"); }

function renderReport(){
  if(!$("rpStudents")) return;
  if(RP_CLS !== curClass){ RP_SELECTED.clear(); RP_CLS = curClass; }
  if(!curClass){ RP_STATS = null; $("rpStudents").innerHTML = '<p class="session-note" style="padding:10px">'+esc(t("rp_pick"))+'</p>'; rpCount(); return; }
  const st = RP_STATS = rpCompute();
  $("rpStudents").innerHTML = st.list.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{
    const has = mailsOf(s).length > 0, r = st.R[s.id];
    return '<label class="mail-student-chip'+(has?"":" no-email")+'"><input type="checkbox" data-id="'+esc(s.id)+'"'+(RP_SELECTED.has(s.id)?" checked":"")+'>'+
      '<span class="msc-name">'+esc(s.name)+'</span><span class="rp-pts'+(r.w>0?"":" zero")+'">'+r.w+' '+esc(t("pts"))+'</span>'+(has?'':'<span class="warn">'+esc(t("ml_noemail"))+'</span>')+'</label>';
  }).join("") || '<p class="session-note" style="padding:10px">'+esc(t("ml_noresults"))+'</p>';
  $("rpStudents").querySelectorAll("input[data-id]").forEach(c=>c.addEventListener("change", ()=>{ if(c.checked) RP_SELECTED.add(c.dataset.id); else RP_SELECTED.delete(c.dataset.id); rpCount(); }));
  rpCount();
}
function rpSelectAll(onlyPts){
  if(!RP_STATS) return;
  RP_STATS.list.forEach(s=>{ if(mailsOf(s).length && (!onlyPts || RP_STATS.R[s.id].w > 0)) RP_SELECTED.add(s.id); });
  renderReport();
}
function rpSelectNone(){ RP_SELECTED.clear(); renderReport(); }

function rpPreview(){
  if(!RP_STATS){ alert(t("rp_pick")); return; }
  const id = [...RP_SELECTED][0] || (RP_STATS.list.find(s=>mailsOf(s).length) || RP_STATS.list[0] || {}).id;
  if(!id || !STUDENTS[id]){ alert(t("rp_need_student")); return; }
  const m = rpBuild(Object.assign({id}, STUDENTS[id]), RP_STATS);
  $("rpPreview").textContent = t("set_subject")+": "+m.subject+"\n\n"+m.body; $("rpPreview").classList.remove("hidden");
}
function rpGenerate(){
  if(!RP_STATS || !RP_SELECTED.size){ alert(t("rp_need_student")); return; }
  const S = getSettings(), cc = parseCc(S.cc).join(","), st = RP_STATS;
  const items = [...RP_SELECTED].map(id=>STUDENTS[id] && Object.assign({id}, STUDENTS[id])).filter(s=>s && s.cls===curClass).sort((a,b)=>a.name.localeCompare(b.name));
  $("rpResults").innerHTML = items.map(s=>{
    const to = mailsOf(s).join(",");
    if(!to) return '<div class="mail-result-item"><span class="mri-name">'+esc(s.name)+'</span><span class="mri-missing">⚠️ '+esc(t("ml_noemail_long"))+'</span></div>';
    const m = rpBuild(s, st), url = composeUrl(S.provider, to, cc, m.subject, m.body);
    return '<div class="mail-result-item"><div><div class="mri-name">'+esc(s.name)+' <span class="rp-pts">'+st.R[s.id].w+' '+esc(t("pts"))+'</span></div><div class="mri-to">'+esc(to)+(cc?' <span class="mri-cc">· CC: '+esc(cc)+'</span>':'')+'</div></div><a class="tbtn tbtn-primary" href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(t("ml_open"))+'</a></div>';
  }).join("");
}
async function rpSaveTpl(){
  const data = {rpSubjectTpl:$("rpSubj").value, rpBodyTpl:$("rpBody").value};
  try{ await uref("settings").update(data); SETTINGS = Object.assign({}, SETTINGS, data); RP_DIRTY = false; msg($("rpMsg"), t("set_saved"), "ok"); }
  catch(e){ console.error(e); msg($("rpMsg"), t("err_generic")); }
}
function rpResetTpl(){
  if(!confirm(t("set_reset_confirm"))) return;
  $("rpSubj").value = t("rp_tpl_subject"); $("rpBody").value = t("rp_tpl_body"); RP_DIRTY = true;
}
