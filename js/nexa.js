/* NEXA: puntos por voz y comandos ("NEXA, [alumno], más dos" / "Hey NEXA" / "show results" / "select a student at random").
   Los comandos de saludo, podio y sorteo se transmiten a otras pantallas abiertas con la misma cuenta (users/{uid}/voiceCmd). */
let voiceRec = null, voiceOn = false, voiceToastTimer = null;
const DEVICE_ID = Math.random().toString(36).slice(2,10), VOICE_START = Date.now();
const WAKE = new Set(["nexa","nexsa","necsa","neksa","nexia","nexta","nesa","nexus"]);
const FILLERS = new Set(["hey","ey","oye","hola"]);
const RESULTS_W = new Set(["resultados","resultado","results","result","podio","ranking","puntajes","puntaje","show","muestrame","muéstrame"]);
const DRAW_W = new Set(["select","selecciona","seleccionar","student","students","estudiante","alumno","alumna","random","aleatorio","azar","draw","pick","choose","sorteo","sortear"]);
const STOPW = new Set(["nexa","hey","ey","oye","hola","mas","más","uno","dos","one","two","the","punto","puntos","para","de","del","la","el","a"]);
const FALSE_WAKE = new Set(["nexo","nexos"]);
function levenshtein(a,b){
  const dp = Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) dp[i][0]=i; for(let j=0;j<=b.length;j++) dp[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[a.length][b.length];
}
function isWake(tok){
  if(!tok || tok.length<3 || tok.length>8 || FALSE_WAKE.has(tok)) return false;
  return WAKE.has(tok) || levenshtein(tok,"nexa")<=1;
}
function playSnd(key, src){
  if(!SOUND_ON) return;
  try{ playSnd.c = playSnd.c || {}; if(!playSnd.c[key]) playSnd.c[key] = new Audio(src); playSnd.c[key].currentTime = 0; playSnd.c[key].play().catch(()=>{}); }catch(e){}
}
const playNexaWelcome = () => playSnd("w", SND_NEXA_WELCOME);
const playNexaResults = () => playSnd("r", SND_NEXA_RESULTS);
const playNexaDraw = () => playSnd("d", SND_NEXA_DRAW);

function voiceToast(msg, undoId){
  let el = $("voiceToast");
  if(!el){ el = document.createElement("div"); el.id = "voiceToast"; el.className = "voice-toast"; document.body.appendChild(el); }
  el.innerHTML = "<span>"+esc(msg)+"</span>"+(undoId?'<button id="voiceUndoBtn">'+esc(t("undo"))+'</button>':"");
  if(undoId) $("voiceUndoBtn").addEventListener("click",()=>{ removeLastPoint(undoId); el.classList.remove("show"); });
  el.classList.add("show"); clearTimeout(voiceToastTimer); voiceToastTimer = setTimeout(()=>el.classList.remove("show"), 3500);
}
function broadcastVoice(cmd){ try{ uref("voiceCmd").set(Object.assign({from:DEVICE_ID, ts:Date.now()}, cmd)); }catch(e){} }
/* Otra pantalla (ej. el PC del aula) recibe el comando y reacciona igual */
function onVoiceCmd(c){
  if(!c || c.from===DEVICE_ID || !c.ts || c.ts<VOICE_START) return;
  if(c.type==="greeting") playNexaWelcome();
  else if(c.type==="podium"){ if(c.cls) setClass(c.cls); playNexaResults(); showTab("podium"); }
  else if(c.type==="draw"){ if(c.cls) setClass(c.cls); const w = STUDENTS[c.winnerId]; if(w){ playNexaDraw(); openTool("draw"); startRandomDraw(Object.assign({id:c.winnerId}, w)); } }
}

function handleVoice(raw){
  const tokens = Importer.slug(raw).split("-").filter(Boolean);
  if(!tokens.some(isWake)) return;
  const rest = tokens.filter(x=>!isWake(x) && !FILLERS.has(x));
  if(!rest.length){ playNexaWelcome(); broadcastVoice({type:"greeting"}); voiceToast(t("vz_hello")); return; }
  if(rest.some(x=>RESULTS_W.has(x))){
    if(!curClass){ voiceToast(t("vz_pick")); return; }
    playNexaResults(); showTab("podium"); broadcastVoice({type:"podium", cls:curClass}); voiceToast(t("vz_podium")+" "+curClass); return;
  }
  if(rest.some(x=>DRAW_W.has(x))){
    if(!curClass){ voiceToast(t("vz_pick")); return; }
    const {all, remaining} = drawPool();
    if(!all.length){ voiceToast(t("dr_none")); return; }
    const pool = remaining.length ? remaining : all, w = pool[Math.floor(Math.random()*pool.length)];
    playNexaDraw(); openTool("draw"); broadcastVoice({type:"draw", cls:curClass, winnerId:w.id}); startRandomDraw(w); return;
  }
  if(!curClass){ voiceToast(t("vz_pick")); return; }
  let pts = null;
  if(tokens.includes("uno")||tokens.includes("1")||tokens.includes("one")) pts = 1;
  if(tokens.includes("dos")||tokens.includes("2")||tokens.includes("two")) pts = 2;
  const nameTk = tokens.filter(x=>!STOPW.has(x) && !isWake(x) && x.length>=3);
  let best = null, bestScore = 0, tie = false;
  classStudents().forEach(s=>{
    const score = Importer.slug(s.name).split("-").filter(x=>nameTk.includes(x)).length;
    if(score>bestScore){ bestScore = score; best = s; tie = false; } else if(score===bestScore && score>0) tie = true;
  });
  if(!best || !bestScore){ voiceToast(t("vz_noname")); return; }
  if(tie){ voiceToast(t("vz_tie")); return; }
  if(pts===null){ voiceToast(t("vz_nopts")+" "+best.name); return; }
  uref("history/"+best.id).push({t:Date.now(), p:pts, r:"participacion", d:todayStr()});
  playEarn(); voiceToast("✅ +"+pts+" → "+best.name, best.id);
}
function removeLastPoint(id){
  const h = HISTORY[id]; if(!h) return;
  let key = null, tmax = -1; Object.keys(h).forEach(k=>{ if((h[k].t||0)>=tmax){ tmax = h[k].t||0; key = k; } });
  if(key) uref("history/"+id+"/"+key).remove();
}

function initVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR) return null;
  const rec = new SR(); rec.lang = LANG==="en" ? "en-US" : "es-CL"; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onresult = e=>{ for(let i=e.resultIndex;i<e.results.length;i++) if(e.results[i].isFinal) handleVoice(e.results[i][0].transcript); };
  rec.onerror = e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed"){ voiceOn = false; voiceUI(); alert(t("vz_denied")); } };
  rec.onend = ()=>{ if(voiceOn){ try{ rec.start(); }catch(e){} } };
  return rec;
}
function toggleVoice(){
  if(voiceOn){ stopVoice(); return; }
  if(!curClass){ alert(t("vz_pick_alert")); return; }
  if(!(window.SpeechRecognition||window.webkitSpeechRecognition)){ alert(t("vz_unsupported")); return; }
  voiceRec = initVoice();
  try{ voiceRec.start(); voiceOn = true; voiceUI(); }catch(e){ console.warn(e); }
}
function stopVoice(){ voiceOn = false; if(voiceRec){ try{ voiceRec.stop(); }catch(e){} } voiceUI(); }
function voiceUI(){
  const b = $("voiceToggleBtn"); if(!b) return;
  b.classList.toggle("voice-on", voiceOn); b.textContent = voiceOn ? t("vz_on") : t("vz_off");
  $("voiceStatus").classList.toggle("active", voiceOn);
}
