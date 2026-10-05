/* Calendario: gráfico de la semana, mes con actividad y "Interesting Fact of the Day" (uno distinto por día). */
let calView = new Date();
function dayOfYear(d){ return Math.floor((d - new Date(d.getFullYear(),0,0))/86400000); }
function factFor(d){ return FACTS[dayOfYear(d) % FACTS.length]; }
const locale = () => LANG==="en" ? "en-US" : "es-CL";
/* { "YYYY-MM-DD": { studentId: puntos } } solo de los estudiantes del curso elegido (o todos) */
function eventsByDay(){
  const map = {}, ids = new Set(curClass ? classStudents().map(s=>s.id) : Object.keys(STUDENTS));
  ids.forEach(id=>{
    const h = HISTORY[id]; if(!h) return;
    Object.values(h).forEach(e=>{ if(!e.d) return; (map[e.d] = map[e.d] || {})[id] = ((map[e.d]||{})[id]||0) + (Number(e.p)||0); });
  });
  return map;
}
function dayTotal(m){ return m ? Object.values(m).reduce((a,b)=>a+b,0) : 0; }
function renderCalendar(){
  if(!$("calgrid")) return;
  $("calClassLabel").textContent = curClass ? "· "+curClass : "("+t("cal_all")+")";
  const ev = eventsByDay();
  const mon = new Date(); mon.setHours(0,0,0,0); mon.setDate(mon.getDate() - ((mon.getDay()+6)%7));
  const days = [0,1,2,3,4].map(i=>{ const d = new Date(mon); d.setDate(d.getDate()+i); return d; });
  const totals = days.map(d=>dayTotal(ev[dstr(d)])), max = Math.max(1,...totals);
  $("weekchart").innerHTML = totals.map((n,i)=>'<div class="wbar"><div class="bar" style="height:'+((n/max*100)||2)+'%"></div><span>'+days[i].toLocaleDateString(locale(),{weekday:"short"})+'<br><b style="color:#fff">'+n+'</b></span></div>').join("");
  const y = calView.getFullYear(), m = calView.getMonth();
  $("monthLabel").textContent = calView.toLocaleDateString(locale(),{month:"long",year:"numeric"});
  const off = (new Date(y,m,1).getDay()+6)%7, dim = new Date(y,m+1,0).getDate(), tk = todayStr();
  let h = [0,1,2,3,4,5,6].map(i=>{ const d = new Date(2024,0,1+i); return '<div class="dow">'+d.toLocaleDateString(locale(),{weekday:"short"})+'</div>'; }).join("");
  for(let i=0;i<off;i++) h += '<div class="daycell empty"></div>';
  for(let d=1; d<=dim; d++){
    const dt = new Date(y,m,d), key = dstr(dt), wk = dt.getDay()===0||dt.getDay()===6, cnt = dayTotal(ev[key]);
    h += '<div class="daycell'+(wk?" weekend":"")+(cnt?" has-activity":"")+(key===tk?" today":"")+'" data-k="'+key+'"><span class="n">'+d+'</span>'+(cnt?'<span class="cnt">+'+cnt+'</span>':"")+'<span class="fact-dot">✨</span></div>';
  }
  $("calgrid").innerHTML = h;
  $("calgrid").querySelectorAll("[data-k]").forEach(c=>c.addEventListener("click",()=>openDay(c.dataset.k)));
}
function changeMonth(d){ calView.setMonth(calView.getMonth()+d); renderCalendar(); }
function goToday(){ calView = new Date(); renderCalendar(); }
function openDay(key){
  const dt = new Date(key+"T12:00:00"), day = eventsByDay()[key] || {};
  $("dayTitle").textContent = "📅 "+dt.toLocaleDateString(locale(),{weekday:"long",day:"numeric",month:"long"});
  const f = factFor(dt);
  const rows = Object.keys(day).map(id=>({s:STUDENTS[id], p:day[id]})).filter(x=>x.s).sort((a,b)=>b.p-a.p);
  $("dayBody").innerHTML =
    '<div class="fact-card" style="--fc1:'+f.c1+';--fc2:'+f.c2+'"><div class="fact-eyebrow">✨ Interesting Fact of the Day</div>'+
    '<div class="fact-icon-wrap"><div class="fact-icon-ring"></div><div class="fact-icon">'+f.emoji+'</div></div>'+
    '<div class="fact-title">'+esc(f.title)+'</div><p class="fact-text">'+esc(f.fact)+'</p></div><hr class="fact-divider">'+
    '<div class="day-activity-title">📊 '+esc(t("cal_activity"))+'</div>'+
    (rows.length ? rows.map(x=>'<div class="event-row"><span>'+esc(x.s.name)+' <span class="tagcls" style="background:'+clsColor(x.s.cls)+'">'+esc(x.s.cls)+'</span></span><b>+'+x.p+'</b></div>').join("") : '<p style="color:var(--muted)">'+esc(t("cal_none"))+'</p>');
  $("dayModalBg").classList.add("show");
}
function closeDay(){ $("dayModalBg").classList.remove("show"); }
