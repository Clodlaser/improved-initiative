// public/hudStream.js
(function () {
  'use strict';

  const LS_PJS='__iiHUD_PJs', LS_CH='__iiHUD_Channel';
  const DEFAULT_CHANNEL='session-1', POLL_MS=5000, DEBOUNCE_MS=200;

  // Par défaut on pousse vers le WS dédié (8091). Override possible via ?ws=
  const p = new URLSearchParams(location.search);
  const WS_URL = p.get('ws') || 'ws://127.0.0.1:8091/hud';
  console.log('[HUD] WS_URL =', WS_URL);

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const qFirst=(arr,root)=>{ for(const s of arr){ const el=$(s,root); if(el) return el; } return null; };

  const pjSetFromLS = ()=>{
    const raw = localStorage.getItem(LS_PJS) || '';
    return new Set(raw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  };
  const getChannel = ()=>{
    let ch = localStorage.getItem(LS_CH);
    if (!ch) { ch = DEFAULT_CHANNEL; localStorage.setItem(LS_CH, ch); }
    return ch;
  };

  function isActiveRow(tr){
    const cls = tr.className || '';
    if (['active','combatant--active','is-active'].some(m=>cls.includes(m))) return true;
    return !!tr.querySelector('.active,.combatant--active,.is-active');
  }

  function resolvePortraitSrc(tr){
    const img = tr.querySelector('td.combatant__image-cell img, td:nth-child(3) img');
    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
    const cell = tr.querySelector('td.combatant__image-cell, td:nth-child(3)');
    if (cell) {
      const bg = getComputedStyle(cell).backgroundImage || '';
      const m = bg.match(/url\(["']?(.+?)["']?\)/i);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  function collectState(){
    const rows = $$('.combatants tbody tr');
    const PJS  = pjSetFromLS();
    const list = rows.map(tr=>{
      const nameEl = qFirst(['td.combatant__name','td:nth-child(4)'], tr);
      const hpEl   = qFirst(['td.combatant__hp','td:nth-child(5)'], tr);
      const name   = (nameEl?.textContent||'?').trim();
      const hpTxt  = (hpEl?.textContent||'').trim().replace(/\s+/g,'');
      const nums   = hpTxt.match(/\d+/g) || [];
      const cur    = Number(nums[0] ?? NaN);
      const max    = Number(nums[1] ?? NaN);
      const img    = resolvePortraitSrc(tr) || null; // URL (pas de base64)
      const isPlayer = tr.classList?.contains('combatant--player') || PJS.has(name.toLowerCase());
      const active   = isActiveRow(tr);
      return { name, cur, max, isPlayer, active, img };
    });
    const turn = Math.max(0, list.findIndex(x=>x.active));
    return { turn, list };
  }

  // petit indicateur
  const IND_ID='__iiHUD_Indicator';
  if (!document.getElementById(IND_ID)) {
    const style=document.createElement('style');
    style.textContent=`#${IND_ID}{position:fixed;right:16px;bottom:16px;z-index:99999;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 10px;font:600 12px/1.2 ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;backdrop-filter:blur(4px);box-shadow:0 8px 22px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;user-select:none}
    #${IND_ID} .dot{width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,.25)}
    #${IND_ID} .dot.off{background:#8a8a8a} #${IND_ID} .dot.reco{background:#ffb257} #${IND_ID} .dot.ok{background:#42d07c}
    #${IND_ID} .pill{background:rgba(255,255,255,.10); padding:4px 6px; border-radius:7px; font-weight:700}`;
    document.head.appendChild(style);
    const ind=document.createElement('div');
    ind.id=IND_ID;
    ind.innerHTML=`<span class="dot off" id="iiDot"></span><span class="pill" id="iiChan">—</span>`;
    document.body.appendChild(ind);
  }
  const setDot=k=>{ document.getElementById('iiDot').className='dot '+(k||'off'); };
  const updateIndicator=()=>{ document.getElementById('iiChan').textContent = getChannel(); };
  updateIndicator();

  let ws=null, lastSent='', reconnectTimer=0;

  function openWS(){
    try{
      setDot('reco');
      ws = new WebSocket(WS_URL);
      console.log('[HUD] connecting…');

      ws.onopen = ()=>{ console.log('[HUD] OPEN'); setDot('ok'); sendSnapshot(true); };
      ws.onclose= e  =>{ console.log('[HUD] CLOSE', e.code, e.reason); setDot('reco'); clearTimeout(reconnectTimer); reconnectTimer=setTimeout(openWS,1000); };
      ws.onerror= e  =>{ console.log('[HUD] ERROR', e); try{ws.close();}catch{} };
    }catch(err){ console.log('[HUD] WS ctor failed', err); }
  }

  function sendSnapshot(force=false){
    const payload = { type:'ii_state', channel:getChannel(), at:Date.now(), data:collectState() };
    const blob = JSON.stringify(payload);
    if (!force && blob===lastSent) return;
    lastSent = blob;
    if (ws && ws.readyState === 1) { console.log('[HUD] send ii_state', payload); ws.send(blob); }
    else { console.log('[HUD] WS not ready'); }
  }

  new MutationObserver(()=>setTimeout(()=>sendSnapshot(false),DEBOUNCE_MS))
    .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
  setInterval(()=>sendSnapshot(false),POLL_MS);

  if (!localStorage.getItem(LS_CH)) localStorage.setItem(LS_CH, DEFAULT_CHANNEL);
  openWS();
  setTimeout(()=>sendSnapshot(true),400);
})();
