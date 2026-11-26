/* Компонент «Домик» — пиксельная отрисовка на сетке 16×16.
   Перенесён 1:1 из дизайн-концепта (webProj/Domik.dc.html → renderVals()).
   kind:    health | food | sleep | work
   state:   good (прочность 4–5) | warn (2–3) | bad (0–1)
   variant: study (колокол) | work (часы) — только для kind=work */
const Domik = (() => {
  const WARM = {
    health: { wall: '#F4F1EA', wall2: '#DCD6C8', roof: '#3FA34D', roof2: '#2C7A37' },
    food:   { wall: '#F6D7A7', wall2: '#E2BC84', roof: '#E8833A', roof2: '#B8621F' },
    sleep:  { wall: '#C4BFEE', wall2: '#A29CD8', roof: '#3A4A8C', roof2: '#283566' },
    work:   { wall: '#CFE3F3', wall2: '#A9C8E2', roof: '#B83236', roof2: '#8A2226' }
  };
  const COLD = { wall: '#9AA4AD', wall2: '#7C8791', roof: '#5A6475', roof2: '#434B59' };

  const stateOf = d => (d >= 4 ? 'good' : d >= 2 ? 'warn' : 'bad'); // прочность 0..5 → состояние

  /* Список прямоугольников в клетках сетки 16×16 */
  function rects(kind = 'health', state = 'good', variant = 'study') {
    const warm = WARM[kind] || WARM.health;
    const bad = state === 'bad', warn = state === 'warn';
    const c = bad ? COLD : warm;
    const mute = col => (bad ? '#6E747C' : col);
    const R = [];
    const add = (x, y, w, h, col) => R.push({ x, y, w, h, c: col });

    add(1, 15, 14, 1, 'rgba(42,32,23,0.22)');
    add(2, 7, 12, 8, c.wall);
    add(12, 7, 2, 8, c.wall2);

    if (kind === 'work') { add(6, 1, 4, 2, c.wall2); add(5, 0, 6, 1, c.roof2); }
    if (kind === 'food') {
      add(12, 1, 1, 4, mute('#6B4B3A'));
      if (!bad) { add(13, 0, 1, 1, '#F2F2F2'); add(12, 0, 1, 1, '#FFFFFF'); }
    }
    if (kind === 'sleep' && !bad) {
      add(2, 1, 1, 1, '#FFE07A'); add(14, 0, 1, 1, '#FFE07A'); add(13, 2, 1, 1, '#FFFFFF');
    }

    add(6, 2, 4, 1, c.roof);
    add(4, 3, 8, 1, c.roof);
    add(2, 4, 12, 1, c.roof);
    add(1, 5, 14, 1, c.roof);
    add(0, 6, 16, 1, c.roof2);

    const win = bad ? '#232841' : '#FFD23F';
    add(3, 9, 2, 2, win);
    add(11, 9, 2, 2, warn ? '#232841' : win);
    if (!bad) { add(3, 9, 1, 1, '#FFF3B0'); if (!warn) add(11, 9, 1, 1, '#FFF3B0'); }
    add(7, 11, 2, 4, bad ? '#3B3B44' : '#6B3A1E');
    if (!bad) add(8.5, 12.8, 0.4, 0.4, '#FFD23F');

    if (kind === 'health') {
      add(6, 3, 4, 3, mute('#FFFFFF'));
      add(7, 3, 2, 3, bad ? '#4B5260' : '#E5484D');
      add(6, 4, 4, 1, bad ? '#4B5260' : '#E5484D');
      add(4, 13, 1, 2, mute('#3FA34D'));
      add(10, 13, 1, 2, mute('#3FA34D'));
    }
    if (kind === 'food') {
      for (let i = 0; i < 12; i++) add(2 + i, 8, 1, 1, i % 2 ? mute('#FFFFFF') : (bad ? '#7C8791' : '#E5484D'));
      add(7, 3, 2, 1, mute('#E0A85E'));
      add(6, 4, 4, 1, mute('#C98A45'));
    }
    if (kind === 'sleep') {
      add(7, 3, 2, 2, bad ? '#8A8F96' : '#FFE07A');
      add(8, 3, 1, 1, c.roof);
    }
    if (kind === 'work') {
      if (variant === 'work') {
        add(7, 1, 2, 2, mute('#FFFFFF'));
        add(7.8, 1.3, 0.4, 0.9, '#2A2017');
        add(7.8, 1.8, 0.9, 0.4, '#2A2017');
      } else {
        add(7, 1, 2, 2, bad ? '#8A8F96' : '#FFD23F');
        add(7, 2.5, 2, 0.5, bad ? '#6E747C' : '#C9961A');
      }
      add(5, 8, 6, 1, mute('#8A2226'));
    }

    if (warn || bad) {
      add(3, 12, 1, 1, '#3B4048'); add(4, 13, 1, 1, '#3B4048'); add(12, 11, 1, 1, '#3B4048');
    }
    if (bad) {
      add(11, 12, 1, 1, '#3B4048'); add(5, 4, 1, 1, '#1C1A22'); add(10, 5, 1, 1, '#1C1A22');
      add(6, 12, 4, 1, '#8A6A4A'); add(2, 7, 2, 1, '#E6E6E6'); add(2, 8, 1, 1, '#E6E6E6'); add(4, 10, 1, 1, '#9AA4AD');
    }
    return R;
  }

  /* SVG для интерфейса (crispEdges, как в README дизайна) */
  function svg(kind, state, variant, px = 64) {
    const body = rects(kind, state, variant)
      .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.c}"/>`).join('');
    return `<svg width="${px}" height="${px}" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img">${body}</svg>`;
  }

  /* Канвас-спрайт (для мира); кэшируется по kind/state/variant */
  const cache = {};
  function canvas(kind, state, variant) {
    const key = kind + state + variant;
    if (cache[key]) return cache[key];
    const U = 8, cv = document.createElement('canvas');
    cv.width = cv.height = 16 * U;
    const g = cv.getContext('2d');
    rects(kind, state, variant).forEach(r => {
      g.fillStyle = r.c;
      g.fillRect(Math.round(r.x * U), Math.round(r.y * U), Math.max(1, Math.round(r.w * U)), Math.max(1, Math.round(r.h * U)));
    });
    return (cache[key] = cv);
  }

  return { rects, svg, canvas, stateOf };
})();
