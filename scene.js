// Живая обложка: свет и погода — как сейчас в Дивеево. Фото дома не меняется, меняется только свет кадра.
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
  function render() {
    const { alt } = sun(now());
    const k = weather.kind;
    const grey = ['overcast', 'rain', 'snow', 'fog', 'storm'].includes(k);
    const night = 1 - ramp(alt, -12, -4);          // 0 днём и вечером, 1 глубокой ночью
    const dusk = ramp(alt, -12, -4) * (1 - ramp(alt, -4, 0)); // поздние сумерки
    const dim = Math.max(night, dusk * .45);

    // весь кадр: ночью темнее и холоднее, в непогоду — приглушённее
    const b = mix(1, .58, dim) * (grey ? .9 : 1);
    const sat = mix(1, .72, dim) * (grey ? .72 : 1);
    set('--grade', `brightness(${b.toFixed(3)}) saturate(${sat.toFixed(3)})`);
    set('--night', dim.toFixed(3));
    set('--haze', grey ? mix(.85, .45, dim).toFixed(3) : 0);
    set('--lights', clamp(.15 + dim * .85).toFixed(3));
    set('--stars', !grey && night > .3 ? night.toFixed(3) : 0);
    set('--moon', !grey && night > .6 ? .9 : 0);
    hero && hero.style.setProperty('--shade-top', mix(.5, .25, dim).toFixed(2));
    if (scene.style.getPropertyValue('--stars') !== '0') stars();

    // погода
    set('--fog', k === 'fog' ? .7 : k === 'snow' ? .2 : 0);
    particles.kind = k === 'storm' ? 'rain' : k;
    particles.amount = clamp((weather.amount || 1) / 3, .35, 1);
    particles.wind = Math.min(weather.wind || 2, 10);
    particles.reset();
    storm(k === 'storm');
  }

  // --- Звёзды: рисуются один раз, мерцание — мягкое
  const sc = $('[data-stars]');
  let starsDone = false;
  function stars() {
    if (starsDone) return;
    starsDone = true;
    const W = sc.width = scene.clientWidth * devicePixelRatio;
    const H = sc.height = scene.clientHeight * devicePixelRatio;
    const g = sc.getContext('2d');
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.round(W * H / 5200);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H * .32, r = (rnd() ** 3 * 1.3 + .35) * devicePixelRatio;
      g.globalAlpha = .35 + rnd() * .65;
      g.fillStyle = rnd() > .85 ? '#ffe9c4' : '#f4f7ff';
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
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
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { particles.reset(); starsDone = false; render(); }, 200); });

  render();                                    // сразу — по времени, погода догонит
  loadWeather().then(render);
  setInterval(() => { loadWeather().then(render); }, 5 * 6e4);
})();
