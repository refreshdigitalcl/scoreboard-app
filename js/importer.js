/* Lógica pura de importación (sin DOM) — se puede probar en Node. */
const Importer = (function(){
  const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  const norm = s => String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const slug = s => norm(s).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const clean = v => String(v==null?"":v).replace(/\s+/g," ").trim();

  /* sheets: [{name, rows:[[cell,...],...]}]. Detecta la fila de encabezados de cada hoja. */
  function parseSheets(sheets){
    return sheets.map(sh=>{
      const rows = sh.rows || [];
      let hi = -1;
      for(let i=0;i<Math.min(rows.length,20);i++){
        const filled = (rows[i]||[]).filter(c=>clean(c)!=="").length;
        if(filled>=2){ hi = i; break; }
      }
      if(hi<0) return {name:sh.name, headers:[], data:[]};
      const seen = {};
      const headers = rows[hi].map(clean).map(h=>{ if(!h) return h; seen[h]=(seen[h]||0)+1; return seen[h]>1 ? h+" ("+seen[h]+")" : h; });
      const data = rows.slice(hi+1).filter(r=>(r||[]).some(c=>clean(c)!==""));
      return {name:sh.name, headers, data};
    }).filter(s=>s.headers.length);
  }

  /* Adivina qué columna es qué, por nombre de encabezado. */
  function guessMapping(headers){
    const find = res => { for(const re of res){ const i = headers.findIndex(h=>re.test(norm(h))); if(i>=0) return headers[i]; } return ""; };
    const email1 = find([/(apoderado|tutor|padre|father).*(mail|correo)/,/(mail|correo).*(apoderado|tutor|padre|father|1)/,/^(e-?mail|correo)/,/mail|correo/]);
    let email2 = find([/(madre|mother).*(mail|correo)/,/(mail|correo).*(madre|mother|2)/,/(apoderado|tutor).*2.*(mail|correo)/]);
    if(email2===email1) email2 = "";
    if(!email2){ const rest = headers.filter(h=>/mail|correo/.test(norm(h)) && h!==email1); if(rest.length) email2 = rest[0]; }
    return {
      cls: find([/^(curso|course|class|grado|grade|nivel)/,/curso|class|grado/]),
      name: find([/^(nombre|name|alumn|estudiante|student)/,/nombre|name|alumn|estudiante/]),
      email1, email2
    };
  }

  /* Combina todo en la lista final de estudiantes. map: {cls,name,email1,email2}; classFromSheet: bool */
  function buildStudents(parsed, map, classFromSheet){
    const out = {}; let dups = 0, total = 0;
    parsed.forEach(sh=>{
      const idx = h => h ? sh.headers.indexOf(h) : -1;
      const ci = idx(map.cls), ni = idx(map.name), e1 = idx(map.email1), e2 = idx(map.email2);
      if(ni<0) return;
      sh.data.forEach(r=>{
        const name = clean(r[ni]);
        const cls = classFromSheet ? clean(sh.name) : (ci>=0 ? clean(r[ci]) : "");
        if(!name || !cls) return;
        total++;
        const id = slug(cls)+"::"+slug(name);
        const mails = [e1>=0?clean(r[e1]):"", e2>=0?clean(r[e2]):""].map(x=>x.toLowerCase());
        if(out[id]){ dups++; mails.forEach((m,i)=>{ if(m && !out[id].mails[i]) out[id].mails[i]=m; }); return; }
        out[id] = {id, name, cls, mails};
      });
    });
    const list = Object.values(out);
    let withEmail=0, noEmail=0, invalid=0;
    list.forEach(s=>{
      const given = s.mails.filter(Boolean);
      if(!given.length) noEmail++;
      else if(given.some(m=>!EMAIL_RE.test(m))) invalid++;
      else withEmail++;
    });
    const classes = [...new Set(list.map(s=>s.cls))];
    return {list, classes, stats:{total:list.length, withEmail, noEmail, invalid, dups}};
  }
  /* Deja solo los cursos elegidos y recalcula las estadísticas. */
  function filterByClasses(built, selected){
    const sel = selected instanceof Set ? selected : new Set(selected);
    const list = built.list.filter(s=>sel.has(s.cls));
    let withEmail=0, noEmail=0, invalid=0;
    list.forEach(s=>{
      const given = s.mails.filter(Boolean);
      if(!given.length) noEmail++;
      else if(given.some(m=>!EMAIL_RE.test(m))) invalid++;
      else withEmail++;
    });
    return {list, classes:[...new Set(list.map(s=>s.cls))], stats:{total:list.length, withEmail, noEmail, invalid, dups:0}};
  }

  /* ---------- Migración desde el Scoreboard anterior ---------- */
  const ckey = c => norm(c).replace(/[^a-z0-9]/g,"");
  function guessClass(oldCls, newClasses){
    const ok = ckey(oldCls), map = {};
    newClasses.forEach(n=>{ map[ckey(n)] = n; });
    if(map[ok]) return map[ok];
    const m = /^(\d)m([a-z])$/.exec(ok);              // 1MB -> 1EMB
    if(m && map[m[1]+"em"+m[2]]) return map[m[1]+"em"+m[2]];
    return "";
  }
  const toks = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  function matchStudent(oldName, cands){
    const a = toks(oldName), aset = new Set(a);
    const exact = cands.filter(c=>{ const b = toks(c.name); return b.length===a.length && b.every(x=>aset.has(x)); });
    if(exact.length===1) return exact[0];
    if(exact.length>1) return null;
    const sub = cands.filter(c=>{ const b = toks(c.name), bset = new Set(b); return a.every(x=>bset.has(x)) || b.every(x=>aset.has(x)); });
    return sub.length===1 ? sub[0] : null;
  }
  /* backup: objeto {students:{id:{name,cls,history:[{d,t,p,r}]}}}; newStudents: {id:{name,cls}}; classMap: {viejo:nuevo} */
  function planMigration(backup, newStudents, classMap, addIds){
    const byCls = {}, addSet = addIds instanceof Set ? addIds : new Set(addIds||[]);
    Object.keys(newStudents).forEach(id=>{ const s = newStudents[id]; (byCls[s.cls] = byCls[s.cls] || []).push({id, name:s.name}); });
    const matches = [], unmatched = [], updates = {}, adds = {}; let entries = 0, points = 0;
    Object.keys(backup.students||{}).forEach(oldId=>{
      const o = backup.students[oldId];
      const hist = Array.isArray(o.history) ? o.history : [];
      if(!hist.length) return;
      const target = classMap[o.cls], pts = hist.reduce((a,h)=>a+(Number(h.p)||0),0);
      if(!target){ unmatched.push({oldId, name:o.name, cls:o.cls, why:"class", pts}); return; }
      let m = matchStudent(o.name, byCls[target]||[]);
      if(!m){
        if(addSet.has(oldId)){ m = {id: slug(target)+"::"+slug(o.name)}; adds[m.id] = {name:clean(o.name), cls:target}; }
        else { unmatched.push({oldId, name:o.name, cls:o.cls, why:"student", pts, target}); return; }
      }
      matches.push({oldName:o.name, newId:m.id, n:hist.length, added:!!adds[m.id]});
      hist.forEach((h,i)=>{
        const p = Number(h.p)||0; if(!p || !h.d) return;
        updates["history/"+m.id+"/i"+(h.t||0)+"_"+i] = {t:h.t||0, p, r:h.r||"participacion", d:h.d};
        entries++; points += p;
      });
    });
    return {matches, unmatched, updates, adds, entries, points};
  }
  return {EMAIL_RE, norm, slug, clean, parseSheets, guessMapping, buildStudents, filterByClasses, guessClass, matchStudent, planMigration};
})();
if(typeof module!=="undefined") module.exports = Importer;
