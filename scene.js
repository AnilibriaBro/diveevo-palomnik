// Живая обложка: небо, свет и погода — как сейчас в Дивеево.
// Высота солнца считается по координатам дома, погода — Open-Meteo (бесплатно, без ключа).
// Для показа: ?time=06:30 (московское время) и ?weather=clear|clouds|overcast|rain|snow|fog|storm
(() => {
  const scene = document.querySelector('[data-scene]');
  if (!scene) return;
  const LAT = 55.0235, LON = 43.2453;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const $ = s => scene.querySelector(s);
  const hero = scene.closest('.hero');
  const layers = Object.fromEntries([...scene.querySelectorAll('[data-layer]')].map(el => [el.dataset.layer, el]));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ramp = (v, a, b) => clamp((v - a) / (b - a));           // 0 → 1 между a и b
  const mix = (a, b, t) => a + (b - a) * t;

  // --- Солнце: высота над горизонтом и утро ли (до полудня по солнцу)
  function sun(date) {
    const r = Math.PI / 180;
    const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
    const g = (357.529 + 0.98560028 * d) * r;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r;
    const e = (23.439 - 0.00000036 * d) * r;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / r;
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    let H = ((gmst * 15 + LON - ra) % 360 + 540) % 360 - 180;     // часовой угол, −180…180
    const alt = Math.asin(Math.sin(LAT * r) * Math.sin(dec) + Math.cos(LAT * r) * Math.cos(dec) * Math.cos(H * r)) / r;
    return { alt, morning: H < 0 };
  }

  function now() {
    const t = params.get('time');
    if (t && /^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(':').map(Number);
      const d = new Date();
      // Дивеево живёт по московскому времени (UTC+3 круглый год)
      const msk = new Date(d.getTime() + 3 * 36e5);
      return new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate(), h - 3, m));
    }
    return new Date();
  }

  // --- Погода
  const KINDS = ['clear', 'clouds', 'overcast', 'rain', 'snow', 'fog', 'storm'];
  let weather = { kind: 'clear', cover: 10, amount: 0, wind: 2 };
  function fromCode(c, cover) {
    if (c >= 95) return 'storm';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if (c === 45 || c === 48) return 'fog';
    if (c === 3 || cover > 80) return 'overcast';
    if (c === 2 || cover > 35) return 'clouds';
    return 'clear';
  }
  async function loadWeather() {
    const forced = params.get('weather');
    if (KINDS.includes(forced)) {
      weather = { kind: forced, cover: { clear: 5, clouds: 50 }[forced] ?? 95, amount: 1.5, wind: 4 };
      return;
    }
    const KEY = 'diveevo-weather';
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (saved && Date.now() - saved.at < 15 * 6e4) { weather = saved.w; return; }
    } catch (e) { /* хранилище недоступно — просто спросим заново */ }
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=weather_code,cloud_cover,precipitation,wind_speed_10m&timezone=Europe%2FMoscow`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const c = (await res.json()).current;
      weather = { kind: fromCode(c.weather_code, c.cloud_cover), cover: c.cloud_cover, amount: c.precipitation, wind: c.wind_speed_10m / 3.6 };
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), w: weather })); } catch (e) { /* не важно */ }
    } catch (e) { /* нет сети — остаётся ясно */ }
  }

  // --- Сборка кадра
  const set = (k, v) => scene.style.setProperty(k, v);
  function load(name) {
    const el = layers[name];
    if (el && !el.src) el.src = el.dataset.src;
  }
  function render() {
    const { alt, morning } = sun(now());
    const k = weather.kind;
    const grey = ['overcast', 'rain', 'snow', 'fog', 'storm'].includes(k);

    // доли состояний: ночь, сумерки, «как на фото» (вечер), рассвет, день
    const day = ramp(alt, 3, 14);
    const night = 1 - ramp(alt, -13, -7);
    const glow = clamp(1 - Math.abs(alt + 1) / 8) * (1 - night);   // вечерняя/утренняя зорька
    const photo = morning || grey ? 0 : glow;                        // своё небо фото — только ясным вечером
    const dawn = morning && !grey ? glow : 0;

    // слои неба
    const op = { night: 0, dawn: 0, day: 0, clouds: 0, overcast: 0 };
    op.night = grey ? 0 : night;
    op.dawn = dawn;
    const dayLayer = grey ? 'overcast' : k === 'clouds' ? 'clouds' : 'day';
    op[dayLayer] = Math.max(op[dayLayer], grey ? 1 - night * .15 : day);
    for (const [name, el] of Object.entries(layers)) {
      if (op[name] > 0) load(name);
      el.style.opacity = op[name].toFixed(3);
    }
    // цвет неба: ночью пасмурное небо — тёмное, днём — светлее
    const skyB = mix(mix(.55, 1, day), .22, night);
    layers.overcast.style.setProperty('--f', `brightness(${skyB.toFixed(2)}) saturate(${grey ? .85 : 1})`);
    layers.day.style.setProperty('--f', `brightness(${mix(.85, 1.02, day).toFixed(2)})`);
    layers.clouds.style.setProperty('--f', `brightness(${mix(.8, 1, day).toFixed(2)})`);
    layers.night.style.setProperty('--f', `brightness(${mix(1.25, .95, ramp(-alt, 7, 16)).toFixed(2)})`);
    layers.dawn.style.setProperty('--f', `brightness(${mix(.75, 1.05, ramp(alt, -6, 2)).toFixed(2)})`);
    // градиент под небом — для сумерек
    // три набора цветов: ночь → сумерки → день
    const tw = clamp(1 - day - night);
    const pal = (n, t, d) => n.map((v, i) => Math.round(v * night + t[i] * tw + d[i] * day));
    const rgb = a => `rgb(${a.join(', ')})`;
    set('--g1', rgb(pal([11, 20, 48], [44, 66, 112], [86, 140, 204])));
    set('--g2', rgb(pal([30, 40, 70], [112, 112, 150], [140, 186, 230])));
    set('--g3', rgb(pal([52, 60, 88], [222, 160, 140], [196, 222, 242])));
    set('--sky-a', (1 - photo).toFixed(3));

    // дом: яркость, насыщенность, оттенок; окна светятся в темноте
    const b = mix(mix(1, 1.3, day), .4, night) * (grey ? mix(1, .85, day) : 1);
    const s = mix(mix(1, .92, day), .7, night) * (grey ? .82 : 1);
    set('--grade', `brightness(${b.toFixed(2)}) saturate(${s.toFixed(2)}) contrast(${mix(mix(1, .95, day), 1.06, night).toFixed(2)})`);
    set('--tint', night > .2 ? '#3d5285' : day > .5 ? (grey ? '#c9d2da' : '#dbe7f7') : '#ffd2a0');
    set('--tint-a', (night > .2 ? .42 * night : day > .5 ? .18 * day : .14 * glow).toFixed(3));
    set('--lights', clamp(mix(.15, .9, night + glow * .4) - day * .6).toFixed(3));
    set('--unlit', (day * .75).toFixed(3));
    hero && hero.style.setProperty('--shade-top', mix(.62, .32, day).toFixed(2));

    // солнце и луна
    const sunVisible = !grey && alt > -1.5 && alt < 40 && !photo;
    set('--sun', sunVisible ? (.55 + .45 * ramp(alt, -1, 6)).toFixed(2) : 0);
    set('--sx', morning ? '22%' : '78%');
    set('--sy', `${mix(46, 8, ramp(alt, 0, 32)).toFixed(1)}%`);
    set('--moon', (!grey && night > .6) ? .95 : 0);

    // погода
    set('--fog', k === 'fog' ? mix(.75, .55, day) : k === 'snow' ? .25 : 0);
    particles.kind = k === 'storm' ? 'rain' : k;
    particles.amount = clamp((weather.amount || 1) / 3, .35, 1);
    particles.wind = Math.min(weather.wind || 2, 10);
    particles.reset();
    storm(k === 'storm');
  }

  // --- Дождь и снег
  const cv = $('[data-weather]');
  const ctx = cv.getContext('2d');
  const particles = {
    kind: 'clear', amount: 0, wind: 2, list: [], running: false, visible: true,
    reset() {
      const W = cv.width = scene.clientWidth * devicePixelRatio;
      const H = cv.height = scene.clientHeight * devicePixelRatio;
      const n = this.kind === 'rain' ? 260 : this.kind === 'snow' ? 170 : 0;
      this.list = Array.from({ length: Math.round(n * this.amount * (W / 1600 + .4)) }, () => this.spawn(W, H, true));
      ctx.clearRect(0, 0, W, H);
      this.start();
    },
    spawn(W, H, anywhere) {
      const z = .4 + Math.random() * .6;   // ближе — крупнее и быстрее
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -20, z, ph: Math.random() * 6.28 };
    },
    step() {
      const W = cv.width, H = cv.height, dpr = devicePixelRatio;
      ctx.clearRect(0, 0, W, H);
      if (this.kind === 'rain') {
        ctx.strokeStyle = 'rgba(214, 226, 238, .5)';
        ctx.lineCap = 'round';
        for (const p of this.list) {
          const vy = 22 * p.z * dpr, vx = this.wind * .8 * p.z * dpr;
          ctx.lineWidth = p.z * 1.3 * dpr;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + vx * 1.4, p.y + vy * 1.4); ctx.stroke();
          p.x += vx; p.y += vy;
          if (p.y > H) Object.assign(p, this.spawn(W, H));
        }
      } else if (this.kind === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, .85)';
        for (const p of this.list) {
          p.ph += .02;
          p.x += (Math.sin(p.ph) * .6 + this.wind * .15) * p.z * dpr;
          p.y += 1.3 * p.z * dpr;
          ctx.globalAlpha = .45 + p.z * .5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.z * 2.4 * dpr, 0, 6.283); ctx.fill();
          if (p.y > H || p.x > W + 20) Object.assign(p, this.spawn(W, H));
        }
        ctx.globalAlpha = 1;
      }
    },
    start() {
      if (this.running || !this.list.length || reduce) {
        if (reduce && this.list.length) this.step();   // без движения — один неподвижный кадр
        return;
      }
      this.running = true;
      const loop = () => {
        if (!this.visible || !this.list.length) { this.running = false; return; }
        this.step();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  };

  // --- Гроза: редкие вспышки
  let flashTimer = 0;
  function storm(on) {
    clearTimeout(flashTimer);
    if (!on || reduce) return;
    const flash = () => {
      scene.classList.add('is-flash');
      setTimeout(() => scene.classList.remove('is-flash'), 90);
      setTimeout(() => { scene.classList.add('is-flash'); setTimeout(() => scene.classList.remove('is-flash'), 60); }, 180);
      flashTimer = setTimeout(flash, 7000 + Math.random() * 12000);
    };
    flashTimer = setTimeout(flash, 3000);
  }

  // анимация — только пока обложка на экране
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      particles.visible = en.isIntersecting;
      if (en.isIntersecting) particles.start();
    }).observe(scene);
  }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => particles.reset(), 200); });

  render();                                    // сразу — по времени, погода догонит
  loadWeather().then(render);
  setInterval(() => { loadWeather().then(render); }, 5 * 6e4);
})();
