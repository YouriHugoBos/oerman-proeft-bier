/* ══════════════ CAVEMAN BEER TASTING ══════════════
   Volledig client-side. Geen server. Config zit in de URL-hash.
   Spelleider vult biertjes in -> QR. Spelers scannen -> spelen -> score.
*/

// ── Constants ──────────────────────────────────────────────
const TYPES = ['Pils','Witbier','IPA','Tripel','Dubbel','Blond','Weizen','Quadrupel/Bok'];
const SMAAK = [
  {v:'fris',    label:'🌊 FRIS'},
  {v:'fruitig', label:'🍓 FRUITIG'},
  {v:'moutig',  label:'🍞 MOUTIG'},
  {v:'bitter',  label:'🌿 BITTER'},
];
const PTS = { type:2, hazy:1, smaak:1, abvFull:2, abvHalf:1, name:5 };

// Oer-koppen: tik op je gezicht om mee te doen. Voeg toe door een foto in
// /characters te zetten en hier een regel {f, n} bij te schrijven.
const CHARACTERS = [
  {f:'characters/bosman.png',       n:'BOSMAN'},
  {f:'characters/brum-meh-man.png', n:'BRUM-MEH-MAN'},
  {f:'characters/jewjew.png',       n:'JEWJEW'},
  {f:'characters/lieblieb.png',     n:'LIEBLIEB'},
  {f:'characters/luideman.png',     n:'LUIDEMAN'},
  {f:"characters/siee-man.png",     n:"SIEE'MAN"},
  {f:"characters/tomu-tommuh.png",  n:"TOMU'TOMMUH"},
];

// ── DOM helpers ────────────────────────────────────────────
const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const el = (tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const show = id => { $$('.screen').forEach(s=>s.classList.add('hidden')); $('#'+id).classList.remove('hidden'); window.scrollTo(0,0); };
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.add('hidden'),2200);}

// ── UTF-8 safe base64 (url-friendly) ───────────────────────
function b64encode(str){
  const bytes = new TextEncoder().encode(str);
  let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64decode(b64){
  b64 = b64.replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── Name matching (soepel) ─────────────────────────────────
function normName(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')   // diacritics weg
    .replace(/[^a-z0-9]+/g,'')                          // alleen letters/cijfers
    .trim();
}
function levenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m) return n; if(!n) return m;
  let prev=[...Array(n+1).keys()];
  for(let i=1;i<=m;i++){
    let cur=[i];
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    prev=cur;
  }
  return prev[n];
}
function nameCorrect(guess, actual){
  const g=normName(guess), a=normName(actual);
  if(!g||!a) return false;
  if(g===a) return true;
  const tol = a.length<=4 ? 1 : 2;            // kleine typo-marge
  return levenshtein(g,a) <= tol;
}

// ── Scoring ────────────────────────────────────────────────
function scoreBeer(answer, key){
  // answer & key: {t,h,s,a,n}
  const r = {type:0,hazy:0,smaak:0,abv:0,name:0,details:[]};
  // soort
  const typeOk = answer.t!=null && answer.t===key.t;
  r.type = typeOk?PTS.type:0;
  r.details.push({k:'Soort', ok:typeOk, you:answer.t??'—', truth:key.t, pts:r.type});
  // hazy
  const hazyOk = answer.h!=null && Boolean(answer.h)===Boolean(key.h);
  r.hazy = hazyOk?PTS.hazy:0;
  r.details.push({k:'Hazy', ok:hazyOk, you:answer.h==null?'—':(answer.h?'ja':'nee'), truth:key.h?'ja':'nee', pts:r.hazy});
  // smaakprofiel
  const smaakOk = answer.s!=null && answer.s===key.s;
  r.smaak = smaakOk?PTS.smaak:0;
  r.details.push({k:'Smaak', ok:smaakOk, you:answer.s??'—', truth:key.s, pts:r.smaak});
  // abv
  let abvPts=0, abvOk=false;
  if(answer.a!=null && answer.a!=='' && key.a!=null){
    const diff=Math.abs(parseFloat(answer.a)-parseFloat(key.a));
    if(diff<=0.5){abvPts=PTS.abvFull;abvOk=true;}
    else if(diff<=1.0){abvPts=PTS.abvHalf;abvOk=true;}
  }
  r.abv=abvPts;
  r.details.push({k:'Alcohol%', ok:abvOk, you:(answer.a!=null&&answer.a!==''?answer.a+'%':'—'), truth:key.a+'%', pts:abvPts});
  // name
  const nameOk = nameCorrect(answer.n, key.n);
  r.name = nameOk?PTS.name:0;
  r.details.push({k:'Naam', ok:nameOk, you:answer.n||'—', truth:key.n, pts:r.name, bonus:true});

  r.total = r.type+r.hazy+r.smaak+r.abv+r.name;
  return r;
}

/* ════════════════════ SETUP MODE ════════════════════ */
let setupBeers = [];

function blankBeer(){ return {n:'', t:TYPES[0], h:false, s:'fris', a:''}; }

function renderSetup(){
  const list = $('#beer-list');
  list.innerHTML='';
  setupBeers.forEach((b,i)=>{
    const card = el('div','beer-card');
    card.innerHTML = `
      <button class="del" data-i="${i}" title="weg">🗑️</button>
      <h3>🍺 Drank ${i+1}</h3>
      <div class="field">
        <label>Naam (geheim, voor bonus)</label>
        <input data-f="n" data-i="${i}" type="text" value="${escapeAttr(b.n)}" placeholder="bijv. La Chouffe">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Soort</label>
          <select data-f="t" data-i="${i}">${TYPES.map(t=>`<option ${t===b.t?'selected':''}>${t}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Alcohol %</label>
          <input data-f="a" data-i="${i}" type="number" step="0.1" min="0" max="20" value="${b.a}" placeholder="8.0">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Hazy?</label>
          <select data-f="h" data-i="${i}">
            <option value="0" ${!b.h?'selected':''}>Nee (helder)</option>
            <option value="1" ${b.h?'selected':''}>Ja (hazy)</option>
          </select>
        </div>
        <div class="field">
          <label>Smaakprofiel</label>
          <select data-f="s" data-i="${i}">${SMAAK.map(c=>`<option value="${c.v}" ${c.v===b.s?'selected':''}>${c.label.replace(/^\S+\s/,'')}</option>`).join('')}</select>
        </div>
      </div>`;
    list.appendChild(card);
  });
}
function escapeAttr(s){return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

$('#beer-list').addEventListener('input', e=>{
  const i=+e.target.dataset.i, f=e.target.dataset.f;
  if(f==null) return;
  let v=e.target.value;
  if(f==='h') v = v==='1';
  setupBeers[i][f]=v;
});
$('#beer-list').addEventListener('click', e=>{
  if(e.target.classList.contains('del')){
    setupBeers.splice(+e.target.dataset.i,1);
    if(!setupBeers.length) setupBeers.push(blankBeer());
    renderSetup();
  }
});
$('#add-beer').addEventListener('click', ()=>{ setupBeers.push(blankBeer()); renderSetup(); window.scrollTo(0,document.body.scrollHeight); });

// ── Import vanuit ChatGPT-JSON ─────────────────────────────
function normType(s){
  if(!s) return TYPES[0];
  const x = String(s).toLowerCase().trim();
  let hit = TYPES.find(t=>t.toLowerCase()===x);
  if(hit) return hit;
  hit = TYPES.find(t=>{const tl=t.toLowerCase(); return tl.includes(x)||x.includes(tl);});
  if(hit) return hit;
  // synoniemen; verwijderde soorten remappen we naar de dichtstbijzijnde overgebleven soort
  const syn = {weizen:'Weizen',weiss:'Weizen',witbier:'Witbier',wit:'Witbier',tripel:'Tripel',tripple:'Tripel',triple:'Tripel',dubbel:'Dubbel',double:'Dubbel',quad:'Quadrupel/Bok',quadru:'Quadrupel/Bok',bok:'Quadrupel/Bok',lager:'Pils',pils:'Pils',blond:'Blond',ipa:'IPA',neipa:'IPA',stout:'Dubbel',porter:'Dubbel',sour:'Witbier',gose:'Witbier',lambic:'Witbier',saison:'Blond'};
  for(const k in syn){ if(x.includes(k)) return syn[k]; }
  return TYPES[0];
}
function normSmaak(s){
  const x = String(s||'').toLowerCase();
  if(/bitter|hoppig|hop\b|hops|stevig/.test(x)) return 'bitter';
  if(/mout|malt|zoet|sweet|karamel|caramel|toffee|chocola|choc|roost|roast|nooter/.test(x)) return 'moutig';
  if(/fruit|banaan|banana|citrus|sinaasappel|orange|tropisch|tropical|berry|bes|kers|cherry/.test(x)) return 'fruitig';
  return 'fris';
}
function normHazy(v){
  if(v===true||v===1) return true;
  if(v===false||v===0||v==null||v==='') return false;
  const x = String(v).toLowerCase().trim();
  return ['true','ja','1','hazy','troebel','yes','nevelig'].includes(x);
}
function normAbv(v){
  if(v==null||v==='') return '';
  const n = parseFloat(String(v).replace(',','.').replace('%',''));
  return isNaN(n) ? '' : n;
}
function parseImport(raw){
  let txt = raw.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  let data = JSON.parse(txt);
  if(!Array.isArray(data)) data = data.beers||data.biertjes||data.bieren||data.b;
  if(!Array.isArray(data)) throw new Error('geen lijst');
  return data.map(o=>({
    n: String(o.naam ?? o.name ?? o.n ?? '').trim(),
    t: normType(o.soort ?? o.type ?? o.t),
    h: normHazy(o.hazy ?? o.troebel ?? o.h),
    s: normSmaak(o.smaakprofiel ?? o.smaak ?? o.profiel ?? o.profile ?? o.taste ?? o.s),
    a: normAbv(o.alcohol ?? o.abv ?? o.alc ?? o.percentage ?? o.a),
  }));
}

const LLM_PROMPT =
`Ik organiseer een blinde biertasting. Ik geef je hieronder een lijst bier-namen. Geef PER bier de gegevens terug als JSON-array — alleen de JSON, geen uitleg eromheen. Gebruik exact deze velden en waarden:
- "naam": de biernaam
- "soort": precies één van: ${TYPES.join(', ')}
- "hazy": true of false (is het bier troebel/nevelig?)
- "smaakprofiel": precies één van: ${SMAAK.map(s=>s.v).join(', ')}
- "alcohol": alcoholpercentage als getal, bijv. 8.0
Weet je iets niet zeker? Geef je beste inschatting. Mijn bieren:
`;

$('#import-toggle').addEventListener('click', ()=> $('#import-box').classList.toggle('hidden'));
$('#copy-prompt').addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText(LLM_PROMPT); toast('Prompt gekopieerd! Plak in ChatGPT + zet je biernamen eronder.'); }
  catch{ toast('Kopiëren mislukt — selecteer de prompt handmatig.'); }
});
$('#import-apply').addEventListener('click', ()=>{
  const raw = $('#import-text').value;
  if(!raw.trim()){ toast('Plak eerst het JSON-antwoord.'); return; }
  let beers;
  try{ beers = parseImport(raw).filter(b=>b.n); }
  catch(e){ toast('JSON niet te lezen — plak het hele antwoord van ChatGPT.'); return; }
  if(!beers.length){ toast('Geen biertjes met naam gevonden.'); return; }
  setupBeers = beers;
  renderSetup();
  $('#import-box').classList.add('hidden');
  $('#import-text').value='';
  toast(`${beers.length} biertje(s) ingevuld — check ze even na!`);
});

$('#make-qr').addEventListener('click', ()=>{
  // validatie
  const bad = setupBeers.findIndex(b=>!b.n.trim());
  if(bad>=0){ toast(`Drank ${bad+1} heeft geen naam. Naam = de bonusvraag!`); return; }
  const cfg = { b: setupBeers.map(b=>({n:b.n.trim(), t:b.t, h:b.h?1:0, s:b.s, a:b.a===''?null:parseFloat(b.a)})) };
  const url = buildShareUrl(cfg);
  renderQR(url, cfg.b.length);
  show('screen-share');
});

function buildShareUrl(cfg){
  const base = location.origin + location.pathname;
  return base + '#c=' + b64encode(JSON.stringify(cfg));
}
function renderQR(url, count){
  const box=$('#qrbox'); box.innerHTML='';
  new QRCode(box, { text:url, width:240, height:240, correctLevel: QRCode.CorrectLevel.M });
  $('#qr-count').textContent = `${count} drank${count===1?'':'jes'} klaar. Glazen genummerd 1–${count}.`;
  box._url = url;
}
$('#copy-link').addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText($('#qrbox')._url); toast('Link gekopieerd 🦴'); }
  catch{ toast('Kopiëren mislukt — gebruik de QR'); }
});
$('#back-setup').addEventListener('click', ()=>show('screen-setup'));

/* ════════════════════ PLAY MODE ════════════════════ */
let KEY=null;          // antwoordsleutel (uit URL)
let player={name:'', answers:[]};
let cur=0;
let storeKey='';

function loadConfig(){
  const m = location.hash.match(/c=([^&]+)/);
  if(!m) return null;
  try{ return JSON.parse(b64decode(m[1])); }
  catch(e){ return null; }
}

function initPlay(cfg){
  KEY = cfg.b;
  storeKey = 'cbt:'+b64encode(JSON.stringify(cfg)).slice(0,40);
  // herstel evt. opgeslagen sessie
  const saved = loadSaved();
  if(saved){ player=saved.player; cur=saved.cur||0;
    if(saved.finished){ renderEnd(); show('screen-end'); return; }
  } else {
    player = {name:'', avatar:null, answers: KEY.map(()=>({t:null,h:null,s:null,a:'',n:'',r:0}))};
  }
  $('#join-count').textContent = `${KEY.length} drank${KEY.length===1?'':'jes'} te proeven. Veel grom! 🦣`;
  renderCharacters();
  if(player.name && !player.avatar){ $('#player-name').value=player.name; $('.char-other').open=true; }
  show('screen-join');
}

let selectedChar = null;   // {f, n} of null bij eigen naam
function renderCharacters(){
  const grid = $('#char-grid');
  if(!CHARACTERS.length){ grid.classList.add('hidden'); return; }
  grid.innerHTML='';
  selectedChar = player.avatar ? CHARACTERS.find(c=>c.f===player.avatar)||null : null;
  CHARACTERS.forEach(c=>{
    const card = el('button','char'+(selectedChar&&selectedChar.f===c.f?' sel':''));
    card.innerHTML = `<img src="${c.f}" alt="${c.n}" loading="lazy"><span>${c.n}</span>`;
    card.addEventListener('click', ()=>{
      selectedChar = c;
      $('#player-name').value='';
      $$('.char',grid).forEach(x=>x.classList.remove('sel'));
      card.classList.add('sel');
    });
    grid.appendChild(card);
  });
}

function loadSaved(){ try{ return JSON.parse(localStorage.getItem(storeKey)); }catch{ return null; } }
function save(extra={}){ try{ localStorage.setItem(storeKey, JSON.stringify({player,cur,...extra})); }catch{} }

$('#player-name').addEventListener('input', ()=>{
  if($('#player-name').value.trim()){ selectedChar=null; $$('.char',$('#char-grid')).forEach(x=>x.classList.remove('sel')); }
});

$('#start-play').addEventListener('click', ()=>{
  const typed = $('#player-name').value.trim();
  const name = selectedChar ? selectedChar.n : typed;
  if(!name){ toast('Kies een oer-kop of tik je naam!'); return; }
  player.name = name;
  player.avatar = selectedChar ? selectedChar.f : null;
  save();
  cur=0; renderBeer(); show('screen-play');
});

function buildOptButtons(container, options, selected, onPick){
  container.innerHTML='';
  options.forEach(o=>{
    const b=el('button','opt'+(o.v===selected?' sel':''), o.label);
    b.addEventListener('click', ()=>{ onPick(o.v); $$('.opt',container).forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); });
    container.appendChild(b);
  });
}

function buildRating(container, value, onPick){
  container.innerHTML='';
  for(let i=1;i<=5;i++){
    const c=el('button','knots'+(i<=value?' on':''), '🦴');
    c.title = i+' bot'+(i>1?'ten':'');
    c.addEventListener('click', ()=>{
      const nv = (value===i) ? 0 : i;   // nogmaals op dezelfde = wissen
      onPick(nv);
      value = nv;
      $$('.knots',container).forEach((k,idx)=>k.classList.toggle('on', idx<nv));
    });
    container.appendChild(c);
  }
}

function renderBeer(){
  const a = player.answers[cur];
  $('#play-beer-title').textContent = `🍺 DRANK ${cur+1}`;
  $('#play-bar').style.width = ((cur)/(KEY.length))*100 + '%';

  buildOptButtons($('#q-type'), TYPES.map(t=>({v:t,label:t})), a.t, v=>{a.t=v;save();});
  buildOptButtons($('#q-hazy'), [{v:true,label:'💧 JA'},{v:false,label:'🔍 NEE'}], a.h, v=>{a.h=v;save();});
  buildOptButtons($('#q-smaak'), SMAAK, a.s, v=>{a.s=v;save();});
  buildRating($('#q-rating'), a.r, v=>{a.r=v;save();});

  $('#q-abv').value = a.a;
  $('#q-name').value = a.n;

  $('#prev-beer').style.visibility = cur===0 ? 'hidden':'visible';
  $('#next-beer').textContent = cur===KEY.length-1 ? '🏆 TOON GROM-PUNTEN' : 'VOLGEND →';
}

$('#q-abv').addEventListener('input', e=>{ player.answers[cur].a=e.target.value; save(); });
$('#q-name').addEventListener('input', e=>{ player.answers[cur].n=e.target.value; save(); });

$('#prev-beer').addEventListener('click', ()=>{ if(cur>0){cur--;renderBeer();window.scrollTo(0,0);} });
$('#next-beer').addEventListener('click', ()=>{
  if(cur < KEY.length-1){ cur++; renderBeer(); window.scrollTo(0,0); }
  else { renderEnd(); save({finished:true}); show('screen-end'); }
});

/* ════════════════════ END SCREEN ════════════════════ */
function renderEnd(){
  $('#end-name').textContent = player.name + ', GROM!';
  const av = $('#end-avatar');
  if(player.avatar){ av.src = player.avatar; av.classList.remove('hidden'); }
  else { av.classList.add('hidden'); }
  let total=0, favIdx=-1;
  const results = KEY.map((k,i)=>{ const r=scoreBeer(player.answers[i],k); total+=r.total; return r; });
  // favoriet
  let favRating=0;
  player.answers.forEach((a,i)=>{ if((a.r||0)>favRating){ favRating=a.r; favIdx=i; } });

  $('#end-score').innerHTML = `${total}<small>grom-punten</small>`;

  const bd=$('#end-breakdown'); bd.innerHTML='';
  results.forEach((r,i)=>{
    const card=el('div','bd-beer');
    const rows = r.details.map(d=>`
      <div class="bd-row">
        <span>${d.k}${d.bonus?' 🦴':''}: <i>${escapeAttr(String(d.you))}</i></span>
        <span class="${d.ok?'ok':'no'}">${d.ok?'✅ +'+d.pts:'❌'}</span>
      </div>`).join('');
    const reveal = `<div class="bd-reveal">Juist: <b>${escapeAttr(KEY[i].n)}</b> — ${KEY[i].t}, ${KEY[i].h?'hazy':'helder'}, ${KEY[i].s}${KEY[i].a!=null?', '+KEY[i].a+'%':''}</div>`;
    card.innerHTML = `
      <div class="bd-head"><b>🍺 Drank ${i+1}${i===favIdx?' ⭐':''}</b><span class="bd-pts">${r.total} pt</span></div>
      <div class="bd-body">${rows}${reveal}</div>`;
    card.querySelector('.bd-head').addEventListener('click',()=>card.querySelector('.bd-body').classList.toggle('open'));
    bd.appendChild(card);
  });
  player._total = total;
}

$('#share-wa').addEventListener('click', ()=>{
  const t = `🦣 ${player.name} scoorde ${player._total} grom-punten bij Caveman Beer Tasting! Wie verslaat oer-mens? Ugh. 🍺`;
  window.open('https://wa.me/?text='+encodeURIComponent(t), '_blank');
});

/* ════════════════════ BOOT ════════════════════ */
(function boot(){
  const cfg = loadConfig();
  if(cfg && cfg.b && cfg.b.length){
    initPlay(cfg);
  } else {
    setupBeers = [blankBeer()];
    renderSetup();
    show('screen-setup');
  }
})();
