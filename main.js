(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Шапка становится светлой после первого экрана
  const top = $('[data-top]');
  const float = $('[data-float]');
  const hero = $('.hero');
  const onScroll = () => {
    const past = scrollY > 40;
    top.classList.toggle('is-solid', past || !$('[data-menu]').hidden);
    if (float && hero) float.classList.toggle('is-on', scrollY > hero.offsetHeight * .8);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Меню на телефоне
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  const setMenu = open => {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.hidden = !open;
    onScroll();
  };
  burger.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  // Рябь на отражении названия
  const turb = $('[data-turb]');
  const pondEl = $('[data-pond]');
  if (turb && pondEl && !reduce && 'IntersectionObserver' in window) {
    let t = 0, running = false;
    const tick = () => {
      if (!running) return;
      t += 0.006;
      turb.setAttribute('baseFrequency', `${0.008 + Math.sin(t) * 0.002} ${0.09 + Math.cos(t * 1.3) * 0.02}`);
      requestAnimationFrame(tick);
    };
    // Рябь считается, только пока пруд на экране
    new IntersectionObserver(([en]) => {
      const was = running;
      running = en.isIntersecting;
      if (running && !was) requestAnimationFrame(tick);
    }).observe(pondEl);
  }

  // Поиск по датам → страница бронирования Bnovo
  const form = $('[data-search]');
  if (form) {
    const from = $('[data-from]', form), to = $('[data-to]', form), out = $('[data-guests]', form);
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    from.min = iso(today); from.value = iso(today);
    to.min = iso(tomorrow); to.value = iso(tomorrow);
    from.addEventListener('change', () => {
      const next = new Date(from.value); next.setDate(next.getDate() + 1);
      to.min = iso(next);
      if (!to.value || to.value <= from.value) to.value = iso(next);
    });
    let guests = 2;
    $$('[data-step]', form).forEach(b => b.addEventListener('click', () => {
      guests = Math.min(4, Math.max(1, guests + Number(b.dataset.step)));
      out.textContent = guests;
    }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ru = v => v.split('-').reverse().join('-'); // ГГГГ-ММ-ДД → ДД-ММ-ГГГГ, как ждёт Bnovo
      location.href = `booking.html?dfrom=${ru(from.value)}&dto=${ru(to.value)}&adults=${guests}`;
    });
  }

  // Карточки комнат
  const list = $('[data-rooms]');
  const fmt = n => n.toLocaleString('ru-RU');
  if (list && window.ROOMS) {
    list.innerHTML = ROOMS.map((r, i) => {
      const pics = Array.from({ length: r.photos }, (_, k) => `img/${r.key}-${k + 1}.jpg`);
      return `<article class="room">
        <div class="room__gallery">
          <div class="room__track" data-track>
            ${pics.map((p, k) => `<button type="button" data-open="${i}:${k}" aria-label="Открыть фото ${k + 1} из ${pics.length}"><img src="${p}" alt="${r.name}, фото ${k + 1}" loading="lazy" width="1050" height="600"></button>`).join('')}
          </div>
          <div class="room__dots" aria-hidden="true">${pics.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>
          <div class="room__arrows">
            <button type="button" data-slide="-1" aria-label="Предыдущее фото">‹</button>
            <button type="button" data-slide="1" aria-label="Следующее фото">›</button>
          </div>
        </div>
        <div class="room__body">
          <div class="room__meta"><span>до ${r.guests} гостей</span><span>${r.area} м²</span></div>
          <h3>${r.name}</h3>
          <p>${r.text}</p>
          <ul class="room__perks">${r.perks.map(p => `<li>${p}</li>`).join('')}</ul>
          <div class="room__foot">
            <p class="room__price">от ${fmt(r.price)} ₽<small>за комнату за ночь</small></p>
            <a class="btn btn--line" href="booking.html?adults=${r.guests}">Выбрать даты</a>
          </div>
        </div>
      </article>`;
    }).join('');

    $$('.room').forEach(room => {
      const track = $('[data-track]', room);
      const dots = $$('.room__dots i', room);
      $$('[data-slide]', room).forEach(b => b.addEventListener('click', () => {
        const w = track.clientWidth, n = dots.length;
        let k = Math.round(track.scrollLeft / w) + Number(b.dataset.slide);
        k = (k + n) % n;
        track.scrollTo({ left: k * w, behavior: reduce ? 'auto' : 'smooth' });
      }));
      track.addEventListener('scroll', () => {
        const k = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, j) => d.classList.toggle('on', j === k));
      }, { passive: true });
    });
  }

  // Просмотр фото во весь экран
  const box = $('[data-lightbox]');
  const boxImg = $('[data-lightbox-img]');
  let cur = null;
  const show = () => {
    const r = ROOMS[cur.room];
    boxImg.src = `img/${r.key}-${cur.k + 1}.jpg`;
    boxImg.alt = `${r.name}, фото ${cur.k + 1}`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    const [room, k] = b.dataset.open.split(':').map(Number);
    cur = { room, k };
    show();
    box.showModal();
  });
  $$('[data-lightbox-step]').forEach(b => b.addEventListener('click', () => {
    const n = ROOMS[cur.room].photos;
    cur.k = (cur.k + Number(b.dataset.lightboxStep) + n) % n;
    show();
  }));
  $('[data-lightbox-close]').addEventListener('click', () => box.close());
  box.addEventListener('click', e => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') $('[data-lightbox-step="1"]').click();
    if (e.key === 'ArrowLeft') $('[data-lightbox-step="-1"]').click();
  });

  // Фото раскрываются при прокрутке
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    $$('.about__photos img, .strip img, .room__gallery').forEach(el => { el.classList.add('reveal'); io.observe(el); });
    const pond = $('[data-pond]');
    if (pond) io.observe(pond);
  } else {
    $$('[data-pond]').forEach(el => el.classList.add('is-in'));
  }

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
