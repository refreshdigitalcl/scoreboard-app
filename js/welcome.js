/* Popup de bienvenida con las funciones: se muestra una vez al día y se puede abrir desde el botón ❓ */
const WELCOME_ITEMS = [["🎯","wl1"],["📊","wl2"],["🏅","wl3"],["🔔","wl4"],["⏱️","wl5"],["👥","wl6"],["🎲","wl7"],["🐝","wl8"],["🎤","wl9"],["✉️","wl10"],["📅","wl11"],["⚙️","wl12"]];
function renderWelcome(){
  $("welcomeBody").innerHTML = WELCOME_ITEMS.map(([e,k])=>'<div class="wl-item"><div class="wl-emoji">'+e+'</div><div><b>'+esc(t(k+"_t"))+'</b><div class="muted small">'+esc(t(k+"_d"))+'</div></div></div>').join("");
}
function showWelcome(){ renderWelcome(); $("welcomeModalBg").classList.add("show"); }
function closeWelcome(){ $("welcomeModalBg").classList.remove("show"); }
function maybeShowWelcome(){
  if(!USER) return;
  const key = "sb_welcome__"+USER.uid, today = todayStr();
  try{ if(localStorage.getItem(key)===today) return; localStorage.setItem(key, today); }catch(e){}
  showWelcome();
}
