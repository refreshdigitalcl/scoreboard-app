/* Respaldos: uno automático por día (al abrir la app), manuales y descarga a Excel / JSON.
   Datos: users/{uid}/backups/{clave} y users/{uid}/backupIndex/{clave}=timestamp. Se conservan los 20 más recientes. */
const BK_KEEP = 20;
let BK_INDEX = {};
function bkSnapshot(){ return {ts:Date.now(), students:STUDENTS||{}, history:HISTORY||{}, settings:SETTINGS||{}, profile:PROFILE||{}}; }
function pad(n){ return String(n).padStart(2,"0"); }
function bkKeyNow(manual){ const d = new Date(); const day = d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); return manual ? day+"_"+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()) : day; }
async function bkLoadIndex(){ try{ const s = await uref("backupIndex").once("value"); BK_INDEX = s.val() || {}; }catch(e){ BK_INDEX = {}; } }
async function bkWrite(key, label){
  const snap = bkSnapshot(); snap.label = label||"";
  await uref("backups/"+key).set(snap); await uref("backupIndex/"+key).set(snap.ts); BK_INDEX[key] = snap.ts;
  const keys = Object.keys(BK_INDEX).sort();
  while(keys.length>BK_KEEP){ const old = keys.shift(); await uref("backups/"+old).remove(); await uref("backupIndex/"+old).remove(); delete BK_INDEX[old]; }
}
async function maybeAutoBackup(){
  if(!USER || !Object.keys(STUDENTS||{}).length) return;
  await bkLoadIndex();
  const k = bkKeyNow(false);
  if(!BK_INDEX[k]){ try{ await bkWrite(k, "auto"); }catch(e){ console.warn("backup", e); } }
  bkRender();
}
async function bkNow(){
  try{ await bkLoadIndex(); await bkWrite(bkKeyNow(true), "manual"); msg($("bkMsg"), t("bk_created"), "ok"); bkRender(); }
  catch(e){ console.error(e); msg($("bkMsg"), t("err_generic")); }
}
async function bkRender(){
  if(!$("bkList")) return;
  await bkLoadIndex();
  const keys = Object.keys(BK_INDEX).sort().reverse();
  $("bkList").innerHTML = keys.length ? keys.map(k=>'<div class="mail-result-item"><div><div class="mri-name">'+esc(new Date(BK_INDEX[k]).toLocaleString(LANG==="en"?"en-US":"es-CL"))+'</div><div class="mri-to">'+esc(k)+'</div></div><button class="btn" data-restore="'+esc(k)+'">'+esc(t("bk_restore"))+'</button></div>').join("") : '<span class="muted small">'+esc(t("bk_none"))+'</span>';
  $("bkList").querySelectorAll("[data-restore]").forEach(b=>b.addEventListener("click",()=>bkRestore(b.dataset.restore)));
}
async function bkRestore(key){
  if(!confirm(t("bk_restore_confirm")+" ("+key+")")) return;
  try{
    await bkLoadIndex(); await bkWrite(bkKeyNow(true), "pre-restore");
    const b = (await uref("backups/"+key).once("value")).val();
    if(!b) throw new Error("empty");
    await uref().update({students:b.students||null, history:b.history||null, settings:b.settings||null});
    msg($("bkMsg"), t("bk_restored"), "ok");
  }catch(e){ console.error(e); msg($("bkMsg"), t("err_generic")); }
}
function bkExcel(){
  const today = todayStr(), monday = mondayStr(), month = today.slice(0,7);
  const list = studentList().sort((a,b)=>a.cls===b.cls ? a.name.localeCompare(b.name) : a.cls.localeCompare(b.cls,undefined,{numeric:true}));
  const sum = [[t("col_class"),t("col_name"),t("col_email1"),t("col_email2"),t("th_today"),t("th_week"),t("rank_month"),t("th_total")]];
  const hist = [[t("bk_date"),t("col_class"),t("col_name"),t("pts"),t("bk_reason")]];
  list.forEach(s=>{ const p = pointsFor(s.id,today,monday,month); sum.push([s.cls,s.name,s.email1||"",s.email2||"",p.today,p.week,p.month,p.total]);
    Object.values(HISTORY[s.id]||{}).sort((a,b)=>(a.t||0)-(b.t||0)).forEach(e=>hist.push([e.d,s.cls,s.name,e.p,e.r||""])); });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "Resumen"); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hist), "Historial");
  XLSX.writeFile(wb, "scoreboard_respaldo_"+today+".xlsx");
}
function bkJson(){
  const blob = new Blob([JSON.stringify(bkSnapshot(),null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "scoreboard_respaldo_"+todayStr()+".json"; a.click();
}
