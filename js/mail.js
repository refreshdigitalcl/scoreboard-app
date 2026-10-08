/* Correos a apoderados + Ajustes. Datos: users/{uid}/settings {cc, nameOrder, provider, subjectTpl, bodyTpl}.
   Los correos de los apoderados están en STUDENTS[id].email1 / email2. */
let SETTINGS = {}, MAIL_SELECTED = new Set();
function getSettings(){
  return Object.assign({cc:"", nameOrder:"lastfirst", provider:"gmail", subjectTpl:t("tpl_subject_default"), bodyTpl:t("tpl_body_default")}, SETTINGS);
}
function settingsLoaded(){ renderSettings(); }

/* ----- Nombre y curso ----- */
function shortStudentName(full, order){
  const tk = (full||"").trim().split(/\s+/).filter(Boolean);
  if(tk.length<3) return tk.join(" ");
  return (order||getSettings().nameOrder)==="lastfirst" ? [tk[2],tk[0],tk[1]].join(" ") : tk.slice(0,3).join(" ");
}
function courseLabel(cls){
  let m = /^(\d)-?([A-Z])$/.exec(cls); if(m) return m[1]+"°"+m[2];
  m = /^(\d)(?:EM|M)-?([A-Z])$/.exec(cls); if(m) return m[1]+"° Medio "+m[2];
  return cls;
}
function formatFecha(val){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val||""); if(!m) return val||"";
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  const txt = d.toLocaleDateString(LANG==="en"?"en-US":"es-CL",{weekday:"long",day:"numeric",month:"long"}).replace(",","");
  return txt.charAt(0).toUpperCase()+txt.slice(1);
}
function fillTemplate(tpl, vars){ return String(tpl).replace(/\{([a-z]+)\}/g,(m,k)=>k in vars ? vars[k] : m); }
function buildEmail(student, o){
  const S = getSettings(), name = shortStudentName(student.name, S.nameOrder);
  const vars = Object.assign({alumno:name, curso:courseLabel(student.cls), profesor:(PROFILE&&PROFILE.name)||""}, o);
  return {subject:fillTemplate(S.subjectTpl, vars), body:fillTemplate(S.bodyTpl, vars)};
}
function composeUrl(provider, to, cc, subject, body){
  const q = encodeURIComponent;
  if(provider==="outlook") return "https://outlook.office.com/mail/deeplink/compose?to="+q(to)+(cc?"&cc="+q(cc):"")+"&subject="+q(subject)+"&body="+q(body);
  if(provider==="mailto") return "mailto:"+to+"?"+(cc?"cc="+q(cc)+"&":"")+"subject="+q(subject)+"&body="+q(body);
  const p = new URLSearchParams({view:"cm", fs:"1", to, su:subject, body}); if(cc) p.set("cc", cc);
  return "https://mail.google.com/mail/?"+p.toString();
}
const mailsOf = s => [s.email1, s.email2].filter(Boolean);
function parseCc(txt){ return String(txt||"").split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean); }

/* ----- Herramienta ✉️ ----- */
function openPicker(id){ const el = $(id); try{ el.showPicker(); }catch(e){ el.focus(); } }
function mailVisible(){
  const q = Importer.norm($("mailSearch").value);
  let list = studentList();
  if(q) list = list.filter(s=>Importer.norm(s.name).includes(q));
  else if(curClass) list = list.filter(s=>s.cls===curClass);
  else return [];
  return list.sort((a,b)=>a.cls===b.cls ? a.name.localeCompare(b.name) : a.cls.localeCompare(b.cls, undefined, {numeric:true}));
}
function mailCount(){ $("mailCount").textContent = MAIL_SELECTED.size+" "+t("ml_selected"); }
function renderMailStudents(){
  if(!$("mailStudents")) return;
  const q = Importer.norm($("mailSearch").value), list = mailVisible();
  $("mailStudents").innerHTML = list.map(s=>{
    const has = mailsOf(s).length>0;
    return '<label class="mail-student-chip'+(has?"":" no-email")+'"><input type="checkbox" data-id="'+esc(s.id)+'"'+(MAIL_SELECTED.has(s.id)?" checked":"")+'>'+
      (q?'<span class="msc-cls">'+esc(s.cls)+'</span>':'')+'<span class="msc-name">'+esc(s.name)+'</span>'+(has?'':'<span class="warn">'+esc(t("ml_noemail"))+'</span>')+'</label>';
  }).join("") || '<p class="session-note" style="padding:10px">'+esc(curClass||q ? t("ml_noresults") : t("ml_pick"))+'</p>';
  $("mailStudents").querySelectorAll("input[data-id]").forEach(c=>c.addEventListener("change",()=>{ if(c.checked) MAIL_SELECTED.add(c.dataset.id); else MAIL_SELECTED.delete(c.dataset.id); mailCount(); }));
  mailCount();
}
function mailSelectAll(){ mailVisible().forEach(s=>{ if(mailsOf(s).length) MAIL_SELECTED.add(s.id); }); renderMailStudents(); }
function mailSelectNone(){ MAIL_SELECTED.clear(); renderMailStudents(); }
function generateMailDrafts(){
  if(!MAIL_SELECTED.size){ alert(t("ml_need_student")); return; }
  const o = {
    asignatura: $("mailAsignatura").value.trim() || (PROFILE&&PROFILE.subject) || "",
    fecha: formatFecha($("mailFecha").value.trim()), hora: $("mailHora").value.trim(),
    duracion: $("mailDuracion").value.trim(), lugar: $("mailLugar").value.trim(),
    materiales: $("mailMateriales").value.trim(), contenidos: $("mailContenidos").value.trim()
  };
  if(!o.fecha || !o.hora || !o.lugar || !o.contenidos){ alert(t("ml_need_fields")); return; }
  const S = getSettings(), cc = parseCc(S.cc).join(",");
  const items = [...MAIL_SELECTED].map(id=>STUDENTS[id] && Object.assign({id}, STUDENTS[id])).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
  $("mailResults").innerHTML = items.map(s=>{
    const to = mailsOf(s).join(",");
    if(!to) return '<div class="mail-result-item"><span class="mri-name">'+esc(s.name)+'</span><span class="mri-missing">⚠️ '+esc(t("ml_noemail_long"))+'</span></div>';
    const m = buildEmail(s, o), url = composeUrl(S.provider, to, cc, m.subject, m.body);
    return '<div class="mail-result-item"><div><div class="mri-name">'+esc(s.name)+'</div><div class="mri-to">'+esc(to)+(cc?' <span class="mri-cc">· CC: '+esc(cc)+'</span>':'')+'</div></div><a class="tbtn tbtn-primary" href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(t("ml_open"))+'</a></div>';
  }).join("");
}
function initMailDefaults(){
  if($("mailAsignatura") && !$("mailAsignatura").value) $("mailAsignatura").value = (PROFILE&&PROFILE.subject) || "";
  if($("mailDuracion") && !$("mailDuracion").value) $("mailDuracion").value = t("ml_dur_default");
  if($("mailMateriales") && !$("mailMateriales").value) $("mailMateriales").value = t("ml_mat_default");
}

/* ----- Ajustes ----- */
function renderSettings(){
  if(!$("setCc")) return;
  const S = getSettings();
  if(document.activeElement && ["setCc","setSubjectTpl","setBodyTpl"].includes(document.activeElement.id)) return; // no pisar lo que se está escribiendo
  $("setCc").value = S.cc; $("setProvider").value = S.provider; $("setNameOrder").value = S.nameOrder;
  $("setSubjectTpl").value = S.subjectTpl; $("setBodyTpl").value = S.bodyTpl;
  $("pfName2").value = (PROFILE&&PROFILE.name)||""; $("pfSchool2").value = (PROFILE&&PROFILE.school)||""; $("pfSubject2").value = (PROFILE&&PROFILE.subject)||"";
}
async function saveSettings(){
  const bad = parseCc($("setCc").value).filter(e=>!Importer.EMAIL_RE.test(e));
  if(bad.length){ msg($("setMsg"), t("set_bad_cc")+" "+bad.join(", ")); return; }
  const data = {cc:parseCc($("setCc").value).join(", "), provider:$("setProvider").value, nameOrder:$("setNameOrder").value, subjectTpl:$("setSubjectTpl").value, bodyTpl:$("setBodyTpl").value};
  const prof = {name:$("pfName2").value.trim(), school:$("pfSchool2").value.trim(), subject:$("pfSubject2").value.trim()};
  try{
    await uref("settings").set(data); await uref("profile").update(prof);
    PROFILE = Object.assign({}, PROFILE, prof); SETTINGS = data;
    msg($("setMsg"), t("set_saved"), "ok"); renderHome();
  }catch(e){ console.error(e); msg($("setMsg"), t("err_generic")); }
}
async function resetTemplate(){
  if(!confirm(t("set_reset_confirm"))) return;
  $("setSubjectTpl").value = t("tpl_subject_default"); $("setBodyTpl").value = t("tpl_body_default");
}
function previewTemplate(){
  const S = {subjectTpl:$("setSubjectTpl").value, bodyTpl:$("setBodyTpl").value, nameOrder:$("setNameOrder").value};
  const sample = {name: S.nameOrder==="lastfirst" ? "Barrientos Chávez Josefa Ignacia" : "Josefa Barrientos Chávez", cls:"8A"};
  const prev = SETTINGS; SETTINGS = Object.assign({}, prev, S);
  const m = buildEmail(sample, {asignatura:$("pfSubject2").value||"Inglés", fecha:formatFecha(todayStr()), hora:"08:30", duracion:t("ml_dur_default"), lugar:"Sala 12", materiales:t("ml_mat_default"), contenidos:"Unit 3, vocabulary, past simple"});
  SETTINGS = prev;
  $("setPreview").textContent = t("set_subject")+": "+m.subject+"\n\n"+m.body; $("setPreview").classList.remove("hidden");
}

function loadPreset(k){
  if(!k) return;
  if(!confirm(t("set_reset_confirm"))){ $("setPreset").value = ""; return; }
  $("setSubjectTpl").value = k==="reg" ? t("tpl_sj_subject") : t("tpl_subject_default");
  $("setBodyTpl").value = k==="reg" ? t("tpl_sj_body") : t("tpl_body_default");
  $("setPreset").value = "";
  msg($("setMsg"), t("pr_loaded"), "ok");
}
