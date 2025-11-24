// public/hudStream.js (merge timers + dedup same tag)
(function () {
  'use strict';

  const LS_PJS='__iiHUD_PJs', LS_CH='__iiHUD_Channel';
  const DEFAULT_CHANNEL='session-1', POLL_MS=5000, DEBOUNCE_MS=200;
  const sp = new URLSearchParams(location.search);
  const WS_URL = sp.get('ws') || (location.protocol==='https:'?'wss':'ws')+'://127.0.0.1:8091/hud';
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const qFirst=(arr,root)=>{ for(const s of arr){ const el=$(s,root); if(el) return el; } return null; };
  const pjSetFromLS = ()=> new Set((localStorage.getItem(LS_PJS)||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  const getChannel = ()=> localStorage.getItem(LS_CH) || (localStorage.setItem(LS_CH, DEFAULT_CHANNEL), DEFAULT_CHANNEL);

  function norm(x){ return (x||'').replace(/\s+/g,' ').trim(); }
  function isAdminText(t){ return /^(add|remove|ajouter|retirer)\b/i.test(t); }

  function extractTagsFromRow(tr){
    const selectors = [
      '.combatant__tags .tag','.combatant__tags [class*="tag"]',
      '.tags .tag','.tags [class*="tag"]',
      '.conditions .condition','.status .status-item',
      '.badges .badge','[data-tag]','[data-badge]',
      '[class*="tag"]','[class*="badge"]','[class*="condition"]','[class*="status"]'
    ].join(',');
    const nodes = $$(selectors, tr);
    const temp=[], seenRaw=new Set();
    let last = null;

    for(const el of nodes){
      if (el.tagName==='BUTTON') continue;
      if (/\b(add|remove)\b/i.test(el.className||'')) continue;

      let text = norm(el.getAttribute('data-text') || el.getAttribute('aria-label') || el.textContent);
      if (!text) continue;

      // timer isolé: "8" → merge avec le précédent
      if (/^\d{1,3}$/.test(text)){
        if (last) { last.text += ` (${text})`; }
        continue;
      }
      if (isAdminText(text)) continue;

      text = text.replace(/^[:\-\s]+|[:\-\s]+$/g,''); // nettoie
      // collé: "Poisoned8" → "Poisoned (8)"
      const m = text.match(/^(.+?)\s*(\d{1,3})$/);
      if (m) text = `${m[1]} (${m[2]})`;

      const keyRaw = text.toLowerCase();
      if (seenRaw.has(keyRaw)) { last = temp[temp.length-1] || null; continue; }

      const gmAttr=el.getAttribute('data-gm')||el.getAttribute('data-hidden')||el.getAttribute('data-gmonly');
      const gmClass=/\bgm\b|\bgm-only\b|\bgmonly\b/i.test(el.className||'');
      const isGM=!!(gmAttr==='true'||gmClass||/^gm:|^_/i.test(text));

      last = { text, gm:isGM };
      temp.push(last);
      seenRaw.add(keyRaw);
    }

    // DEDUP : fusionne "Poisoned" et "Poisoned (5)" → garder la version avec timer (plus grand si plusieurs)
    const map = new Map(); // base -> tag
    const base = t => (t.text||'').replace(/\s*\(\d{1,3}\)\s*$/,'').trim().toLowerCase();
    const timerOf = t => { const m = (t.text||'').match(/\((\d{1,3})\)$/); return m ? Number(m[1]) : null; };

    for (const t of temp){
      const b = base(t);
      const cur = map.get(b);
      if (!cur) { map.set(b, t); continue; }
      const aT = timerOf(cur), bT = timerOf(t);
      if (aT == null && bT != null) map.set(b, t);
      else if (aT != null && bT != null && bT > aT) map.set(b, t);
      else cur.gm = cur.gm || t.gm;
    }
    return Array.from(map.values());
  }

  function extractHiddenFromRow(tr){
    const cls=(tr.className||'').toLowerCase();
    if (/\bhidden\b|\bis-hidden\b|\bcombatant--hidden\b/.test(cls)) return true;
    const icon=tr.querySelector('[title*="hidden" i],[aria-label*="hidden" i],[class*="eye"][class*="slash"]');
    if(icon) return true;
    if (tr.getAttribute('data-hidden')==='true') return true;
    return false;
  }

  function isActiveRow(tr){
    const cls = tr?.className || '';
    if (['active','combatant--active','is-active'].some(m=>cls.includes(m))) return true;
    return !!tr?.querySelector?.('.active,.combatant--active,.is-active');
  }
  function resolvePortraitSrc(tr){
    try{
      const img = tr.querySelector('td.combatant__image-cell img, td:nth-child(3) img');
      if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
      const cell = tr.querySelector('td.combatant__image-cell, td:nth-child(3)');
      if (cell) { const bg = getComputedStyle(cell).backgroundImage||''; const m=bg.match(/url\(["']?(.+?)["']?\)/i); if(m&&m[1]) return m[1]; }
    }catch{} return null;
  }

  function collectState(){
    try{
      const rows=$$('.combatants tbody tr'); const PJS=pjSetFromLS();
      const list = rows.map(tr=>{
        const nameEl=qFirst(['td.combatant__name','td:nth-child(4)'], tr);
        const hpEl  =qFirst(['td.combatant__hp','td:nth-child(5)'], tr);
        const name=(nameEl?.textContent||'?').trim();
        const hpTxt=(hpEl?.textContent||'').trim().replace(/\s+/g,'');
        const nums=hpTxt.match(/\d+/g)||[];
        const cur=Number(nums[0]??NaN), max=Number(nums[1]??NaN);
        const img=resolvePortraitSrc(tr)||null;
        const isPlayer=tr?.classList?.contains('combatant--player') || PJS.has(name.toLowerCase());
        const active=isActiveRow(tr);
        const tags=extractTagsFromRow(tr);
        const isHidden=extractHiddenFromRow(tr);
        const c={name,cur,max,isPlayer,active,img}; if(tags.length) c.tags=tags; if(isHidden) c.isHidden=true; return c;
      });
      const turn=Math.max(0,list.findIndex(x=>x.active));
      return {turn,list};
    }catch(e){ console.log('[HUD] collectState error:',e); return {turn:0,list:[]}; }
  }

  let ws=null,lastSent='',reconnectTimer=0;
  function openWS(){
    try{
      ws=new WebSocket(WS_URL);
      ws.onopen = ()=>{ sendSnapshot(true); };
      ws.onclose= ()=>{ clearTimeout(reconnectTimer); reconnectTimer=setTimeout(openWS,1000); };
      ws.onerror= ()=>{ try{ws.close();}catch{} };
    }catch{}
  }
  function sendSnapshot(force=false){
    try{
      const payload={type:'ii_state',channel:getChannel(),at:Date.now(),data:collectState()};
      const blob=JSON.stringify(payload); if(!force && blob===lastSent) return; lastSent=blob;
      if(ws && ws.readyState===1) ws.send(blob);
    }catch(e){ console.log('[HUD] send error',e); }
  }
  try{ new MutationObserver(()=>setTimeout(()=>sendSnapshot(false),DEBOUNCE_MS)).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true}); }catch{}
  setInterval(()=>sendSnapshot(false),POLL_MS);
  if(!localStorage.getItem(LS_CH)) localStorage.setItem(LS_CH, DEFAULT_CHANNEL);
  openWS(); setTimeout(()=>sendSnapshot(true),400);
  
})();
