'use strict';
/* Doxb1t = ходячий «Городок» (telegram_app_test) + экраны/логика дизайна (webProj).
   Модель: у каждого из 4 домиков прочность 0..5. Запись «что я сделал» = +1,
   день без записи в сфере = −1. 4 домика × 5 = 20 лепестков цветка. */

const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand(); tg?.disableVerticalSwipes?.();
const buzz = t => { try { tg?.HapticFeedback?.impactOccurred(t || 'light'); } catch (e) {} };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Константы (тексты и цвета — из дизайна) ---------- */
const INK = '#2A2017', EMPTY = '#E8DCC4';
const SPH = [
  { id: 'health', name: 'Здоровье', col: '#3FA34D', bg: '#1F4D2B' },
  { id: 'food',   name: 'Еда',      col: '#E8833A', bg: '#5A3A1C' },
  { id: 'sleep',  name: 'Сон',      col: '#3A4A8C', bg: '#1B2150' },
  { id: 'work',   name: 'Учёба',    col: '#B83236', bg: '#4A1D20' }   // «Работа», если выбран статус «Работаю»
];
const STATUS = [
  { id: 'school', label: 'Учусь в школе',          house: 'Школа',       sphere: 'Учёба',  variant: 'study' },
  { id: 'uni',    label: 'Учусь в вузе / колледже', house: 'Университет', sphere: 'Учёба',  variant: 'study' },
  { id: 'job',    label: 'Работаю',                 house: 'Офис',        sphere: 'Работа', variant: 'work' }
];
const QUICK = [
  { label: 'Лёг до 23:00',    text: 'Лёг спать до 23:00',                              sphere: 'sleep' },
  { label: 'Сделал зарядку',  text: 'Сделал зарядку 15 минут',                         sphere: 'health' },
  { label: 'Поел нормально',  text: 'Нормально пообедал: суп и гречка, без фастфуда',  sphere: 'food' },
  { label: 'Сделал домашку',  text: 'Сделал домашку по алгебре',                       sphere: 'work' }
];
/* Заглушка до «ИИ сам поймёт, в какой домик»: подбор сферы по ключевым словам */
const KEYWORDS = [
  ['sleep',  /спать|спал|лёг|лег |сон|выспал|засн|просн/i],
  ['food',   /пое[лв]|обед|завтрак|ужин|суп|гречк|фастфуд|перекус|воду|воды|готовил/i],
  ['health', /зарядк|спорт|трениров|бегал|пробеж|прогулк|йог|растяжк|врач|шагов/i],
  ['work',   /домашк|урок|учеб|учил|прочит|курс|экзамен|лекци|работ|проект|задач|отчёт|отчет|созвон|письм/i]
];
const guess = t => (KEYWORDS.find(([, re]) => re.test(t)) || [])[0] || null;

const FURN = [ // мебель — из telegram-версии
  { id: 'bed', e: '🛏️', n: 'Кровать', p: 40 }, { id: 'sofa', e: '🛋️', n: 'Диван', p: 60 }, { id: 'lamp', e: '💡', n: 'Лампа', p: 20 },
  { id: 'tv', e: '📺', n: 'ТВ', p: 80 }, { id: 'plant', e: '🪴', n: 'Цветок', p: 15 }, { id: 'books', e: '📚', n: 'Книги', p: 30 }
];
const REWARD = 5;      // монет за запись
const FIX = 15;        // монет за +1 прочности
const INCOME = 0.1;    // монет/сек за каждую заполненную клетку прочности
const ENTER_D = 2;     // внутрь можно войти, если домик не в разрухе
const FURN_LOSS = 25;  // потеря прочности мебели за день без записи
const SLOTS = 6, KEY = 'doxb1t_v2';
const TAG = { good: 'Цветёт', warn: 'Трещины', bad: 'Разруха' };
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/* ---------- Даты ---------- */
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dkey(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const dayWord = n => (n % 10 === 1 && n % 100 !== 11) ? 'день' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'дня' : 'дней';
const fmtDate = k => { const d = parse(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };

/* ---------- Состояние ---------- */
const fresh = () => ({
  v: 2, status: null, coins: 50, t: Date.now(), tick: addDays(dkey(), -1),
  streak: { n: 0, last: null }, entries: [],
  h: Object.fromEntries(SPH.map(s => [s.id, { d: 1, f: Array(SLOTS).fill(null), log: [] }])) // «Город разграблен»: всё в разрухе
});
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || S.v !== 2) {
  S = fresh();
  try { const o = JSON.parse(localStorage.getItem('flowertown_v1')); if (o?.coins) S.coins = Math.floor(o.coins); } catch (e) {} // перенос монет из старой версии
}
const save = () => { S.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const pips = () => SPH.reduce((a, s) => a + S.h[s.id].d, 0);
const rate = () => pips() * INCOME;
const stOf = id => STATUS.find(x => x.id === S.status) || STATUS[1];
const sphName = s => s.id === 'work' ? stOf().sphere : s.name;
const variant = () => stOf().variant;
const streakN = () => (S.streak.last && S.streak.last >= addDays(dkey(), -1)) ? S.streak.n : 0;
const lastEntry = id => S.entries.find(e => e.sphere === id);
const fCost = h => h.f.reduce((a, f) => a + (f ? Math.ceil((100 - f.d) / 25) * 5 : 0), 0);

/* Оффлайн-приток монет и ночное «ветшание»: день без записи в сфере = −1 к прочности */
S.coins += Math.min((Date.now() - S.t) / 1000, 8 * 3600) * rate();
function tickDays() {
  const today = dkey();
  let day = addDays(S.tick, 1); if (day < addDays(today, -30)) day = addDays(today, -30);
  for (; day < today; day = addDays(day, 1)) {
    SPH.forEach(s => {
      const h = S.h[s.id];
      if (h.d > 0 && !S.entries.some(e => e.date === day && e.sphere === s.id)) {
        h.d--; h.log.unshift({ date: day, text: 'нет записей, домик ветшает', delta: -1 });
        h.f.forEach(f => { if (f) f.d = Math.max(0, f.d - FURN_LOSS); });
      }
      h.log.length = Math.min(h.log.length, 30);
    });
  }
  S.tick = addDays(today, -1); save();
}
tickDays();

function addEntry(text, sphere) {
  const h = S.h[sphere], today = dkey(), was = h.d, now = new Date();
  h.d = Math.min(5, h.d + 1); S.coins += REWARD;
  S.entries.unshift({ date: today, time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, text, sphere });
  S.entries.length = Math.min(S.entries.length, 300);
  h.log.unshift({ date: today, text, delta: h.d - was });
  if (S.streak.last !== today) { S.streak.n = S.streak.last === addDays(today, -1) ? S.streak.n + 1 : 1; S.streak.last = today; }
  save(); buzz('medium');
}
function fixHouse(id) {
  const h = S.h[id]; if (h.d >= 5) return;
  if (S.coins < FIX) return toast('Не хватает монет');
  S.coins -= FIX; h.d++; h.log.unshift({ date: dkey(), text: `починено за ${FIX} монет`, delta: 1 }); save(); buzz();
}

/* ---------- Мелкие UI-хелперы ---------- */
function toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.opacity = 0, 1800); }
const pipsBar = (d, col, big) => `<div class="pips${big ? ' big' : ''}" role="img" aria-label="${d} из 5">${[0, 1, 2, 3, 4].map(i => `<i style="${i < d ? 'background:' + col : ''}"></i>`).join('')}</div>`;
const ICON = {
  heart: '<svg width="18" height="18" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="3" y="0" width="1" height="1" fill="#E5484D"/><rect x="2" y="1" width="3" height="1" fill="#E5484D"/><rect x="2" y="2" width="4" height="1" fill="#E5484D"/><rect x="1" y="3" width="6" height="3" fill="#E5484D"/><rect x="3" y="3" width="2" height="2" fill="#FFD23F"/><rect x="2" y="6" width="4" height="1" fill="#E5484D"/></svg>',
  back: '<svg width="18" height="18" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="2" y="3" width="5" height="2" fill="#2A2017"/><rect x="1" y="3" width="1" height="2" fill="#2A2017"/><rect x="2" y="2" width="1" height="4" fill="#2A2017"/><rect x="3" y="1" width="1" height="6" fill="#2A2017"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="0" y="1" width="8" height="2" fill="#2A2017"/><rect x="0" y="1" width="1" height="7" fill="#2A2017"/><rect x="7" y="1" width="1" height="7" fill="#2A2017"/><rect x="0" y="7" width="8" height="1" fill="#2A2017"/><rect x="2" y="0" width="1" height="2" fill="#2A2017"/><rect x="5" y="0" width="1" height="2" fill="#2A2017"/></svg>'
};
const backBtn = (to = 'main') => `<button class="btn back" data-a="go" data-v="${to}" aria-label="Назад">${ICON.back}</button>`;

/* ---------- Цветок (20 лепестков = 4 домика × 5 прочности) ---------- */
function flowerSVG() {
  let p = '';
  for (let k = 0; k < 20; k++) {
    const s = SPH[(k / 5) | 0], lit = (k % 5) < S.h[s.id].d;
    p += `<ellipse cx="50" cy="26" rx="6.5" ry="15" transform="rotate(${k * 18} 50 50)" fill="${lit ? s.col : '#999'}" opacity="${lit ? 1 : .28}" stroke="${lit ? '#fff' : 'none'}" stroke-width=".8"/>`;
  }
  return `<svg class="fl ${pips() ? 'glow' : ''}" viewBox="0 0 100 100">${p}<circle cx="50" cy="50" r="9" fill="${pips() ? '#ffd54a' : '#aaa'}"/></svg>`;
}

/* ---------- HUD главного экрана ---------- */
function buildHud(pulse) {
  const n = streakN(), seg = Math.round(pips() / 2);
  $('hud').innerHTML = `
  <div class="top"><div class="pill">${ICON.heart}<span>${n} ${dayWord(n)}</span></div>
    <button class="btn" style="min-height:44px;box-shadow:3px 3px 0 ${INK}" data-a="diary">${ICON.book}Дневник</button></div>
  <div class="card"><div class="line"><h1>Городок</h1><span>Восстановлен на ${Math.round(pips() / 20 * 100)}%</span></div>
    <div class="seg" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="${i < seg ? 'background:#3FA34D' : ''}"></i>`).join('')}</div>
    <div class="line"><small id="coinTxt"></small><button id="flowerBtn" data-a="flower" aria-label="Мой цветок">${flowerSVG()}</button></div></div>`;
  tickHud();
  if (pulse) { const b = $('flowerBtn'); b.classList.add('pulse'); }
}
function tickHud() { const e = $('coinTxt'); if (e) e.textContent = `🪙 ${Math.floor(S.coins)} · +${(rate() * 60).toFixed(1)}/мин · 🌸 ${pips()}/20`; }

/* ---------- Карточка ближайшего домика ---------- */
let near = -1, sheetMode = null, sheetId = null, cur = 'main', curArg;
function updateNear() {
  const el = $('near');
  if (near < 0 || sheetMode || cur !== 'main') { el.style.display = 'none'; return; }
  const s = SPH[near], h = S.h[s.id], st = Domik.stateOf(h.d);
  el.style.display = 'block';
  el.innerHTML = `<div class="card"><div class="line"><b class="px" style="font-size:18px">${sphName(s)}</b><span class="tag ${st}">${TAG[st]} · ${h.d}/5</span></div>
    <div style="margin:8px 0">${pipsBar(h.d, s.col)}</div>
    <div class="row" style="margin-top:0"><button class="btn sm" data-a="house" data-v="${s.id}">Открыть домик</button><button class="btn sm y" data-a="add" data-v="${s.id}">Записать</button></div></div>`;
}

/* ---------- Экраны ---------- */
let startSel = 'uni', addSt = { text: '', sphere: 'food', manual: false };
const R = {
  start() {
    const st = STATUS.find(x => x.id === startSel);
    return `<div class="wrap" style="background:#4C5068"><div class="scr">
      <div style="display:flex;flex-direction:column;gap:6px;padding-top:14px"><span class="chap">ГЛАВА 1</span>
        <h1 class="h" style="font-size:32px;line-height:1.1;color:#FFF6E0">Город разграблен</h1></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:0 6px;height:120px">
        ${['health', 'food', 'sleep', 'work'].map(k => Domik.svg(k, 'bad', st.variant, 76)).join('')}</div>
      <div class="card"><p style="margin:0;font-size:15px;line-height:1.45">Бандиты разорили городок: домики в трещинах и паутине. Починить их можешь только ты — своими настоящими делами.</p></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2 class="px" style="margin:0;font-size:20px">Чем ты сейчас занят?</h2>
        <div style="display:flex;flex-direction:column;gap:8px">${STATUS.map(o => `<button class="opt ${o.id === startSel ? 'on' : ''}" data-a="status" data-v="${o.id}" aria-pressed="${o.id === startSel}"><span>${o.label}</span><span class="px" style="font-size:14px">${o.id === startSel ? '[x]' : '[ ]'}</span></button>`).join('')}</div>
        <div style="display:flex;align-items:center;gap:12px"><div style="flex:none;background:#CFE3F3;border:3px solid ${INK};padding:4px">${Domik.svg('work', 'good', st.variant, 56)}</div>
          <p style="margin:0;font-size:14px;line-height:1.4">Четвёртый домик станет: <b>${st.house}</b>. Сфера — «${st.sphere}».</p></div></div>
      <button class="btn big" style="margin-top:auto" data-a="begin">Начать чинить город</button></div></div>`;
  },

  add() {
    const s = SPH.find(x => x.id === addSt.sphere), h = S.h[s.id], after = Math.min(5, h.d + 1);
    return `<div class="wrap" style="background:#FFE9B8"><div class="scr">
      <div class="hd">${backBtn()}<h1 class="h">Что ты сделал?</h1></div>
      <div style="display:flex;flex-direction:column;gap:6px"><label for="entry" style="font-size:14px;font-weight:700">Напиши своими словами</label>
        <textarea id="entry" rows="3" maxlength="200">${esc(addSt.text)}</textarea></div>
      <div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;font-weight:700">Быстрые записи</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${QUICK.map((q, i) => `<button class="chip" data-a="quick" data-v="${i}">${q.label}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;font-weight:700">В какой домик?</span>
        <div class="grid2">${SPH.map(x => `<button class="opt px ${x.id === s.id ? 'on' : ''}" style="justify-content:flex-start;gap:8px;font-size:16px;font-weight:600" data-a="sph" data-v="${x.id}" aria-pressed="${x.id === s.id}"><span class="sq" style="background:${x.col}"></span>${sphName(x)}</button>`).join('')}</div>
        <div class="ghost"><span style="color:#8A4FD0;font-size:16px">✚</span>Скоро: ИИ сам поймёт, в какой домик отнести запись</div></div>
      <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px">
        ${Domik.svg(s.id, Domik.stateOf(h.d), variant(), 64)}<span class="px" style="font-size:22px">→</span>${Domik.svg(s.id, Domik.stateOf(after), variant(), 64)}
        <div style="display:flex;flex-direction:column;gap:2px"><span class="px" style="font-size:16px;font-weight:700">«${sphName(s)}»</span>
          <span style="font-size:13px;font-weight:700">${h.d >= 5 ? 'Уже цветёт — запись продлит серию' : `Прочность ${h.d}/5 → ${after}/5`}</span></div></div>
      <button class="btn big" style="margin-top:auto" data-a="send">Отправить в городок</button></div></div>`;
  },

  house(id) {
    const s = SPH.find(x => x.id === id), h = S.h[id], st = Domik.stateOf(h.d), nm = sphName(s);
    const le = lastEntry(id), ds = le ? diffDays(le.date, dkey()) : null;
    const msg = st === 'bad'
      ? (ds === null ? 'Записей ещё не было. ' : `Последняя запись — ${ds === 0 ? 'сегодня' : ds === 1 ? 'вчера' : ds + ' ' + dayWord(ds) + ' назад'}. `) +
        (h.d > 0 ? `Ещё ${h.d} ${dayWord(h.d)} тишины, и домик развалится до основания.` : 'Домик лежит в руинах — одна запись начнёт стройку.')
      : st === 'warn' ? 'Трещины. Каждый день без записи отнимает 1 прочность.' : 'Цветёт! Запись в день удержит домик.';
    return `<div class="wrap" style="background:${s.bg}"><div class="scr">
      <div class="hd">${backBtn()}<h1 class="h" style="color:#FFF6E0">Домик «${nm}»</h1></div>
      <div style="display:flex;justify-content:center;padding-top:6px">${Domik.svg(id, st, variant(), 176)}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="line"><span class="tag ${st}">${TAG[st]}</span><b class="px" style="font-size:16px">${h.d} / 5</b></div>
        ${pipsBar(h.d, s.col, true)}<span style="font-size:14px;font-weight:700">${msg}</span></div>
      <div class="card"><h2 class="px" style="margin:0 0 6px;font-size:17px">История</h2>
        ${h.log.length ? h.log.slice(0, 6).map((l, i) => `${i ? '<div class="dash"></div>' : ''}<div class="line" style="font-size:14px"><span><b>${fmtDate(l.date)}</b> · ${esc(l.text)}</span><span class="${l.delta > 0 ? 'up' : 'dn'}">${l.delta > 0 ? '+' : ''}${l.delta || 0}</span></div>`).join('') : '<span class="muted">Пока пусто</span>'}</div>
      <div class="row" style="margin-top:auto"><button class="btn sm" data-a="fixhouse" data-v="${id}" ${h.d >= 5 ? 'disabled' : ''}>🔧 +1 за ${FIX}🪙</button>
        <button class="btn sm" data-a="room" data-v="${id}" ${h.d >= ENTER_D ? '' : 'disabled'}>${h.d >= ENTER_D ? 'Войти' : '🔒 Закрыт'}</button></div>
      <button class="btn big" data-a="add" data-v="${id}">Починить: записать ${nm.toLowerCase()}</button></div></div>`;
  },

  diary() {
    const today = dkey(), d0 = new Date(), mon = addDays(today, -((d0.getDay() + 6) % 7)), n = streakN();
    const dow = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const week = dow.map((w, i) => {
      const k = addDays(mon, i);
      return `<div class="day" style="background:${k === today ? '#FFD23F' : '#fff'};opacity:${k > today ? .45 : 1}"><span>${w}</span><b>${parse(k).getDate()}</b>
        <div class="q">${SPH.map(s => `<i style="background:${S.entries.some(e => e.date === k && e.sphere === s.id) ? s.col : EMPTY}"></i>`).join('')}</div></div>`;
    }).join('');
    const todays = S.entries.filter(e => e.date === today), full = d0.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const dateStr = full.charAt(0).toUpperCase() + full.slice(1);
    return `<div class="wrap" style="background:#FFF6E0"><div class="scr">
      <div class="hd">${backBtn()}<div><h1 class="h" style="line-height:1.1">Дневник</h1><span class="muted" style="font-size:14px">${dateStr}</span></div></div>
      <div class="week">${week}</div>
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${INK};color:#FFF6E0"><span style="transform:scale(1.9);margin:0 8px">${ICON.heart}</span>
        <div style="display:flex;flex-direction:column;gap:2px"><span class="px" style="font-size:20px;font-weight:700;color:#FFD23F">Серия: ${n} ${dayWord(n)}</span><span style="font-size:13px;font-weight:700">Не зайдёшь до полуночи — серия сгорит</span></div></div>
      <h2 class="px" style="margin:0;font-size:18px">Сегодня</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${todays.map(e => { const s = SPH.find(x => x.id === e.sphere); return `<div class="entry"><span class="sq" style="background:${s.col};width:16px;height:16px"></span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:15px;font-weight:700">${esc(e.text)}</span><span class="muted">${e.time} · ${sphName(s)}</span></div><span class="up">+1</span></div>`; }).join('')}
        ${SPH.filter(s => !todays.some(e => e.sphere === s.id)).map(s => `<div class="entry empty"><span class="sq" style="background:${s.col};width:16px;height:16px"></span><span style="flex:1;font-size:14px;font-weight:700">${sphName(s)} — пока пусто. Домику нужна запись</span></div>`).join('')}</div>
      <button class="btn big" style="margin-top:auto" data-a="add">＋ Добавить запись</button></div></div>`;
  }
};

/* ---------- Навигация ---------- */
function show(n, a) {
  cur = n; curArg = a; closeSheet(true);
  const s = $('scr');
  if (n === 'main') { s.className = ''; s.innerHTML = ''; $('main').style.display = 'block'; try { tg?.BackButton?.hide(); } catch (e) {} buildHud(); updateNear(); }
  else { $('main').style.display = 'none'; s.className = 'on'; s.innerHTML = R[n](a); s.scrollTop = 0; try { tg?.BackButton?.show(); } catch (e) {} }
}
function rerender() {
  const ta = $('entry'), had = ta && document.activeElement === ta, pos = ta?.selectionStart;
  $('scr').innerHTML = R[cur](curArg);
  if (had) { const t = $('entry'); t.focus(); t.setSelectionRange(pos, pos); }
}
try { tg?.BackButton?.onClick(() => sheetMode ? closeSheet() : show('main')); } catch (e) {}

function openAdd(sphere) {
  addSt = { text: '', sphere: sphere || addSt.sphere || 'food', manual: !!sphere };
  show('add');
}
function act(a, v, ev) {
  switch (a) {
    case 'go': return show(v);
    case 'diary': return show('diary');
    case 'house': return show('house', v);
    case 'add': return openAdd(v);
    case 'status': startSel = v; return rerender();
    case 'begin': S.status = startSel; save(); return show('main');
    case 'quick': { const q = QUICK[+v]; addSt = { text: q.text, sphere: q.sphere, manual: false }; return rerender(); }
    case 'sph': addSt.sphere = v; addSt.manual = true; return rerender();
    case 'send': {
      const text = addSt.text.trim(); if (!text) return toast('Напиши, что ты сделал');
      const sid = addSt.sphere, was = S.h[sid].d; addEntry(text, sid);
      show('main'); buildHud(true); toast(`🏠 «${sphName(SPH.find(x => x.id === sid))}»: ${was}/5 → ${S.h[sid].d}/5 · +${REWARD}🪙`); return;
    }
    case 'fixhouse': fixHouse(v); return rerender();
    case 'room': return openSheet('room', v);
    case 'flower': return openSheet('flower');
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || (b.closest('#sheet'))) return;
  act(b.dataset.a, b.dataset.v, e);
});
$('scr').addEventListener('input', e => {
  if (e.target.id !== 'entry') return;
  addSt.text = e.target.value;
  if (!addSt.manual) { const g = guess(addSt.text); if (g && g !== addSt.sphere) { addSt.sphere = g; rerender(); } }
});

/* ---------- Шторка: цветок и комната (мебель — из telegram-версии) ---------- */
function openSheet(mode, id) { sheetMode = mode; sheetId = id; renderSheet(); $('sheet').style.display = 'flex'; updateNear(); }
function closeSheet(silent) { sheetMode = null; $('sheet').style.display = 'none'; if (!silent) { updateNear(); if (cur === 'house') rerender(); } }
function renderSheet() {
  let x = '';
  if (sheetMode === 'flower') {
    x = `<h3>Мой цветок · ${pips()}/20</h3><div style="width:220px;margin:0 auto">${flowerSVG()}</div>` +
      SPH.map(s => `<div class="sub"><span><span style="color:${s.col}">●</span> ${sphName(s)}</span><b>${S.h[s.id].d}/5</b></div>`).join('') +
      `<p class="hint">Приток: 🪙 ${(rate() * 60).toFixed(1)} в минуту. Чем больше прочности у домиков — тем быстрее капают монеты.</p>`;
  } else if (sheetMode === 'room') {
    const s = SPH.find(q => q.id === sheetId), h = S.h[s.id], fc = fCost(h);
    x = `<h3>Домик «${sphName(s)}» внутри</h3><div class="room">` + h.f.map(f => {
      if (!f) return '<div class="slot">＋</div>';
      const it = FURN.find(i => i.id === f.id), col = f.d >= 70 ? '#4caf50' : f.d >= 40 ? '#ffb300' : '#e53935';
      return `<div class="slot"><span style="opacity:${.4 + f.d / 170};filter:${f.d < 50 ? 'grayscale(1)' : 'none'}">${f.d < 30 ? '🪑' : it.e}</span><div class="pips"><i style="background:${col};flex:${f.d}"></i><i style="flex:${100 - f.d};background:transparent"></i></div></div>`;
    }).join('') + `</div><div class="shop">` + FURN.map(i => `<button data-a="buy" data-id="${i.id}"><span>${i.e}</span>${i.n}<br>🪙 ${i.p}</button>`).join('') + `</div>` +
      (fc ? `<div class="row"><button class="btn sm" data-a="frepair">🔧 Починить мебель (🪙 ${fc})</button></div>` : '');
  }
  $('sheetIn').innerHTML = x + `<div class="row" style="margin-top:12px"><button class="btn sm" data-a="close">Закрыть</button></div>`;
}
$('sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet') return closeSheet();
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'close') return closeSheet();
  const h = S.h[sheetId];
  if (a === 'buy') {
    const it = FURN.find(f => f.id === b.dataset.id), i = h.f.indexOf(null);
    if (i < 0) return toast('Нет свободных мест'); if (S.coins < it.p) return toast('Не хватает монет');
    S.coins -= it.p; h.f[i] = { id: it.id, d: 100 }; buzz();
  }
  if (a === 'frepair') { const c = fCost(h); if (S.coins < c) return toast('Не хватает монет'); S.coins -= c; h.f.forEach(f => { if (f) f.d = 100; }); toast('🔧 Мебель починена'); }
  save(); tickHud(); renderSheet();
});

/* ---------- Мир: ходим по дороге между домиками ---------- */
const cv = $('c'), ctx = cv.getContext('2d'); let W = 360, VH = 640, SC = 1;
const LEN = 1260, ROAD = 62, HW = 96;
const cx = y => 180 + 20 * Math.sin(y / 90);
const hs = SPH.map((s, i) => ({ i, side: i % 2 ? 1 : -1, y: 210 + i * 250 }));
function resize() { const d = devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; SC = innerWidth / W; VH = innerHeight / SC; ctx.setTransform(d * SC, 0, 0, d * SC, 0, 0); ctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize); resize();

const P = { x: 180, y: LEN - 110, ph: 0, mv: false }, J = { x: 0, y: 0 };
const joy = $('joy'), knob = $('knob'); let jid = null;
function jset(e) { const r = joy.getBoundingClientRect(), R_ = r.width / 2; let dx = e.clientX - (r.left + R_), dy = e.clientY - (r.top + R_); const d = Math.hypot(dx, dy), m = R_ * .55; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; J.x = dx / m; J.y = dy / m; }
joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jset(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jset(e); });
const jend = e => { if (e.pointerId !== jid) return; jid = null; J.x = J.y = 0; knob.style.transform = ''; };
joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
const K = {}; addEventListener('keydown', e => K[e.key.toLowerCase()] = 1); addEventListener('keyup', e => K[e.key.toLowerCase()] = 0);

function frame(t) {
  const dt = Math.min((t - (frame.l || t)) / 1000, .05); frame.l = t;
  S.coins += rate() * dt;
  if ((frame.s = (frame.s || 0) + dt) > 3) { frame.s = 0; save(); }
  if (cur === 'main') {
    let vx = J.x, vy = J.y;
    if (K.arrowleft || K.a) vx -= 1; if (K.arrowright || K.d) vx += 1; if (K.arrowup || K.w) vy -= 1; if (K.arrowdown || K.s) vy += 1;
    const m = Math.hypot(vx, vy); if (m > 1) { vx /= m; vy /= m; }
    P.mv = !sheetMode && m > .08;
    if (P.mv) { P.x += vx * 100 * dt; P.y += vy * 100 * dt; P.ph += dt * 11; }
    P.y = Math.max(60, Math.min(LEN - 40, P.y)); const c = cx(P.y); P.x = Math.max(c - ROAD, Math.min(c + ROAD, P.x));
    if ((frame.u = (frame.u || 0) + dt) > .5) { frame.u = 0; tickHud(); }
    let n = -1, best = 75;
    hs.forEach(h => { const d = Math.hypot(P.x - (cx(h.y) + h.side * ROAD), P.y - (h.y - 25)); if (d < best) { best = d; n = h.i; } });
    if (n !== near) { near = n; updateNear(); }
    draw();
  }
  requestAnimationFrame(frame);
}
function draw() {
  const cam = Math.max(0, Math.min(LEN - VH, P.y - VH * .62)), y0 = cam - 10, y1 = cam + VH + 10;
  ctx.fillStyle = '#6BCB4E'; ctx.fillRect(0, 0, W, VH);
  ctx.save(); ctx.translate(0, -cam);
  for (let y = Math.floor(y0 / 24) * 24; y < y1; y += 24) for (let x = 0; x < W; x += 24) { const r = (x * 73 + y * 131) % 7; if (r < 2) { ctx.fillStyle = r ? '#3E8E41' : '#7BD65E'; ctx.fillRect(x + (y % 5) * 3, y + (x % 7) * 2, 4, 4); } }
  [['#C29A62', ROAD * 2 + 12], ['#D9B27A', ROAD * 2 - 8]].forEach(([col, w]) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); const s0 = Math.max(0, y0); for (let y = s0; y <= Math.min(LEN, y1); y += 8) y === s0 ? ctx.moveTo(cx(y), y) : ctx.lineTo(cx(y), y); ctx.stroke(); });
  for (let y = Math.floor(y0 / 80) * 80; y < y1; y += 80) { const o = (y * 37) % 30; [12 + o % 9, 348 - o % 9].forEach(x => { ctx.fillStyle = '#3E9E3E'; ctx.fillRect(x - 12, y - 10, 24, 14); ctx.fillRect(x - 16, y, 32, 12); ctx.fillStyle = '#6BD14F'; ctx.fillRect(x - 8, y - 4, 8, 8); ctx.fillStyle = '#7A4A24'; ctx.fillRect(x - 4, y + 12, 8, 12); }); }
  const items = hs.map(h => ({ y: h.y, f: () => drawHouse(h) })); items.push({ y: P.y, f: drawPlayer }); items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  ctx.restore();
}
function drawHouse(h) {
  const s = SPH[h.i], d = S.h[s.id].d, st = Domik.stateOf(d);
  const x = cx(h.y) + h.side * (ROAD + 4) + (h.side < 0 ? -HW : 0), y = h.y - HW + 10;
  ctx.drawImage(Domik.canvas(s.id, st, variant()), x, y, HW, HW);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = INK; ctx.fillRect(x + HW / 2 - 29 + i * 12, y - 12, 10, 8); ctx.fillStyle = i < d ? s.col : EMPTY; ctx.fillRect(x + HW / 2 - 28 + i * 12, y - 11, 8, 6); }
  ctx.font = '700 12px "Pixelify Sans",Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = '#FFF6E0';
  ctx.strokeText(sphName(s), x + HW / 2, y - 18); ctx.fillText(sphName(s), x + HW / 2, y - 18);
}
function drawPlayer() { // вид со спины, пиксель-арт
  const x = Math.round(P.x), y = Math.round(P.y), s = P.mv ? Math.sin(P.ph) * 3 : 0, R_ = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, 7); ctx.fill();
  R_('#2d3a55', -6, -9 + s * .5, 5, 9 - s * .5); R_('#2d3a55', 1, -9 - s * .5, 5, 9 + s * .5);
  R_('#FFD23F', -7, -24, 14, 16); R_('#E8B92A', -9, -23, 3, 11); R_('#E8B92A', 6, -23, 3, 11);
  R_('#f1c27d', -5, -27, 10, 3); R_('#5b3a1e', -6, -36, 12, 12);
}

/* ---------- Старт ---------- */
setInterval(() => { const k = dkey(); if (S.tick !== addDays(k, -1)) { tickDays(); if (cur === 'main') { buildHud(); updateNear(); } } }, 30000);
addEventListener('beforeunload', save); document.addEventListener('visibilitychange', save);
show(S.status ? 'main' : 'start');
requestAnimationFrame(frame);
