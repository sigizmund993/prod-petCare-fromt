// Тесты фронтенда PetCare. Приложение открывается в iframe в демо-режиме (?demo=1),
// поэтому бэкенд не нужен: данные живут в localStorage. Запуск — см. test/README.md.
(() => {
  'use strict';
  const frame = document.getElementById('app');
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  const tests = [];
  let passed = 0; let failed = 0;

  const test = (name, fn) => tests.push({ name, fn });
  const group = (name) => tests.push({ group: name });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const win = () => frame.contentWindow;
  const $ = (s) => win().document.querySelector(s);
  const $$ = (s) => [...win().document.querySelectorAll(s)];
  const store = () => JSON.parse(win().localStorage.getItem('petcare_mock_store'));
  const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dk(d); };
  function assert(condition, text) { if (!condition) throw new Error(text); }
  function eq(actual, expected, text) { if (actual !== expected) throw new Error(`${text}: ожидалось «${expected}», получено «${actual}»`); }
  async function until(check, text, timeout = 3000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if (check()) return; } catch {} await wait(40); } throw new Error(`не дождались: ${text}`); }
  function set(form, name, value) { const field = form.elements[name]; field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); }
  const click = (selector) => { const node = $(selector); assert(node, `нет элемента ${selector}`); node.click(); };
  // Сохранение идёт в несколько запросов: ждём, пока форма закроется
  const closed = () => until(() => $('#modal').classList.contains('is-hidden'), 'форма закрылась', 10000);
  const page = async (name) => { click(`[data-page="${name}"]`); await wait(60); };

  // Готовые данные: подтверждённый пользователь, кот Барсик и вчерашнее напоминание
  function seed(storage) {
    storage.clear();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(10, 0, 0, 0);
    storage.setItem('petcare_mock_store', JSON.stringify({
      users: { 't@t.ru': { id: 1, email: 't@t.ru', passwd: 'qwerty1', name: 'Тест', email_verified: true, token: 'mock-t' } },
      pets: [{ id: 10, name: 'Барсик', type: 'Кошка', breed: 'британская', birth_date: '2020-05-17', own_ids: [1], prop_ids: [20], has_picture: false }],
      props: [{ id: 20, name: 'Купить корм', date: yesterday.toISOString(), rep: false, own_ids: [1], category: 'reminder', msg: null, text: null, liked: null, suitable: null, reactions: [] }],
      nextId: 100,
    }));
  }
  function load(loggedIn) {
    return new Promise((resolve) => {
      frame.onload = async () => { await wait(loggedIn ? 500 : 200); resolve(); };
      seed(localStorage);
      if (loggedIn) localStorage.setItem('petcare_access_token', 'mock-t');
      frame.src = `../index.html?demo=1&t=${Date.now()}`;
    });
  }

  // ---------- Вход и регистрация ----------
  group('Вход и регистрация');
  test('приложение открывается на экране входа', async () => { await load(false); assert(!$('#auth-screen').classList.contains('is-hidden'), 'экран входа скрыт'); });
  test('пустая форма входа подсвечивает email и пароль', async () => { $('#auth-form').requestSubmit(); await wait(30); eq($$('#auth-form .has-error').length, 2, 'полей с ошибкой'); });
  test('короткий пароль — понятная ошибка', async () => { $('#auth-email').value = 't@t.ru'; $('#auth-password').value = '123'; $('#auth-form').requestSubmit(); await wait(30); assert(/не короче 6/.test($('#auth-form .field-error').textContent), 'нет текста про длину'); });
  test('неверный пароль — «Неверный email или пароль»', async () => { $('#auth-password').value = 'wrong12'; $('#auth-form').requestSubmit(); await until(() => /Неверный email или пароль/.test($('#auth-form .field-error')?.textContent), 'ошибка пароля'); });
  test('регистрация с коротким именем — ошибка у имени', async () => { click('.tab[data-mode="register"]'); $('#auth-name').value = 'Н'; $('#auth-email').value = 'new@t.ru'; $('#auth-password').value = 'secret1'; $('#auth-form').requestSubmit(); await wait(30); assert($('#name-field').classList.contains('has-error'), 'имя не подсвечено'); $('#auth-name').value = 'Новый'; });
  test('регистрация на занятый email — ошибка у поля email', async () => { $('#auth-email').value = 't@t.ru'; $('#auth-form').requestSubmit(); await until(() => /уже зарегистрирован/.test($('#auth-form .field-error')?.textContent), 'ошибка 409'); });
  test('регистрация ведёт на экран кода', async () => { $('#auth-email').value = 'new@t.ru'; $('#auth-form').requestSubmit(); await until(() => !$('#verify-view').classList.contains('is-hidden'), 'экран кода'); });
  test('неверный код — сообщение об ошибке', async () => { $('#verify-code').value = '000000'; $('#verify-form').requestSubmit(); await until(() => /Неверный или просроченный код/.test($('#verify-message').textContent), 'ошибка кода'); });
  test('верный код входит в приложение', async () => { $('#verify-code').value = '123456'; $('#verify-form').requestSubmit(); await until(() => !$('#app-screen').classList.contains('is-hidden'), 'приложение'); });
  test('вход существующего пользователя', async () => { await load(false); $('#auth-email').value = 't@t.ru'; $('#auth-password').value = 'qwerty1'; $('#auth-form').requestSubmit(); await until(() => $('#user-name').textContent === 'Тест', 'имя в шапке'); });
  test('быстрый вход соответствует всем десяти указанным адресам', async () => { await load(false); const emails = ['example1@mail.ru', '2@example.ru', '3@example.ru', '4@example.ru', '5@example.ru', '1@example.ru', 'example7@mail.ru', 'example8@mail.ru', 'example9@mail.ru', 'example10@mail.ru']; for (const [index, email] of emails.entries()) { eq($$('#test-account option')[index].textContent, `root${index + 1} — ${email}`, `подпись root${index + 1}`); $('#test-account').value = String(index); click('#test-login-button'); await until(() => $('#menu-user-email').textContent === email, `вход root${index + 1}`); if (index < emails.length - 1) { click('#logout-button'); await until(() => !$('#auth-screen').classList.contains('is-hidden'), 'экран входа'); } } });
  test('быстрый вход предлагает 10 аккаунтов и входит в выбранный', async () => { await load(false); eq($$('#test-account option').length, 10, 'число аккаунтов'); $('#test-account').value = '5'; click('#test-login-button'); await until(() => $('#user-name').textContent === 'root6', 'вход root6'); eq($('#menu-user-email').textContent, '1@example.ru', 'email выбранного аккаунта'); });
  test('быстрый вход работает для десятого аккаунта', async () => { await load(false); $('#test-account').value = '9'; click('#test-login-button'); await until(() => $('#user-name').textContent === 'root10', 'вход root10'); eq($('#menu-user-email').textContent, 'example10@mail.ru', 'email десятого аккаунта'); });

  // ---------- Питомцы ----------
  group('Питомцы');
  test('на обзоре видны все питомцы', async () => { await load(true); eq($$('.dashboard-pets .pet-card').length, 1, 'карточек'); });
  test('карточка показывает вид, породу и возраст', async () => { assert(/Кошка · британская · \d+ (год|года|лет)/.test($('.pet-meta').textContent), $('.pet-meta').textContent); });
  test('питомец без имени не сохраняется, поле подсвечено', async () => { await page('pets'); click('[data-action="add-pet"]'); await wait(30); $('#pet-form').requestSubmit(); await wait(30); assert($('#pet-form .has-error #pet-name'), 'имя не подсвечено'); });
  test('подсветка снимается при вводе', async () => { set($('#pet-form'), 'name', 'Шарик'); assert(!$('#pet-form .has-error'), 'подсветка осталась'); });
  test('дата рождения в будущем — ошибка', async () => { set($('#pet-form'), 'birth_date', '2099-01-01'); $('#pet-form').requestSubmit(); await wait(30); assert(/будущем/.test($('#pet-form .field-error').textContent), 'нет ошибки'); });
  test('вид «Другое» показывает поле своего вида', async () => { set($('#pet-form'), 'species', 'Другое'); assert(!$('#custom-type-field').classList.contains('is-hidden'), 'поле скрыто'); set($('#pet-form'), 'species', 'Собака'); });
  test('питомец создаётся с датой рождения', async () => { set($('#pet-form'), 'birth_date', '2022-03-01'); $('#pet-form').requestSubmit(); await until(() => store().pets.some((p) => p.name === 'Шарик'), 'питомец в базе'); const pet = store().pets.find((p) => p.name === 'Шарик'); eq(pet.birth_date, '2022-03-01', 'дата рождения'); eq(pet.type, 'Собака', 'вид'); });
  test('после создания на обзоре 2 питомца', async () => { await page('dashboard'); await until(() => $$('.dashboard-pets .pet-card').length === 2, 'две карточки'); });
  test('редактирование сохраняет изменения', async () => { await page('pets'); click('[data-action="open-pet"][data-id="10"]'); await wait(40); click('[data-action="edit-pet"]'); await wait(30); set($('#pet-form'), 'breed', 'шотландская'); $('#pet-form').requestSubmit(); await until(() => store().pets.find((p) => p.id === 10).breed === 'шотландская', 'порода'); eq(store().pets.find((p) => p.id === 10).birth_date, '2020-05-17', 'дата рождения не должна сбрасываться'); });
  test('профиль питомца показывает сводку здоровья', async () => { await until(() => $$('.pet-profile .summary-tile').length === 5, '5 плиток'); });

  // ---------- Карта здоровья ----------
  group('Карта здоровья');
  test('вакцинация создаёт следующую через год', async () => { await page('health'); click('[data-action="add-record"]'); await wait(30); const f = $('#record-form'); set(f, 'petId', '10'); set(f, 'name', 'Нобивак'); set(f, 'date', daysAgo(10)); assert(/Следующая вакцинация/.test($('#next-hint').textContent), 'нет подсказки'); f.requestSubmit(); await closed(); eq(store().props.filter((p) => p.category === 'vaccination').length, 2, 'записей'); });
  test('записи привязаны к питомцу, дата рождения цела', async () => { const s = store(); const pet = s.pets.find((p) => p.id === 10); const ids = s.props.filter((p) => p.category === 'vaccination').map((p) => p.id); assert(ids.every((id) => pet.prop_ids.includes(id)), `не привязаны: записи ${ids}, у питомца ${pet.prop_ids}, сообщение «${$('#toast').textContent}», модалка ${!$('#modal').classList.contains('is-hidden')}`); eq(pet.birth_date, '2020-05-17', 'дата рождения'); });
  test('запись без названия не сохраняется', async () => { click('[data-action="add-record"]'); await wait(30); $('#record-form').requestSubmit(); await wait(30); assert($('#record-form .has-error #record-name'), 'название не подсвечено'); click('.modal-close'); });
  test('обработка от паразитов: по умолчанию через 3 месяца', async () => { click('[data-action="add-record"]'); await wait(30); set($('#record-form'), 'category', 'parasites'); eq($('#record-form').elements.next.value, '3', 'интервал'); click('.modal-close'); });
  test('курс препарата 2 раза в день × 5 дней = 10 напоминаний', async () => { click('[data-action="add-record"]'); await wait(30); const f = $('#record-form'); set(f, 'category', 'medication'); set(f, 'petId', '10'); set(f, 'name', 'Синулокс'); set(f, 'course_perDay', '2'); set(f, 'course_days', '5'); assert(/10 напоминаний/.test(f.querySelector('[data-course-hint="course_"]').textContent), 'подсказка курса'); f.requestSubmit(); await closed(); eq(store().props.filter((p) => p.name === 'Синулокс').length, 10, 'приёмов'); });
  test('курс длиннее 90 дней — ошибка', async () => { click('[data-action="add-record"]'); await wait(30); const f = $('#record-form'); set(f, 'category', 'medication'); set(f, 'name', 'X'); set(f, 'course_days', '200'); f.requestSubmit(); await wait(30); assert(/от 1 до 90/.test($('#record-form .field-error').textContent), 'нет ошибки'); click('.modal-close'); });
  test('визит с заключением и назначением препарата', async () => { click('[data-action="add-record"]'); await wait(30); const f = $('#record-form'); set(f, 'category', 'vet_visit'); set(f, 'petId', '10'); set(f, 'name', 'Осмотр'); set(f, 'date', daysAgo(1)); set(f, 'text', 'Здоров'); set(f, 'rx_name', 'Витамин'); set(f, 'rx_days', '3'); f.requestSubmit(); await closed(); eq(store().props.filter((p) => p.name === 'Витамин').length, 3, 'приёмов'); eq(store().props.find((p) => p.category === 'vet_visit').text, 'Здоров', 'заключение'); });
  test('вкладка «Вакцинации» показывает только вакцинации', async () => { click('[data-health-tab="vaccination"]'); await wait(40); const chips = $$('#page-content .event-card .category-chip').map((c) => c.textContent); assert(chips.length && chips.every((c) => c === 'Вакцинация'), chips.join()); });
  test('учёт веса: неверное значение — ошибка, верное сохраняется', async () => { const select = $('#health-pet'); select.value = '10'; select.dispatchEvent(new Event('change')); await wait(40); click('[data-health-tab="weight"]'); await wait(40); const f = $('#weight-form'); set(f, 'kg', 'abc'); f.requestSubmit(); await wait(20); assert($('#weight-form .has-error'), 'нет ошибки'); set(f, 'kg', '4,5'); f.requestSubmit(); await until(() => $('.weight-row strong')?.textContent === '4.5 кг', 'строка веса'); });

  // ---------- Питание ----------
  group('Питание');
  test('реакция автоматически ставит «не подошло»', async () => { await page('food'); click('[data-action="add-food"]'); await wait(30); const f = $('#food-form'); const gi = f.querySelector('[name="reactions"][value="gi"]'); gi.checked = true; gi.dispatchEvent(new Event('change', { bubbles: true })); eq(f.querySelector('[name="suitable"]:checked').value, 'false', 'переносимость'); });
  test('запись о корме сохраняет оценки и реакции', async () => { const f = $('#food-form'); set(f, 'petId', '10'); set(f, 'name', 'Royal Canin'); f.querySelector('[name="liked"][value="true"]').checked = true; f.requestSubmit(); await closed(); const food = store().props.find((p) => p.category === 'food'); eq(food.liked, true, 'liked'); eq(food.suitable, false, 'suitable'); eq(food.reactions.join(), 'gi', 'reactions'); });
  test('корм с реакцией попадает в «Не подходят»', async () => { await until(() => $('.food-column.bad li strong')?.textContent === 'Royal Canin', 'колонка «Не подходят»'); });
  test('запись о корме в будущем — ошибка', async () => { click('[data-action="add-food"]'); await wait(30); const f = $('#food-form'); set(f, 'name', 'Тест'); set(f, 'date', '2099-01-01'); f.requestSubmit(); await wait(30); assert($('#food-form .has-error'), 'нет ошибки'); click('.modal-close'); });
  test('фильтр «Подошло» скрывает неподошедший корм', async () => { const s = $('#food-suitable'); s.value = 'true'; s.dispatchEvent(new Event('change')); await wait(40); eq($$('#page-content .event-card').length, 0, 'карточек'); });

  // ---------- Напоминания и календарь ----------
  group('Напоминания и календарь');
  test('список ближайших событий начинается с сегодня', async () => { await page('reminders'); assert(/Сегодня/.test($('#procedure-output .calendar-day h3').textContent), 'первая группа не «Сегодня»'); });
  test('день рождения питомца есть среди событий', async () => { const s = $('#reminders-type'); s.value = 'birthday'; s.dispatchEvent(new Event('change')); await wait(40); assert(/День рождения: Барсик/.test($('#procedure-output').textContent), 'нет дня рождения'); });
  test('повторяющееся напоминание разворачивается на месяц', async () => { const t = $('#reminders-type'); t.value = ''; t.dispatchEvent(new Event('change')); await wait(30); click('[data-action="add-record"]'); await wait(30); const f = $('#record-form'); set(f, 'name', 'Таблетка'); const rep = f.elements.rep; rep.checked = true; rep.dispatchEvent(new Event('change', { bubbles: true })); set(f, 'period', 'еженедельно'); f.requestSubmit(); await until(() => $$('#procedure-output .event-card h3').filter((h) => h.textContent === 'Таблетка').length >= 4, '≥4 повтора'); });
  test('календарь листает месяцы много раз', async () => { click('[data-view="calendar"]'); await wait(40); const first = $('.calendar-month-header h3').textContent; for (let i = 0; i < 3; i++) { click('[data-calendar-month="next"]'); await wait(20); } for (let i = 0; i < 3; i++) { click('[data-calendar-month="prev"]'); await wait(20); } eq($('.calendar-month-header h3').textContent, first, 'вернулись к месяцу'); });
  test('клик по дате показывает события дня', async () => { click('[data-calendar-today]'); await wait(30); assert($$('.calendar-selected-day .event-card').length > 0, 'нет событий за сегодня'); });
  test('удаление записи через диалог подтверждения', async () => { const before = store().props.length; click('.calendar-selected-day [data-action="delete-prop"]'); await wait(30); assert($('.modal-card h2'), 'нет диалога'); click($('[data-choice="all"]') ? '[data-choice="all"]' : '#confirm-ok'); await until(() => store().props.length < before, 'запись удалена'); });

  // ---------- Уведомления ----------
  group('Уведомления');
  test('колокольчик показывает число уведомлений', async () => { await load(true); await until(() => !$('#bell-count').classList.contains('is-hidden'), 'счётчик'); eq($('#bell-count').textContent, '1', 'счётчик'); });
  test('баннер на обзоре открывает уведомления', async () => { click('.notice-banner'); await until(() => $$('.notification-item').length === 1, 'список'); });
  test('«Прочитано» убирает уведомление', async () => { click('[data-read-id]'); await until(() => $('#bell-count').classList.contains('is-hidden'), 'счётчик скрыт'); click('.modal-close'); });

  // ---------- Аккаунт и сессия ----------
  group('Аккаунт и сессия');
  test('неверный текущий пароль не даёт сохранить профиль', async () => { await page('profile'); const f = $('#profile-form'); set(f, 'passwd', 'nope123'); f.requestSubmit(); await until(() => /Неверный текущий пароль/.test($('#profile-form .field-error')?.textContent), 'ошибка'); });
  test('неверный телефон — понятная ошибка', async () => { const f = $('#profile-form'); set(f, 'passwd', 'qwerty1'); set(f, 'phone_number', '12'); f.requestSubmit(); await wait(30); assert(/\+79990000000/.test($('#profile-form .field-error').textContent), 'нет ошибки'); });
  test('профиль сохраняется, пароль не меняется', async () => { const f = $('#profile-form'); set(f, 'name', 'Тестер'); set(f, 'phone_number', '+79990000000'); f.requestSubmit(); await until(() => $('#user-name').textContent === 'Тестер', 'имя'); eq(store().users['t@t.ru'].passwd, 'qwerty1', 'пароль'); });
  test('удаление питомца из его профиля', async () => { await page('pets'); click('[data-action="open-pet"][data-id="10"]'); await wait(40); click('[data-action="delete-pet"][data-id="10"]'); await wait(30); click('#confirm-ok'); await until(() => !store().pets.length, 'питомец удалён'); });
  test('истёкшая сессия возвращает на вход', async () => { win().localStorage.setItem('petcare_access_token', 'bad'); click('#bell-button'); await until(() => /Сессия истекла/.test($('#auth-message').textContent), 'сообщение'); });

  // ---------- Запуск ----------
  async function run() {
    list.innerHTML = ''; passed = 0; failed = 0;
    win()?.addEventListener?.('error', () => {});
    for (const item of tests) {
      const li = document.createElement('li');
      if (item.group) { li.className = 'group'; li.textContent = item.group; list.append(li); continue; }
      li.textContent = item.name; list.append(li);
      try { await item.fn(); li.className = 'pass'; passed++; } catch (error) { li.className = 'fail'; li.innerHTML += `<small>${String(error.message || error).replace(/</g, '&lt;')}</small>`; failed++; }
      summary.textContent = `Пройдено ${passed}, упало ${failed}, всего ${tests.filter((t) => !t.group).length}`;
    }
    summary.textContent = failed ? `❌ Упало ${failed} из ${passed + failed}` : `✅ Все ${passed} тестов прошли`;
    document.title = failed ? `FAIL ${failed}` : `PASS ${passed}`;
  }
  document.getElementById('rerun').addEventListener('click', run);
  run();
})();
