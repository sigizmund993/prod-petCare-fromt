(() => {
  'use strict';
  const USE_MOCK_API = new URLSearchParams(location.search).get('demo') === '1';
  // Локально (Live Server и т.п. на localhost) прокси /api нет — ходим в бэкенд напрямую, CORS для localhost разрешён.
  // На сервере запросы идут через nginx (/api → бэкенд), см. nginx.conf
  const IS_FILE = location.protocol === 'file:';
  const IS_LOCAL = IS_FILE || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const API = IS_LOCAL ? 'http://139.100.200.207:8080' : '/api';
  const RUN_HINT = 'Откройте сайт через локальный сервер по адресу localhost или 127.0.0.1 (например, Live Server в VS Code) — так бэкенд разрешает запросы. Инструкция в README.md.';
  const MOCK_CODE = '123456';
  const TOKEN_KEY = 'petcare_access_token';
  const SPECIES = ['Кошка', 'Собака', 'Птица', 'Грызун', 'Рептилия', 'Рыба', 'Другое'];
  const CATEGORIES = {
    vaccination: { label: 'Вакцинация', icon: '💉', placeholder: 'Например, Нобивак Rabies' },
    parasites: { label: 'Обработка от паразитов', icon: '🛡️', placeholder: 'Например, Бравекто' },
    vet_visit: { label: 'Визит к ветеринару', icon: '🩺', placeholder: 'Например, плановый осмотр' },
    medication: { label: 'Приём препарата', icon: '💊', placeholder: 'Название препарата' },
    reminder: { label: 'Напоминание', icon: '🔔', placeholder: 'Например, купить корм' },
    food: { label: 'Корм', icon: '🥣', placeholder: 'Например, Royal Canin Sterilised' },
    birthday: { label: 'День рождения', icon: '🎂', placeholder: '' },
  };
  const RECORD_CATEGORIES = ['vaccination', 'parasites', 'vet_visit', 'medication', 'reminder'];
  const HEALTH_CATEGORIES = ['vaccination', 'parasites', 'vet_visit', 'medication'];
  const NEXT_INTERVALS = [['', 'Не планировать'], ['1', 'Через 1 месяц'], ['3', 'Через 3 месяца'], ['6', 'Через 6 месяцев'], ['12', 'Через 1 год']];
  const DEFAULT_NEXT = { vaccination: '12', parasites: '3' };
  const PERIODS = [['ежедневно', 'Каждый день'], ['еженедельно', 'Каждую неделю'], ['ежемесячно', 'Каждый месяц'], ['ежегодно', 'Каждый год']];
  const REACTIONS = { gi: 'Проблемы с ЖКТ', allergy: 'Аллергия', other: 'Другая реакция' };
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
  const MAX_COURSE_DOSES = 120;
  const POLL_INTERVAL = 45000;
  const ERROR_TEXT = {
    'Invalid credentials': 'Неверный email или пароль.',
    'Wrong email or password': 'Неверный email или пароль.',
    'Email not verified': 'Email ещё не подтверждён.',
    'Email already registered': 'Этот email уже зарегистрирован. Попробуйте войти.',
    'Phone number already registered': 'Этот номер телефона уже используется другим аккаунтом.',
    'Wrong or expired code': 'Неверный или просроченный код. Отправьте код ещё раз.',
    'Pet not found': 'Питомец не найден — возможно, он уже удалён.',
    'Prop not found': 'Запись не найдена — возможно, она уже удалена.',
    'Notification not found': 'Уведомление уже прочитано.',
    'Not authenticated': 'Нужно войти в аккаунт.',
    'User not found': 'Пользователь не найден.',
  };
  const now = new Date();
  const state = {
    user: null, pets: [], props: [], notifications: [], notificationCount: 0, page: 'dashboard', authMode: 'login', verifyEmail: '',
    editingPet: null, editingProp: null, selectedPet: null, photoUrls: {}, pollTimer: null, confirmResolve: null,
    healthPet: '', healthTab: 'all', foodPet: '', foodLiked: '', foodSuitable: '', remindersPet: '', remindersType: '', remindersDate: '',
    procedureView: 'list', calendarMonth: new Date(now.getFullYear(), now.getMonth(), 1), calendarSelectedDate: '',
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const el = { authScreen: $('#auth-screen'), appScreen: $('#app-screen'), authForm: $('#auth-form'), authMessage: $('#auth-message'), authName: $('#auth-name'), authEmail: $('#auth-email'), authPassword: $('#auth-password'), nameField: $('#name-field'), termsField: $('#terms-field'), terms: $('#terms'), authSubmit: $('#auth-submit'), authHint: $('#auth-hint'), verifyView: $('#verify-view'), authView: $('#auth-view'), verifyForm: $('#verify-form'), verifyEmail: $('#verify-email'), verifyCode: $('#verify-code'), verifyMessage: $('#verify-message'), resend: $('#resend-button'), resendStatus: $('#resend-status'), pageTitle: $('#page-title'), pageContent: $('#page-content'), appMessage: $('#app-message'), modal: $('#modal'), modalContent: $('#modal-content'), toast: $('#toast'), bellCount: $('#bell-count') };

  // ---------- Общие помощники ----------
  let toastTimer;
  function notify(text, type = 'success') { el.toast.textContent = text; el.toast.style.background = type === 'error' ? '#a53e3e' : 'var(--green)'; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3600); }
  function message(node, text, type = 'error') { node.textContent = text; node.className = `message is-visible ${type}`; }
  function clearMessage(node) { node.textContent = ''; node.className = 'message'; }
  function busy(button, value, text = 'Сохраняем…') { if (!button) return; if (!button.dataset.default) button.dataset.default = button.textContent; button.disabled = value; button.textContent = value ? text : button.dataset.default; }
  function escapeHtml(value = '') { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }
  function plural(n, forms) { const a = Math.abs(n) % 100; const b = a % 10; if (a > 10 && a < 20) return forms[2]; if (b > 1 && b < 5) return forms[1]; if (b === 1) return forms[0]; return forms[2]; }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ---------- Даты ----------
  // API отдаёт даты с часовым поясом; строки без него считаем UTC, а 'YYYY-MM-DD' — локальным днём
  function parseDate(value) { if (!value) return null; if (value instanceof Date) return value; const text = String(value); if (text.length <= 10) return new Date(`${text}T00:00:00`); return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`); }
  function dayKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function dateOnly(value) { const date = parseDate(value); return date && !isNaN(date) ? dayKey(date) : ''; }
  function timeOf(value) { const date = parseDate(value); return date && !isNaN(date) ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : ''; }
  function startOfDay(date = new Date()) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
  function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
  function addMonths(date, months) { const result = new Date(date); const day = result.getDate(); result.setDate(1); result.setMonth(result.getMonth() + months); result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate())); return result; }
  function toIso(day, time) { return new Date(`${day}T${time || '00:00'}:00`).toISOString(); }
  function formatDate(value, includeTime = true) { if (!value) return 'Дата не указана'; const date = parseDate(value); if (!date || isNaN(date)) return 'Дата не указана'; const options = includeTime ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long' }; if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'; return date.toLocaleString('ru-RU', options); }
  function dayLabel(key) { return formatDate(new Date(`${key}T12:00:00`), false); }
  function daysFromToday(value) { return Math.round((startOfDay(parseDate(value)) - startOfDay()) / 86400000); }
  function relativeDay(value) { const diff = daysFromToday(value); if (diff === 0) return 'Сегодня'; if (diff === 1) return 'Завтра'; if (diff === -1) return 'Вчера'; if (diff > 1 && diff <= 30) return `Через ${diff} ${plural(diff, ['день', 'дня', 'дней'])}`; return ''; }
  function ageText(birthDate) { const birth = parseDate(birthDate); if (!birth) return ''; const today = new Date(); let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth(); if (today.getDate() < birth.getDate()) months--; if (months < 1) return 'меньше месяца'; if (months < 12) return `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`; const years = Math.floor(months / 12); return `${years} ${plural(years, ['год', 'года', 'лет'])}`; }
  const byDateAsc = (a, b) => parseDate(a.date) - parseDate(b.date);
  const byDateDesc = (a, b) => parseDate(b.date) - parseDate(a.date);

  // ---------- Ошибки и валидация форм ----------
  function translateValidation(item) { const msg = String(item?.msg || ''); if (/future/i.test(msg)) return 'Дата не может быть в будущем.'; if (item?.type === 'missing') return 'Обязательное поле.'; if (/date|datetime/i.test(item?.type || '')) return 'Укажите корректную дату.'; return 'Проверьте значение поля.'; }
  function apiError(error) {
    if (error?.message === 'NETWORK') return IS_FILE ? `Сайт открыт как файл, и браузер блокирует запросы к серверу. ${RUN_HINT}` : 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.';
    // 405 приходит, когда сайт раздаёт обычный статический сервер без прокси /api (например, Live Server по IP сети)
    if (error?.status === 405) return `Сервер не принимает запросы по этому адресу. ${RUN_HINT}`;
    if (error?.status === 413) return 'Файл слишком большой — максимум 5 МБ.';
    if (error?.status >= 500) return 'Сервер временно недоступен. Попробуйте чуть позже.';
    if (Array.isArray(error?.detail)) return error.detail.map(translateValidation).join(' ');
    if (error?.detail && ERROR_TEXT[error.detail]) return ERROR_TEXT[error.detail];
    if (error?.status === 400 && /photo|image|file|content/i.test(error?.detail || '')) return 'Не удалось загрузить фото: подойдут JPEG, PNG или WebP до 5 МБ.';
    return error?.detail || `Что-то пошло не так (ошибка ${error?.status || 'сети'}).`;
  }
  function fieldOf(input) { return input.closest('.field') || input.closest('.checkbox-row') || input.parentElement; }
  function setFieldError(form, name, text) { const control = form.elements[name]; if (!control) return false; const input = control instanceof RadioNodeList ? control[0] : control; const field = fieldOf(input); field.classList.add('has-error'); let hint = field.querySelector('.field-error'); if (!hint) { hint = document.createElement('small'); hint.className = 'field-error'; field.append(hint); } hint.textContent = text; return true; }
  function clearFieldErrors(form) { form.querySelectorAll('.has-error').forEach((node) => node.classList.remove('has-error')); form.querySelectorAll('.field-error').forEach((node) => node.remove()); }
  function showErrors(form, errors) { clearFieldErrors(form); errors.forEach(([name, text]) => setFieldError(form, name, text)); form.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus(); return errors.length === 0; }
  function applyApiFieldErrors(form, error) { if (!Array.isArray(error?.detail)) return false; let applied = false; error.detail.forEach((item) => { if (setFieldError(form, item.loc?.at(-1), translateValidation(item))) applied = true; }); return applied; }

  // ---------- Запросы к API ----------
  async function api(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    let response;
    try { response = await fetch(API + path, { method: options.method || 'GET', headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined }); } catch { throw { message: 'NETWORK' }; }
    if (response.status === 204) return null;
    const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
    if (!response.ok) throw { status: response.status, detail: data.detail };
    return data;
  }
  async function request(path, options = {}) {
    try { return USE_MOCK_API ? await mockApi(path, options) : await api(path, options); } catch (error) {
      // Токен живёт 24 часа и не обновляется: на 401 отправляем на вход
      if (state.user && (error?.status === 401 || (error?.status === 403 && error?.detail === 'Not authenticated')) && !path.startsWith('/user/login')) sessionExpired();
      throw error;
    }
  }

  // ---------- Демо-режим (?demo=1): имитация API в localStorage ----------
  function mockStore() { const store = JSON.parse(localStorage.getItem('petcare_mock_store') || '{"users":{},"pets":[],"props":[]}'); store.reads ||= {}; store.birthdayReads ||= {}; store.nextId ||= Math.max(100, ...store.pets.map((p) => p.id), ...store.props.map((p) => p.id)) + 1; return store; }
  function saveMock(store) { localStorage.setItem('petcare_mock_store', JSON.stringify(store)); }
  function mockApi(path, options = {}) { return new Promise((resolve, reject) => setTimeout(() => { try { resolve(mockHandle(path, options)); } catch (error) { reject(error); } }, 80)); }
  function mockHandle(path, options) {
    const [route, query] = path.split('?'); const q = new URLSearchParams(query || ''); const store = mockStore(); const body = options.body || {}; const method = options.method || 'GET';
    const fail = (status, detail) => { throw { status, detail }; };
    const publicUser = (u) => ({ id: u.id, email: u.email, phone_number: u.phone_number || null, name: u.name, email_verified: !!(u.email_verified ?? u.verified) });
    const byEmail = (email) => store.users[email];
    if (route === '/user/add') { if (byEmail(body.email)) fail(409, 'Email already registered'); store.users[body.email] = { id: store.nextId++, email: body.email, passwd: body.passwd, name: body.name, phone_number: null, email_verified: false, token: `mock-${Date.now()}` }; saveMock(store); return publicUser(store.users[body.email]); }
    if (route === '/user/verify/resend') return null;
    if (route === '/user/verify') { const u = byEmail(body.email); if (!u || body.code !== MOCK_CODE) fail(400, 'Wrong or expired code'); u.email_verified = true; saveMock(store); return { access_token: u.token, token_type: 'bearer' }; }
    if (route === '/user/login') { const u = byEmail(body.email); if (!u || u.passwd !== body.passwd) fail(401, 'Invalid credentials'); if (!(u.email_verified ?? u.verified)) fail(403, 'Email not verified'); return { access_token: u.token, token_type: 'bearer' }; }
    const token = localStorage.getItem(TOKEN_KEY); const user = Object.values(store.users).find((u) => u.token === token);
    if (!user) fail(401, 'Not authenticated');
    const mine = (item) => (item.own_ids || []).includes(user.id);
    const findPet = (id) => store.pets.find((p) => p.id === Number(id) && mine(p)) || fail(404, 'Pet not found');
    const findProp = (id) => store.props.find((p) => p.id === Number(id) && mine(p)) || fail(404, 'Prop not found');
    const withOwner = (ids = []) => [...new Set([user.id, ...ids])];
    const validatePet = () => { if (!body.name) fail(422, [{ loc: ['body', 'name'], type: 'missing', msg: 'Field required' }]); if (body.birth_date && body.birth_date > dayKey(new Date())) fail(422, [{ loc: ['body', 'birth_date'], type: 'value_error', msg: 'birth_date must not be in the future' }]); };
    const validateProp = () => { if (!body.name) fail(422, [{ loc: ['body', 'name'], type: 'missing', msg: 'Field required' }]); if (!body.date) fail(422, [{ loc: ['body', 'date'], type: 'missing', msg: 'Field required' }]); if (body.category !== 'food' && (body.liked != null || body.suitable != null || (body.reactions || []).length)) fail(422, [{ loc: ['body'], type: 'value_error', msg: 'liked, suitable and reactions are only allowed for category food' }]); };
    const propFields = () => ({ name: body.name, msg: body.msg ?? null, text: body.text ?? null, rep: !!body.rep, date: body.date, own_ids: withOwner(body.own_ids), category: body.category || 'reminder', liked: body.liked ?? null, suitable: body.suitable ?? null, reactions: [...new Set(body.reactions || [])] });
    const duePropDate = (prop) => { const start = parseDate(prop.date); const current = new Date(); if (start > current) return null; if (!prop.rep) return start; const due = new Date(current); due.setHours(start.getHours(), start.getMinutes(), 0, 0); return due > current ? addDays(due, -1) : due; };
    const dueNotifications = () => {
      const reads = store.reads[user.id] || {}; const today = new Date(); const year = today.getFullYear();
      const props = store.props.filter((p) => mine(p) && p.category !== 'food').map((p) => ({ p, due: duePropDate(p) })).filter(({ p, due }) => due && (!reads[p.id] || parseDate(reads[p.id]) < due)).map(({ p, due }) => ({ ...p, kind: 'prop', pet_id: null, date: due.toISOString() }));
      const bdReads = store.birthdayReads[user.id] || {};
      const birthdays = store.pets.filter((p) => mine(p) && p.birth_date).filter((p) => { const b = parseDate(p.birth_date); return b.getMonth() === today.getMonth() && b.getDate() === today.getDate() && b.getFullYear() < year && bdReads[p.id] !== year; }).map((p) => { const years = year - parseDate(p.birth_date).getFullYear(); return { kind: 'birthday', id: p.id, pet_id: p.id, name: `День рождения: ${p.name}`, msg: `Исполняется ${years} ${plural(years, ['год', 'года', 'лет'])}`, text: null, rep: true, date: startOfDay().toISOString(), own_ids: p.own_ids }; });
      return [...birthdays, ...props].sort(byDateDesc);
    };
    if (route === '/user/me') return publicUser(user);
    if (route === '/user/edit') { if (body.phone_number && Object.values(store.users).some((u) => u !== user && u.phone_number === body.phone_number)) fail(409, 'Phone number already registered'); if (body.email !== user.email) { if (byEmail(body.email)) fail(409, 'Email already registered'); delete store.users[user.email]; store.users[body.email] = user; user.email_verified = false; } Object.assign(user, { name: body.name, email: body.email, phone_number: body.phone_number || null, passwd: body.passwd }); saveMock(store); return publicUser(user); }
    if (route === '/pet/list') return store.pets.filter(mine).sort((a, b) => a.id - b.id);
    if (route === '/pet/get') return findPet(q.get('pet_id'));
    if (route === '/pet/add') { validatePet(); const item = { id: store.nextId++, name: body.name, type: body.type ?? null, breed: body.breed ?? null, birth_date: body.birth_date ?? null, own_ids: withOwner(body.own_ids), prop_ids: body.prop_ids || [], has_picture: false }; store.pets.push(item); saveMock(store); return item; }
    if (route === '/pet/edit') { const item = findPet(q.get('pet_id')); validatePet(); Object.assign(item, { name: body.name, type: body.type ?? null, breed: body.breed ?? null, birth_date: body.birth_date ?? null, own_ids: withOwner(body.own_ids), prop_ids: body.prop_ids || [] }); saveMock(store); return item; }
    if (route === '/pet/del') { const item = findPet(q.get('pet_id')); store.pets = store.pets.filter((p) => p !== item); saveMock(store); return null; }
    const photoMatch = route.match(/^\/pets\/(\d+)\/photo$/);
    if (photoMatch) { const item = findPet(photoMatch[1]); item.has_picture = method === 'POST'; saveMock(store); return method === 'POST' ? { pet_id: item.id, photo_url: route } : null; }
    if (route === '/prop/list') { let items = store.props.filter(mine); if (q.get('pet_id')) { const pet = findPet(q.get('pet_id')); items = items.filter((p) => pet.prop_ids.includes(p.id)); } ['category', 'liked', 'suitable'].forEach((key) => { if (q.has(key)) items = items.filter((p) => String(p[key]) === q.get(key)); }); return items.sort(byDateAsc); }
    if (route === '/prop/get') return findProp(q.get('prop_id'));
    if (route === '/prop/add') { validateProp(); const item = { id: store.nextId++, ...propFields() }; store.props.push(item); saveMock(store); return item; }
    if (route === '/prop/edit') { const item = findProp(q.get('prop_id')); validateProp(); Object.assign(item, propFields()); saveMock(store); return item; }
    if (route === '/prop/del') { const item = findProp(q.get('prop_id')); store.props = store.props.filter((p) => p !== item); store.pets.forEach((p) => { p.prop_ids = (p.prop_ids || []).filter((id) => id !== item.id); }); saveMock(store); return null; }
    if (route === '/notification/list') return dueNotifications();
    if (route === '/notification/count') return { count: dueNotifications().length };
    if (route === '/notification/read' || route === '/notification/read_all') {
      const due = dueNotifications().filter((n) => route === '/notification/read_all' || (q.get('prop_id') ? n.kind === 'prop' && n.id === Number(q.get('prop_id')) : n.kind === 'birthday' && n.pet_id === Number(q.get('pet_id'))));
      if (route === '/notification/read' && !due.length) fail(404, 'Notification not found');
      due.forEach((n) => { if (n.kind === 'birthday') (store.birthdayReads[user.id] ||= {})[n.pet_id] = new Date().getFullYear(); else (store.reads[user.id] ||= {})[n.id] = n.date; });
      saveMock(store); return null;
    }
    return [];
  }

  // ---------- Данные, которых нет в API (хранятся в этом браузере) ----------
  function extrasKey(email = state.user?.email) { return `petcare_extras_${email || 'guest'}`; }
  function extras() { const data = JSON.parse(localStorage.getItem(extrasKey()) || '{}'); data.profile ||= {}; data.pets ||= {}; data.props ||= {}; data.weights ||= {}; return data; }
  function saveExtras(data) { localStorage.setItem(extrasKey(), JSON.stringify(data)); }
  function petExtra(id) { return extras().pets[id] || {}; }
  function propExtra(id) { return extras().props[id] || {}; }
  function photoKey(id) { return `petcare_pet_photo_${state.user?.email}_${id}`; }
  function petImage(pet) { return USE_MOCK_API ? localStorage.getItem(photoKey(pet.id)) : state.photoUrls[pet.id]; }

  // ---------- Связи записей с питомцами ----------
  function petOf(prop) { const pet = state.pets.find((p) => (p.prop_ids || []).includes(prop.id)); if (pet) return pet; const legacy = propExtra(prop.id).petId; return legacy ? state.pets.find((p) => String(p.id) === String(legacy)) || null : null; }
  function propsOfPet(petId) { return petId ? state.props.filter((prop) => petOf(prop)?.id === Number(petId)) : state.props; }
  function petBody(pet, propIds = pet.prop_ids || []) { return { name: pet.name, type: pet.type ?? null, breed: pet.breed ?? null, birth_date: pet.birth_date ?? null, own_ids: pet.own_ids || [], prop_ids: propIds }; }
  async function updatePetProps(pet, propIds) { const saved = await request(`/pet/edit?pet_id=${pet.id}`, { method: 'PUT', body: petBody(pet, propIds) }); state.pets = state.pets.map((p) => (p.id === saved.id ? saved : p)); }
  async function linkProps(petId, propIds) { const pet = state.pets.find((p) => p.id === Number(petId)); if (!pet || !propIds.length) return; await updatePetProps(pet, [...new Set([...(pet.prop_ids || []), ...propIds])]); }
  async function setPropPet(propId, petId) {
    for (const pet of state.pets.filter((p) => p.id !== Number(petId) && (p.prop_ids || []).includes(propId))) await updatePetProps(pet, pet.prop_ids.filter((id) => id !== propId));
    if (petId) await linkProps(petId, [propId]);
    const data = extras(); if (data.props[propId]) { delete data.props[propId].petId; saveExtras(data); }
  }
  async function createProps(bodies) { const ids = []; for (let i = 0; i < bodies.length; i += 5) { const saved = await Promise.all(bodies.slice(i, i + 5).map((body) => request('/prop/add', { method: 'POST', body }))); ids.push(...saved.map((item) => item.id)); } return ids; }
  function propBody(fields, old) { const food = fields.category === 'food'; return { name: fields.name, date: fields.date, msg: fields.msg || null, text: fields.text || null, rep: !!fields.rep, own_ids: old?.own_ids || [], category: fields.category, liked: food ? fields.liked ?? null : null, suitable: food ? fields.suitable ?? null : null, reactions: food ? fields.reactions || [] : [] }; }

  // ---------- События: повторы и дни рождения ----------
  function isRepeating(prop) { return !!prop.rep || (prop.category === 'reminder' && !!propExtra(prop.id).repeat); }
  function periodOf(prop) { return propExtra(prop.id).period || 'ежедневно'; }
  function periodLabel(prop) { return (PERIODS.find(([value]) => value === periodOf(prop)) || PERIODS[0])[1]; }
  // Повторяющаяся запись разворачивается в отдельные даты: исходная + все повторы на ближайший месяц
  function occurrences(prop) {
    const start = parseDate(prop.date); if (!isRepeating(prop) || !start || isNaN(start)) return [prop];
    const period = periodOf(prop); const from = new Date(Math.max(start, startOfDay())); const to = addMonths(from, 1); const result = [];
    for (let i = 0; i < 20000; i++) {
      let date;
      if (period === 'еженедельно') date = addDays(start, 7 * i);
      else if (period === 'ежемесячно') { const days = new Date(start.getFullYear(), start.getMonth() + i + 1, 0).getDate(); date = new Date(start.getFullYear(), start.getMonth() + i, Math.min(start.getDate(), days), start.getHours(), start.getMinutes()); }
      else if (period === 'ежегодно') { date = new Date(start); date.setFullYear(start.getFullYear() + i); }
      else date = addDays(start, i);
      if (date > to) break;
      if (i === 0 || date >= from) result.push({ ...prop, date: date.toISOString(), occurrence: true });
    }
    return result;
  }
  function birthdayEvents(petId, from, to) {
    const result = [];
    state.pets.filter((pet) => pet.birth_date && (!petId || pet.id === Number(petId))).forEach((pet) => {
      const birth = parseDate(pet.birth_date);
      for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
        if (year <= birth.getFullYear()) continue;
        const leap = new Date(year, 1, 29).getMonth() === 1; const day = birth.getMonth() === 1 && birth.getDate() === 29 && !leap ? 28 : birth.getDate();
        const date = new Date(year, birth.getMonth(), day);
        if (date < startOfDay(from) || date > to) continue;
        const years = year - birth.getFullYear();
        result.push({ id: `bd-${pet.id}-${year}`, virtual: true, petId: pet.id, category: 'birthday', name: `День рождения: ${pet.name}`, msg: `Исполнится ${years} ${plural(years, ['год', 'года', 'лет'])}`, date: date.toISOString() });
      }
    });
    return result;
  }
  function eventsFor(petId, type, from, to) {
    const props = type === 'birthday' ? [] : propsOfPet(petId).filter((p) => p.category !== 'food' && (!type || p.category === type)).flatMap(occurrences);
    const birthdays = !type || type === 'birthday' ? birthdayEvents(petId, from, to) : [];
    return [...props, ...birthdays];
  }
  function upcomingEvents(petId, type = '') { const today = startOfDay(); return eventsFor(petId, type, today, addMonths(today, 12)).filter((item) => parseDate(item.date) >= today).sort(byDateAsc); }
  function showTime(item) { if (item.virtual) return false; const extra = propExtra(item.id); return extra.hasTime ?? timeOf(item.date) !== '00:00'; }

  // ---------- Авторизация ----------
  function setAuthMode(mode) { state.authMode = mode; $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.mode === mode)); el.nameField.classList.toggle('is-hidden', mode !== 'register'); el.termsField.classList.toggle('is-hidden', mode !== 'register'); $('#form-title').textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт'; el.authSubmit.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться'; el.authSubmit.dataset.default = el.authSubmit.textContent; el.authPassword.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; el.authHint.textContent = USE_MOCK_API ? 'Демо-режим: код подтверждения 123456' : ''; clearMessage(el.authMessage); clearFieldErrors(el.authForm); }
  function showVerify(email) { state.verifyEmail = email; el.verifyEmail.textContent = email; el.verifyCode.value = ''; clearMessage(el.verifyMessage); el.authView.classList.add('is-hidden'); el.verifyView.classList.remove('is-hidden'); el.verifyCode.focus(); }
  let resendTimer;
  function startResendCooldown(statusNode, button, seconds = 60) { clearInterval(resendTimer); button.disabled = true; statusNode.textContent = `Отправить ещё раз можно через ${seconds} с.`; resendTimer = setInterval(() => { seconds--; statusNode.textContent = seconds ? `Отправить ещё раз можно через ${seconds} с.` : 'Можно отправить код ещё раз.'; if (!seconds) { clearInterval(resendTimer); button.disabled = false; } }, 1000); }
  async function resendCode(email, statusNode, button) { button.disabled = true; try { await request('/user/verify/resend', { method: 'POST', body: { email } }); startResendCooldown(statusNode, button); statusNode.textContent = 'Если адрес зарегистрирован, мы отправили новый код. Повторить можно через минуту.'; } catch (error) { statusNode.textContent = apiError(error); button.disabled = false; } }
  async function enterApp(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    state.user = await request('/user/me');
    el.authScreen.classList.add('is-hidden'); el.appScreen.classList.remove('is-hidden'); updateUserChip();
    await loadData(); renderPage(); startPolling();
  }
  function updateUserChip() { $('#user-name').textContent = state.user.name || 'Пользователь'; $('#user-initial').textContent = (state.user.name || 'П')[0].toUpperCase(); }
  function sessionExpired() {
    if (!state.user) return;
    localStorage.removeItem(TOKEN_KEY); state.user = null; clearInterval(state.pollTimer); closeModal();
    el.appScreen.classList.add('is-hidden'); el.authScreen.classList.remove('is-hidden'); el.verifyView.classList.add('is-hidden'); el.authView.classList.remove('is-hidden');
    setAuthMode('login'); message(el.authMessage, 'Сессия истекла. Войдите снова.', 'error');
  }
  async function loadData() {
    clearMessage(el.appMessage);
    try { const [pets, props] = await Promise.all([request('/pet/list'), request('/prop/list')]); state.pets = pets; state.props = props; } catch (error) { if (!state.user) return; state.pets = []; state.props = []; message(el.appMessage, apiError(error)); }
    pollNotifications();
  }

  // ---------- Уведомления ----------
  function pushEnabled() { return 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('petcare_push') === '1'; }
  function updateBell() { el.bellCount.textContent = state.notificationCount > 99 ? '99+' : String(state.notificationCount); el.bellCount.classList.toggle('is-hidden', !state.notificationCount); }
  async function pollNotifications() {
    if (!state.user) return;
    try {
      const { count } = await request('/notification/count'); const changed = count !== state.notificationCount; state.notificationCount = count; updateBell();
      if (changed) refreshBanner();
      if (count && pushEnabled()) showPushNotifications(await request('/notification/list'));
    } catch {}
  }
  function showPushNotifications(items) {
    const shown = JSON.parse(localStorage.getItem('petcare_push_shown') || '[]');
    items.forEach((item) => { const key = `${item.kind}-${item.id}-${dateOnly(item.date)}`; if (shown.includes(key)) return; shown.push(key); try { new Notification(item.name, { body: item.msg || 'PetCare', icon: 'petcare-icon.jpg', tag: key }); } catch {} });
    localStorage.setItem('petcare_push_shown', JSON.stringify(shown.slice(-200)));
  }
  function startPolling() { clearInterval(state.pollTimer); state.pollTimer = setInterval(pollNotifications, POLL_INTERVAL); }
  function noticeBanner() { const n = state.notificationCount; return n ? `<button class="notice-banner" data-action="open-notifications" type="button">🔔 ${n} ${plural(n, ['новое уведомление', 'новых уведомления', 'новых уведомлений'])} — посмотреть</button>` : ''; }
  function refreshBanner() { const slot = $('#notice-banner-slot'); if (!slot) return; slot.innerHTML = noticeBanner(); bindDynamic(slot); }
  async function openNotifications() {
    openModal('<h2>Уведомления</h2><div class="empty-state">Загружаем…</div>');
    try { state.notifications = await request('/notification/list'); state.notificationCount = state.notifications.length; updateBell(); refreshBanner(); renderNotifications(); } catch (error) { el.modalContent.innerHTML = `<h2>Уведомления</h2><div class="message is-visible error">${escapeHtml(apiError(error))}</div>`; }
  }
  function pushControl() {
    if (!('Notification' in window)) return '<p class="muted small-note">Этот браузер не поддерживает системные уведомления.</p>';
    if (Notification.permission === 'denied') return '<p class="muted small-note">Уведомления браузера заблокированы. Разрешите их в настройках сайта, чтобы получать напоминания.</p>';
    return `<button class="secondary-button" type="button" data-action="toggle-push">${pushEnabled() ? 'Отключить уведомления браузера' : '🔔 Включить уведомления браузера'}</button>`;
  }
  function renderNotifications() {
    const items = state.notifications;
    el.modalContent.innerHTML = `<h2>Уведомления</h2>${items.length ? `<div class="notification-list">${items.map((item) => { const cat = CATEGORIES[item.kind === 'birthday' ? 'birthday' : (state.props.find((p) => p.id === item.id)?.category || 'reminder')]; return `<article class="notification-item"><span class="event-icon">${cat.icon}</span><div><h3>${escapeHtml(item.name)}</h3>${item.msg ? `<p>${escapeHtml(item.msg)}</p>` : ''}<small>${formatDate(item.date, item.kind !== 'birthday')}</small></div><button class="outline-button" type="button" data-read-kind="${item.kind}" data-read-id="${item.id}">Прочитано</button></article>`; }).join('')}</div><button class="primary-button" type="button" data-action="read-all">Отметить все прочитанными</button>` : '<div class="empty-state">Новых уведомлений нет 🎉<br>Мы напомним о прививках, обработках и приёме препаратов.</div>'}${pushControl()}`;
    el.modalContent.querySelectorAll('[data-read-id]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await request(`/notification/read?${button.dataset.readKind === 'birthday' ? 'pet_id' : 'prop_id'}=${button.dataset.readId}`, { method: 'POST' }); } catch (error) { if (error?.status !== 404) { notify(apiError(error), 'error'); button.disabled = false; return; } }
      state.notifications = state.notifications.filter((n) => !(n.kind === button.dataset.readKind && String(n.id) === button.dataset.readId)); state.notificationCount = state.notifications.length; updateBell(); refreshBanner(); renderNotifications();
    }));
    el.modalContent.querySelector('[data-action="read-all"]')?.addEventListener('click', async (event) => { const button = event.currentTarget; busy(button, true, 'Отмечаем…'); try { await request('/notification/read_all', { method: 'POST' }); state.notifications = []; state.notificationCount = 0; updateBell(); refreshBanner(); renderNotifications(); notify('Все уведомления прочитаны'); } catch (error) { notify(apiError(error), 'error'); busy(button, false); } });
    el.modalContent.querySelector('[data-action="toggle-push"]')?.addEventListener('click', togglePush);
  }
  async function togglePush() {
    if (pushEnabled()) { localStorage.setItem('petcare_push', '0'); notify('Уведомления браузера отключены'); return renderNotifications(); }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') { localStorage.setItem('petcare_push', '1'); localStorage.setItem('petcare_push_shown', JSON.stringify(state.notifications.map((n) => `${n.kind}-${n.id}-${dateOnly(n.date)}`))); notify('Готово! Новые напоминания будут приходить уведомлениями браузера'); } else notify('Без разрешения браузера уведомления не придут', 'error');
    renderNotifications();
  }

  // ---------- Модальные окна ----------
  function openModal(content) { if (state.confirmResolve) { state.confirmResolve(false); state.confirmResolve = null; } el.modalContent.innerHTML = content; el.modal.classList.remove('is-hidden'); document.body.classList.add('modal-open'); }
  function closeModal() { el.modal.classList.add('is-hidden'); el.modalContent.innerHTML = ''; document.body.classList.remove('modal-open'); if (state.confirmResolve) { state.confirmResolve(false); state.confirmResolve = null; } }
  function confirmDialog(text, okLabel = 'Удалить') {
    return new Promise((resolve) => {
      openModal(`<h2>Вы уверены?</h2><p class="muted">${escapeHtml(text)}</p><div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Отмена</button><button type="button" class="primary-button danger-fill" id="confirm-ok">${okLabel}</button></div>`);
      state.confirmResolve = resolve;
      $('#confirm-ok').addEventListener('click', () => { state.confirmResolve = null; closeModal(); resolve(true); });
    });
  }

  // ---------- Страницы ----------
  function navigate(page, options = {}) { state.page = page; state.selectedPet = options.selectedPet ?? null; if (options.healthPet !== undefined) state.healthPet = options.healthPet; if (options.foodPet !== undefined) state.foodPet = options.foodPet; renderPage(); window.scrollTo?.(0, 0); }
  function renderPage() {
    const titles = { dashboard: 'Обзор', pets: 'Мои питомцы', health: 'Карта здоровья', food: 'Питание', reminders: 'Напоминания', profile: 'Аккаунт' };
    if (!titles[state.page]) state.page = 'dashboard';
    el.pageTitle.textContent = titles[state.page];
    $$('.nav-link').forEach((link) => link.classList.toggle('is-active', link.dataset.page === state.page));
    ({ dashboard: renderDashboard, pets: renderPets, health: renderHealth, food: renderFood, reminders: renderReminders, profile: renderProfile })[state.page]();
  }
  function petOptions(selected, emptyLabel) { return `<option value="">${emptyLabel}</option>${state.pets.map((p) => `<option value="${p.id}" ${String(selected) === String(p.id) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}`; }
  function bindSelect(id, apply) { $(`#${id}`)?.addEventListener('change', (event) => { apply(event.target.value); renderPage(); }); }
  function quickActions(petId = '') { return `<div class="quick-actions">${['vaccination', 'parasites', 'vet_visit', 'medication'].map((c) => `<button class="outline-button" data-action="add-record" data-category="${c}" data-pet="${petId}">${CATEGORIES[c].icon} ${{ vaccination: 'Прививка', parasites: 'Обработка', vet_visit: 'Визит', medication: 'Препарат' }[c]}</button>`).join('')}<button class="outline-button" data-action="add-food" data-pet="${petId}">🥣 Корм</button></div>`; }

  function renderDashboard() {
    const selected = state.selectedPet; const next = upcomingEvents(selected).slice(0, 8); const count = Math.max(1, state.pets.length); const selectedPet = state.pets.find((p) => p.id === selected);
    el.pageContent.innerHTML = `<div class="dashboard-grid"><section class="dashboard-pets" style="--cols:${Math.min(count, 3)};--cols-sm:${Math.min(count, 2)}"><div class="section-title"><h2>Ваши питомцы</h2><button class="outline-button" data-action="add-pet">+ Добавить</button></div>${petGrid()}${state.pets.length > 1 ? '<p class="muted small-note">Нажмите на карточку, чтобы увидеть события только этого питомца.</p>' : ''}</section><section class="dashboard-procedures"><div id="notice-banner-slot">${noticeBanner()}</div><div class="section-title"><h2>Ближайшие события${selectedPet ? ` · ${escapeHtml(selectedPet.name)}` : ''}</h2><button class="outline-button" data-goto="reminders">Все →</button></div>${eventList(next, { actions: false, empty: 'Ближайших событий нет.<br>Добавьте прививку или обработку — следующую дату мы рассчитаем сами.' })}${quickActions(selected || '')}</section></div>`;
    bindDynamic(); loadRemotePhotos();
  }
  function petGrid(deletable = false) { if (!state.pets.length) return '<div class="empty-state">Питомцев пока нет.<br><button class="primary-button compact-button empty-action" data-action="add-pet">+ Добавить питомца</button></div>'; return `<div class="pet-grid">${state.pets.map((pet) => petCard(pet, deletable)).join('')}</div>`; }
  function petPhoto(pet, className = 'pet-photo') { const image = petImage(pet); return `<div class="${className}">${image ? `<img src="${image}" alt="${escapeHtml(pet.name)}">` : pet.has_picture && !USE_MOCK_API ? `<img data-photo-id="${pet.id}" alt="${escapeHtml(pet.name)}">` : '🐾'}</div>`; }
  function petMeta(pet) { return [pet.type, pet.breed, pet.birth_date ? ageText(pet.birth_date) : ''].filter(Boolean).join(' · '); }
  function petCard(pet, deletable = false) { const selected = state.selectedPet === pet.id ? ' is-selected' : ''; const meta = petMeta(pet); return `<article class="pet-card${selected}" data-action="select-pet" data-id="${pet.id}">${petPhoto(pet)}<div class="pet-card-body"><h3>${escapeHtml(pet.name)}</h3>${meta ? `<p class="pet-meta">${escapeHtml(meta)}</p>` : ''}<button class="outline-button pet-details-button" data-action="open-pet" data-id="${pet.id}">Вся информация</button>${deletable ? `<button class="danger-button pet-delete-button" data-action="delete-pet" data-id="${pet.id}">Удалить</button>` : ''}</div></article>`; }

  function renderPets() {
    const pet = state.selectedPet ? state.pets.find((item) => item.id === state.selectedPet) : null;
    if (!pet) { el.pageContent.innerHTML = `<div class="section-title"><h2>Все питомцы</h2><button class="primary-button compact-button" data-action="add-pet">+ Добавить</button></div>${petGrid(true)}`; bindDynamic(); loadRemotePhotos(); return; }
    const extra = petExtra(pet.id); const upcoming = upcomingEvents(pet.id).slice(0, 5); const food = foodBase(propsOfPet(pet.id).filter((p) => p.category === 'food'));
    const info = [['Вид', pet.type], ['Порода', pet.breed], ['Дата рождения', pet.birth_date ? `${formatDate(pet.birth_date, false)} (${ageText(pet.birth_date)})` : '']];
    el.pageContent.innerHTML = `<div class="section-title"><h2>Информация о питомце</h2><button class="outline-button" data-action="back-pets">← Все питомцы</button></div>
      <section class="card pet-profile"><div class="pet-profile-header">${petPhoto(pet, 'avatar-large pet-avatar-placeholder')}<div><h2>${escapeHtml(pet.name)}</h2><p class="muted">${escapeHtml(petMeta(pet) || 'Вид, порода и дата рождения пока не указаны')}</p><div class="pet-profile-actions"><button class="outline-button" data-action="edit-pet" data-id="${pet.id}">Редактировать</button><button class="danger-button" data-action="delete-pet" data-id="${pet.id}">Удалить питомца</button></div></div></div>
      <div class="info-list">${info.map(([label, value]) => `<div><small>${label}</small><strong>${escapeHtml(value || '—')}</strong></div>`).join('')}</div>
      <hr><div class="section-title"><h3>Карта здоровья</h3><button class="outline-button" data-goto="health" data-pet="${pet.id}">Открыть →</button></div>${healthSummary(pet.id)}${quickActions(pet.id)}
      <hr><div class="section-title"><h3>Питание</h3><button class="outline-button" data-goto="food" data-pet="${pet.id}">Журнал →</button></div>${food.html || '<p class="muted">Записей о кормах пока нет.</p>'}
      <hr><div class="section-title"><h3>Ближайшие события</h3></div>${eventList(upcoming, { actions: false, empty: 'Ничего не запланировано.' })}
      <hr><div class="pet-info-grid"><div><h3>Особенности</h3><p class="pre-line">${escapeHtml(extra.description || 'Описание и особенности не указаны.')}</p></div><div><h3>Дополнительные данные</h3><p class="pre-line">${escapeHtml(extra.fields || 'Дополнительные поля не заполнены.')}</p></div></div></section>`;
    bindDynamic(); loadRemotePhotos();
  }

  function eventCard(item, { actions = true } = {}) {
    const cat = CATEGORIES[item.category] || CATEGORIES.reminder; const pet = item.virtual ? state.pets.find((p) => p.id === item.petId) : petOf(item); const relative = relativeDay(item.date);
    const overdue = !item.virtual && item.category === 'reminder' && !isRepeating(item) && parseDate(item.date) < startOfDay();
    const textLabel = { vet_visit: 'Заключение', food: 'Комментарий', medication: 'Назначение' }[item.category] || 'Заметка';
    return `<article class="event-card event-${item.category}"><div class="event-icon">${cat.icon}</div><div class="event-body"><div class="event-meta"><span class="category-chip">${cat.label}</span>${relative ? `<span class="relative-chip">${relative}</span>` : ''}${overdue ? '<span class="relative-chip is-past">Прошло</span>' : ''}</div><h3>${escapeHtml(item.name)}</h3><p class="event-sub"><strong>${escapeHtml(pet ? pet.name : 'Все питомцы')}</strong> · ${formatDate(item.date, showTime(item))}</p>${item.msg ? `<p>${escapeHtml(item.msg)}</p>` : ''}${item.text ? `<p class="event-text"><strong>${textLabel}:</strong> ${escapeHtml(item.text)}</p>` : ''}${item.category === 'food' ? foodBadges(item) : ''}${!item.virtual && isRepeating(item) ? `<p class="event-repeat">↻ Повторяется: ${periodLabel(item).toLowerCase()}</p>` : ''}</div>${actions && !item.virtual ? `<div class="event-actions"><button class="icon-button" type="button" data-action="edit-prop" data-id="${item.id}" title="Изменить" aria-label="Изменить">✎</button><button class="icon-button danger" type="button" data-action="delete-prop" data-id="${item.id}" title="Удалить" aria-label="Удалить">🗑</button></div>` : ''}</article>`;
  }
  function eventList(items, options = {}) { if (!items.length) return `<div class="empty-state">${options.empty || 'Записей пока нет.'}</div>`; return `<div class="event-list">${items.map((item) => eventCard(item, options)).join('')}</div>`; }

  // ---------- Карта здоровья ----------
  function healthSummary(petId) {
    const items = propsOfPet(petId); const current = new Date();
    const last = (cat) => items.filter((p) => p.category === cat && parseDate(p.date) <= current).sort(byDateDesc)[0];
    const next = (cat) => items.filter((p) => p.category === cat && parseDate(p.date) > current).sort(byDateAsc)[0];
    const weights = (extras().weights[petId] || []).slice().sort(byDateDesc);
    const tile = (icon, title, value, sub) => `<div class="summary-tile"><small>${icon} ${title}</small><strong>${value}</strong><span>${sub}</span></div>`;
    const planned = (cat, label) => { const item = next(cat); return item ? `${label}: ${formatDate(item.date, false)}` : `${label} не запланирована`; };
    const vaccine = last('vaccination'); const parasites = last('parasites'); const visit = last('vet_visit'); const medication = next('medication');
    return `<div class="summary-grid">${tile('💉', 'Вакцинация', vaccine ? formatDate(vaccine.date, false) : 'Нет записей', planned('vaccination', 'Следующая'))}${tile('🛡️', 'Обработка от паразитов', parasites ? formatDate(parasites.date, false) : 'Нет записей', planned('parasites', 'Следующая'))}${tile('🩺', 'Визит к ветеринару', visit ? formatDate(visit.date, false) : 'Нет записей', visit ? escapeHtml(visit.name) : 'Добавьте заключение врача')}${tile('💊', 'Препараты', medication ? escapeHtml(medication.name) : 'Нет назначений', medication ? `Следующий приём: ${formatDate(medication.date)}` : 'Активных курсов нет')}${tile('⚖️', 'Вес', weights[0] ? `${weights[0].kg} кг` : 'Нет данных', weights[0] ? `на ${formatDate(weights[0].date, false)}` : 'Добавьте первое измерение')}</div>`;
  }
  function renderHealth() {
    const petId = state.healthPet; const tab = state.healthTab;
    const tabs = [['all', 'Все записи'], ['vaccination', '💉 Вакцинации'], ['parasites', '🛡️ Паразиты'], ['vet_visit', '🩺 Визиты и заключения'], ['medication', '💊 Препараты'], ['weight', '⚖️ Вес']];
    let body;
    if (tab === 'weight') body = weightSection(petId);
    else {
      const cats = tab === 'all' ? HEALTH_CATEGORIES : [tab]; const items = propsOfPet(petId).filter((p) => cats.includes(p.category)); const current = new Date();
      const past = items.filter((p) => parseDate(p.date) <= current).sort(byDateDesc); const future = items.filter((p) => parseDate(p.date) > current).sort(byDateAsc);
      body = `${future.length ? `<section class="page-section"><h3 class="subsection-title">Запланировано</h3>${eventList(future)}</section>` : ''}<section class="page-section"><h3 class="subsection-title">История</h3>${eventList(past, { empty: 'История пока пуста.<br>Добавьте прививку, обработку или визит к ветеринару.' })}</section>`;
    }
    el.pageContent.innerHTML = `<div class="section-title"><div><h2>Карта здоровья</h2><p class="muted section-subtitle">Вакцинации, обработки от паразитов, визиты к ветеринару, заключения, препараты и вес.</p></div>${tab === 'weight' ? '' : `<button class="primary-button compact-button" data-action="add-record" data-category="${tab === 'all' ? 'vaccination' : tab}" data-pet="${petId}">+ Добавить запись</button>`}</div><div class="filters"><select id="health-pet" aria-label="Питомец">${petOptions(petId, 'Все питомцы')}</select></div><div class="chip-tabs" role="tablist">${tabs.map(([value, label]) => `<button class="chip-tab ${tab === value ? 'is-active' : ''}" type="button" role="tab" aria-selected="${tab === value}" data-health-tab="${value}">${label}</button>`).join('')}</div>${petId ? healthSummary(petId) : '<p class="muted small-note">Выберите питомца, чтобы увидеть сводку: последние и следующие процедуры, вес.</p>'}${body}`;
    bindSelect('health-pet', (value) => { state.healthPet = value; });
    $$('[data-health-tab]').forEach((button) => button.addEventListener('click', () => { state.healthTab = button.dataset.healthTab; renderPage(); }));
    bindDynamic(); bindWeightForm(petId);
  }
  function weightSection(petId) {
    if (!petId) return '<div class="empty-state">Выберите питомца в списке выше, чтобы вести учёт веса.</div>';
    const weights = (extras().weights[petId] || []).slice().sort(byDateDesc);
    const rows = weights.map((item, index) => { const prev = weights[index + 1]; const diff = prev ? Math.round((item.kg - prev.kg) * 100) / 100 : null; return `<article class="weight-row"><div><strong>${item.kg} кг</strong>${diff ? `<span class="weight-diff ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff} кг</span>` : ''}<p>${formatDate(item.date, false)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</p></div><button class="icon-button danger" type="button" data-action="delete-weight" data-id="${item.id}" aria-label="Удалить измерение">🗑</button></article>`; }).join('');
    return `<section class="card weight-card"><h3>Новое измерение</h3><form id="weight-form" class="inline-form" novalidate><div class="field"><label for="weight-date">Дата *</label><input id="weight-date" name="date" type="date" max="${dayKey(new Date())}" value="${dayKey(new Date())}"></div><div class="field"><label for="weight-kg">Вес, кг *</label><input id="weight-kg" name="kg" type="text" inputmode="decimal" placeholder="Например, 4.2"></div><div class="field"><label for="weight-note">Заметка</label><input id="weight-note" name="note" maxlength="200" placeholder="Например, после стрижки"></div><button class="primary-button compact-button" type="submit">Добавить</button></form><p class="muted small-note">Измерения веса сохраняются в этом браузере.</p></section><section class="page-section"><h3 class="subsection-title">История веса</h3>${rows ? `<div class="event-list">${rows}</div>` : '<div class="empty-state">Измерений пока нет.</div>'}</section>`;
  }
  function bindWeightForm(petId) {
    const form = $('#weight-form'); if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault(); const data = new FormData(form); const kg = Number(String(data.get('kg')).replace(',', '.')); const date = data.get('date');
      const errors = []; if (!date) errors.push(['date', 'Укажите дату измерения.']); else if (date > dayKey(new Date())) errors.push(['date', 'Дата не может быть в будущем.']); if (!kg || kg <= 0 || kg > 1000) errors.push(['kg', 'Введите вес в килограммах, например 4.2']);
      if (!showErrors(form, errors)) return;
      const store = extras(); (store.weights[petId] ||= []).push({ id: Date.now(), date, kg: Math.round(kg * 100) / 100, note: String(data.get('note') || '').trim() }); saveExtras(store); renderPage(); notify('Вес сохранён');
    });
  }

  // ---------- Форма записи о здоровье / напоминания ----------
  function courseFields(prefix, startDay) {
    return `<div class="field-row"><div class="field"><label>Сколько раз в день</label><select name="${prefix}perDay"><option value="1">1 раз</option><option value="2">2 раза</option><option value="3">3 раза</option></select></div><div class="field"><label>Как часто</label><select name="${prefix}every"><option value="1">Каждый день</option><option value="2">Через день</option><option value="7">Раз в неделю</option></select></div></div>${startDay !== undefined ? `<div class="field-row"><div class="field"><label>Начать с *</label><input name="${prefix}start" type="date" value="${startDay}"></div><div class="field"><label>Время первого приёма</label><input name="${prefix}time" type="time" value="09:00"></div></div>` : ''}<div class="field"><label>Длительность курса, дней *</label><input name="${prefix}days" type="number" min="1" max="90" value="7" inputmode="numeric"></div><p class="field-hint" data-course-hint="${prefix}"></p>`;
  }
  function courseDates(form, prefix, startDay, time) {
    const perDay = Number(form.elements[`${prefix}perDay`].value); const every = Number(form.elements[`${prefix}every`].value); const days = Number(form.elements[`${prefix}days`].value);
    if (!startDay || !Number.isInteger(days) || days < 1 || days > 90) return null;
    const offsets = { 1: [0], 2: [0, 12], 3: [0, 6, 12] }[perDay]; const first = new Date(`${startDay}T${time || '09:00'}:00`); const dates = [];
    for (let day = 0; day < days; day += every) offsets.forEach((hours) => { const date = addDays(first, day); date.setHours(date.getHours() + hours); dates.push(date); });
    return dates;
  }
  function courseHint(form, prefix, startDay, time) { const node = form.querySelector(`[data-course-hint="${prefix}"]`); if (!node) return; const dates = courseDates(form, prefix, startDay, time); node.textContent = !dates ? 'Укажите дату начала и длительность от 1 до 90 дней.' : dates.length > MAX_COURSE_DOSES ? `Слишком много приёмов (${dates.length}). Максимум — ${MAX_COURSE_DOSES}.` : `Мы создадим ${dates.length} ${plural(dates.length, ['напоминание', 'напоминания', 'напоминаний'])} о приёме: с ${formatDate(dates[0], false)} по ${formatDate(dates.at(-1), false)}.`; }
  function recordForm(prop = {}, defaults = {}) {
    const isEdit = !!prop.id; state.editingProp = prop.id || null; const category = prop.category || defaults.category || 'vaccination'; const extra = propExtra(prop.id);
    const petId = isEdit ? petOf(prop)?.id || '' : defaults.petId || (state.pets.length === 1 ? state.pets[0].id : '');
    const day = prop.date ? dateOnly(prop.date) : dayKey(new Date()); const time = prop.date && showTime(prop) ? timeOf(prop.date) : '';
    const repeat = isEdit && isRepeating(prop); const period = extra.period || 'ежедневно';
    openModal(`<h2>${isEdit ? 'Редактировать запись' : 'Новая запись'}</h2><form id="record-form" novalidate>
      <div class="field"><label for="record-category">Тип записи</label><select id="record-category" name="category">${RECORD_CATEGORIES.map((c) => `<option value="${c}" ${c === category ? 'selected' : ''}>${CATEGORIES[c].icon} ${CATEGORIES[c].label}</option>`).join('')}</select></div>
      <div class="field"><label for="record-pet">Питомец</label><select id="record-pet" name="petId">${petOptions(petId, 'Без привязки к питомцу')}</select></div>
      <div class="field"><label for="record-name" data-name-label>Название *</label><input id="record-name" name="name" maxlength="200" value="${escapeHtml(prop.name || '')}" placeholder="${CATEGORIES[category].placeholder}"></div>
      <div class="field-row"><div class="field"><label for="record-date" data-date-label>Дата *</label><input id="record-date" name="date" type="date" value="${day}"></div><div class="field"><label for="record-time">Время</label><input id="record-time" name="time" type="time" value="${time}"></div></div>
      <div class="field"><label for="record-msg" data-msg-label>Комментарий</label><input id="record-msg" name="msg" maxlength="300" value="${escapeHtml(prop.msg || '')}" placeholder="Например, не забыть паспорт"></div>
      <div class="field" data-for="vet_visit"><label for="record-text">Заключение ветеринара</label><textarea id="record-text" name="text" placeholder="Диагноз, рекомендации, назначения…">${escapeHtml(prop.category === 'vet_visit' ? prop.text || '' : '')}</textarea></div>
      ${isEdit ? '' : `<div class="field" data-for="vaccination parasites"><label for="record-next">Следующая процедура</label><select id="record-next" name="next">${NEXT_INTERVALS.map(([value, label]) => `<option value="${value}" ${value === (DEFAULT_NEXT[category] || '') ? 'selected' : ''}>${label}</option>`).join('')}</select><p class="field-hint" id="next-hint"></p></div>
      <div data-for="medication">${courseFields('course_')}</div>
      <details class="form-details" data-for="vet_visit"><summary>💊 Назначить препарат по заключению</summary><div class="field"><label for="rx-name">Препарат</label><input id="rx-name" name="rx_name" maxlength="200" placeholder="Например, Синулокс"></div><div class="field"><label for="rx-dose">Дозировка</label><input id="rx-dose" name="rx_dose" maxlength="200" placeholder="Например, 1/2 таблетки"></div>${courseFields('rx_', day)}</details>`}
      <div data-for="reminder"><label class="checkbox-row"><input name="rep" type="checkbox" ${repeat ? 'checked' : ''}> Повторять напоминание</label><div class="field ${repeat ? '' : 'is-hidden'}" id="period-field"><label for="record-period">Как часто</label><select id="record-period" name="period">${PERIODS.map(([value, label]) => `<option value="${value}" ${period === value ? 'selected' : ''}>${label}</option>`).join('')}</select><p class="field-hint">Напоминание появится на все даты повторения на ближайший месяц.</p></div></div>
      <div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Отмена</button><button class="primary-button" type="submit">Сохранить</button></div></form>`);
    const form = $('#record-form');
    const refresh = (categoryChanged = false) => {
      const cat = form.elements.category.value;
      form.querySelectorAll('[data-for]').forEach((node) => node.classList.toggle('is-hidden', !node.dataset.for.split(' ').includes(cat)));
      form.elements.name.placeholder = CATEGORIES[cat].placeholder;
      form.querySelector('[data-name-label]').textContent = cat === 'medication' ? 'Препарат *' : 'Название *';
      form.querySelector('[data-date-label]').textContent = cat === 'medication' && !isEdit ? 'Первый приём *' : 'Дата *';
      form.querySelector('[data-msg-label]').textContent = cat === 'medication' ? 'Дозировка' : 'Комментарий';
      form.elements.msg.placeholder = cat === 'medication' ? 'Например, 1 таблетка' : 'Например, не забыть паспорт';
      if (form.elements.next && categoryChanged) form.elements.next.value = DEFAULT_NEXT[cat] || '';
      const nextHint = $('#next-hint');
      if (nextHint) { const months = Number(form.elements.next.value); nextHint.textContent = months && form.elements.date.value ? `Следующая ${cat === 'vaccination' ? 'вакцинация' : 'обработка'} — ${formatDate(addMonths(new Date(`${form.elements.date.value}T12:00:00`), months), false)} — мы добавим её в напоминания.` : ''; }
      if (!isEdit) { courseHint(form, 'course_', form.elements.date.value, form.elements.time.value); courseHint(form, 'rx_', form.elements.rx_start.value, form.elements.rx_time.value); }
    };
    form.addEventListener('change', (event) => { if (event.target.name === 'rep') $('#period-field').classList.toggle('is-hidden', !event.target.checked); refresh(event.target.name === 'category'); });
    form.addEventListener('input', () => refresh());
    form.addEventListener('submit', saveRecord);
    refresh();
  }
  async function saveRecord(event) {
    event.preventDefault(); const form = event.target; const data = new FormData(form); const button = form.querySelector('[type="submit"]');
    const category = data.get('category'); const name = String(data.get('name') || '').trim(); const day = data.get('date'); const time = data.get('time'); const petId = data.get('petId');
    const old = state.props.find((p) => p.id === state.editingProp); const isEdit = !!old; const isCourse = !isEdit && category === 'medication'; const rxName = category === 'vet_visit' && !isEdit ? String(data.get('rx_name') || '').trim() : '';
    const errors = [];
    if (!name) errors.push(['name', category === 'medication' ? 'Укажите название препарата.' : 'Укажите название записи.']);
    if (!day) errors.push(['date', 'Выберите дату.']);
    const course = isCourse && day ? courseDates(form, 'course_', day, time) : null;
    if (isCourse && day && !course) errors.push(['course_days', 'Длительность — от 1 до 90 дней.']); else if (course?.length > MAX_COURSE_DOSES) errors.push(['course_days', `Слишком много приёмов — максимум ${MAX_COURSE_DOSES}. Сократите курс.`]);
    const rx = rxName ? courseDates(form, 'rx_', data.get('rx_start'), data.get('rx_time')) : null;
    if (rxName) { if (!data.get('rx_start')) errors.push(['rx_start', 'Укажите дату начала приёма.']); else if (!rx) errors.push(['rx_days', 'Длительность — от 1 до 90 дней.']); else if (rx.length > MAX_COURSE_DOSES) errors.push(['rx_days', `Слишком много приёмов — максимум ${MAX_COURSE_DOSES}.`]); }
    if (form.querySelector('.form-details') && errors.some(([field]) => field.startsWith('rx_'))) form.querySelector('.form-details').open = true;
    if (!showErrors(form, errors)) return;
    busy(button, true); const createdIds = [];
    try {
      const msg = String(data.get('msg') || '').trim(); const repeat = category === 'reminder' && data.get('rep') === 'on'; const period = data.get('period') || 'ежедневно';
      let savedId = null; let note = 'Запись сохранена';
      if (isCourse) {
        const bodies = course.map((date, index) => propBody({ name, date: date.toISOString(), msg: [msg, `приём ${index + 1} из ${course.length}`].filter(Boolean).join(' · '), category: 'medication' }));
        createdIds.push(...await createProps(bodies)); note = `Курс сохранён: ${course.length} ${plural(course.length, ['напоминание', 'напоминания', 'напоминаний'])} о приёме`;
      } else {
        const text = category === 'vet_visit' ? String(data.get('text') || '').trim() : old && old.category === category ? old.text : null;
        // Сервер повторяет запись с rep каждый день, поэтому rep включаем только для ежедневного периода
        const body = propBody({ name, date: toIso(day, time), msg, text, rep: repeat && period === 'ежедневно', category }, old);
        const saved = isEdit ? await request(`/prop/edit?prop_id=${old.id}`, { method: 'PUT', body }) : await request('/prop/add', { method: 'POST', body });
        savedId = saved.id; if (!isEdit) createdIds.push(saved.id);
        const store = extras(); store.props[saved.id] = { hasTime: !!time, repeat, period }; saveExtras(store);
        const months = Number(data.get('next'));
        if (!isEdit && months && (category === 'vaccination' || category === 'parasites')) { const nextDate = addMonths(parseDate(saved.date), months); createdIds.push(...await createProps([propBody({ name, date: nextDate.toISOString(), msg: 'Рассчитано автоматически по прошлой записи', category })])); note = `Сохранено. Следующая ${category === 'vaccination' ? 'вакцинация' : 'обработка'} — ${formatDate(nextDate, false)}`; }
        if (rx) { const visitLabel = formatDate(parseDate(saved.date), false); const dose = String(data.get('rx_dose') || '').trim(); createdIds.push(...await createProps(rx.map((date, index) => propBody({ name: rxName, date: date.toISOString(), msg: [dose, `приём ${index + 1} из ${rx.length}`].filter(Boolean).join(' · '), text: `Назначено на визите ${visitLabel}`, category: 'medication' })))); note = `Визит сохранён, назначено ${rx.length} ${plural(rx.length, ['приём', 'приёма', 'приёмов'])} препарата`; }
      }
      if (isEdit) await setPropPet(savedId, petId); else if (petId) await linkProps(petId, createdIds);
      closeModal(); await loadData(); renderPage(); notify(note);
    } catch (error) {
      if (!applyApiFieldErrors(form, error)) notify(apiError(error), 'error');
      if (createdIds.length && state.user) { await loadData(); renderPage(); }
    } finally { busy(button, false); }
  }

  // ---------- Питание ----------
  function foodBadges(item) {
    const badges = [];
    if (item.liked === true) badges.push('<span class="badge good">👍 Понравилось</span>'); if (item.liked === false) badges.push('<span class="badge bad">👎 Не понравилось</span>');
    if (item.suitable === true) badges.push('<span class="badge good">✅ Подошло</span>'); if (item.suitable === false) badges.push('<span class="badge bad">⛔ Не подошло</span>');
    (item.reactions || []).forEach((r) => badges.push(`<span class="badge warn">⚠️ ${REACTIONS[r] || escapeHtml(r)}</span>`));
    return `<div class="badge-row">${badges.length ? badges.join('') : '<span class="badge">Не оценено</span>'}</div>`;
  }
  function foodBase(items) {
    const groups = {};
    items.forEach((item) => { const pet = petOf(item); const key = `${item.name.trim().toLowerCase()}|${pet?.id || ''}`; const group = groups[key] ||= { name: item.name.trim(), pet, count: 0, liked: 0, disliked: 0, suitable: 0, unsuitable: 0, reactions: new Set() }; group.count++; if (item.liked === true) group.liked++; if (item.liked === false) group.disliked++; if (item.suitable === true) group.suitable++; if (item.suitable === false) group.unsuitable++; (item.reactions || []).forEach((r) => group.reactions.add(r)); });
    const list = Object.values(groups); if (!list.length) return { html: '' };
    const bad = list.filter((g) => g.unsuitable || g.reactions.size); const good = list.filter((g) => !bad.includes(g) && g.suitable); const unknown = list.filter((g) => !good.includes(g) && !bad.includes(g));
    const row = (g) => `<li><strong>${escapeHtml(g.name)}</strong><span>${g.pet ? `${escapeHtml(g.pet.name)} · ` : ''}${g.count} ${plural(g.count, ['запись', 'записи', 'записей'])}${g.liked ? ` · 👍 ${g.liked}` : ''}${g.disliked ? ` · 👎 ${g.disliked}` : ''}</span>${g.reactions.size ? `<span class="reaction-line">⚠️ ${[...g.reactions].map((r) => REACTIONS[r] || escapeHtml(r)).join(', ')}</span>` : ''}</li>`;
    const column = (title, entries, cls, empty) => `<div class="food-column ${cls}"><h4>${title}</h4>${entries.length ? `<ul>${entries.map(row).join('')}</ul>` : `<p class="muted">${empty}</p>`}</div>`;
    return { html: `<div class="food-base">${column('✅ Подходят', good, 'good', 'Пока нет кормов с оценкой «подошло».')}${column('⛔ Не подходят', bad, 'bad', 'Нет кормов с плохой переносимостью.')}${unknown.length ? column('❔ Без оценки', unknown, 'unknown', '') : ''}</div>` };
  }
  function renderFood() {
    const all = propsOfPet(state.foodPet).filter((p) => p.category === 'food');
    const items = all.filter((p) => (state.foodLiked === '' || String(p.liked) === state.foodLiked) && (state.foodSuitable === '' || String(p.suitable) === state.foodSuitable)).sort(byDateDesc);
    const base = foodBase(all);
    el.pageContent.innerHTML = `<div class="section-title"><div><h2>Журнал питания</h2><p class="muted section-subtitle">Какие корма получал питомец, понравились ли они и как он их перенёс.</p></div><button class="primary-button compact-button" data-action="add-food" data-pet="${state.foodPet}">+ Добавить корм</button></div>
      <div class="filters"><select id="food-pet" aria-label="Питомец">${petOptions(state.foodPet, 'Все питомцы')}</select></div>
      <section class="page-section"><h3 class="subsection-title">База предпочтений</h3>${base.html || '<div class="empty-state">Добавьте первую запись о корме — здесь появится список того, что подходит питомцу, а что нет.</div>'}</section>
      <section class="page-section"><div class="section-title"><h3 class="subsection-title">История кормления</h3><div class="filters compact-filters"><select id="food-liked" aria-label="Предпочтение"><option value="">Любое предпочтение</option><option value="true" ${state.foodLiked === 'true' ? 'selected' : ''}>👍 Понравилось</option><option value="false" ${state.foodLiked === 'false' ? 'selected' : ''}>👎 Не понравилось</option></select><select id="food-suitable" aria-label="Переносимость"><option value="">Любая переносимость</option><option value="true" ${state.foodSuitable === 'true' ? 'selected' : ''}>✅ Подошло</option><option value="false" ${state.foodSuitable === 'false' ? 'selected' : ''}>⛔ Не подошло</option></select></div></div>${eventList(items, { empty: all.length ? 'По выбранным фильтрам ничего не найдено.' : 'Записей о кормах пока нет.' })}</section>`;
    bindSelect('food-pet', (value) => { state.foodPet = value; }); bindSelect('food-liked', (value) => { state.foodLiked = value; }); bindSelect('food-suitable', (value) => { state.foodSuitable = value; });
    bindDynamic();
  }
  function ratingField(name, label, value, options) { return `<div class="field"><label>${label}</label><div class="segmented">${options.map(([v, text]) => `<label class="segment"><input type="radio" name="${name}" value="${v}" ${String(value ?? '') === v ? 'checked' : ''}><span>${text}</span></label>`).join('')}</div></div>`; }
  function foodForm(prop = {}, defaults = {}) {
    const isEdit = !!prop.id; state.editingProp = prop.id || null; const petId = isEdit ? petOf(prop)?.id || '' : defaults.petId || (state.pets.length === 1 ? state.pets[0].id : '');
    const day = prop.date ? dateOnly(prop.date) : dayKey(new Date()); const time = prop.date && showTime(prop) ? timeOf(prop.date) : '';
    openModal(`<h2>${isEdit ? 'Редактировать запись о корме' : 'Запись о корме'}</h2><form id="food-form" novalidate>
      <div class="field"><label for="food-pet-field">Питомец</label><select id="food-pet-field" name="petId">${petOptions(petId, 'Без привязки к питомцу')}</select></div>
      <div class="field"><label for="food-name">Корм *</label><input id="food-name" name="name" maxlength="200" value="${escapeHtml(prop.name || '')}" placeholder="${CATEGORIES.food.placeholder}"></div>
      <div class="field-row"><div class="field"><label for="food-date">Дата *</label><input id="food-date" name="date" type="date" max="${dayKey(new Date())}" value="${day}"></div><div class="field"><label for="food-time">Время</label><input id="food-time" name="time" type="time" value="${time}"></div></div>
      <div class="field"><label for="food-msg">Порция</label><input id="food-msg" name="msg" maxlength="200" value="${escapeHtml(prop.msg || '')}" placeholder="Например, 60 г утром"></div>
      ${ratingField('liked', 'Понравилось питомцу?', prop.liked, [['true', '👍 Понравилось'], ['false', '👎 Не понравилось'], ['', 'Не оценено']])}
      ${ratingField('suitable', 'Подошёл ли корм?', prop.suitable, [['true', '✅ Подошло'], ['false', '⛔ Не подошло'], ['', 'Не оценено']])}
      <div class="field"><label>Нежелательные реакции</label><div class="checkbox-grid">${Object.entries(REACTIONS).map(([value, label]) => `<label class="checkbox-row"><input type="checkbox" name="reactions" value="${value}" ${(prop.reactions || []).includes(value) ? 'checked' : ''}> ${label}</label>`).join('')}</div></div>
      <div class="field"><label for="food-text">Комментарий</label><textarea id="food-text" name="text" maxlength="1000" placeholder="Например, мягкий стул на второй день">${escapeHtml(prop.text || '')}</textarea></div>
      <div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Отмена</button><button class="primary-button" type="submit">Сохранить</button></div></form>`);
    const form = $('#food-form');
    // Реакция обычно значит «не подошло» — подставляем, если переносимость ещё не оценена
    form.addEventListener('change', (event) => { if (event.target.name === 'reactions' && event.target.checked && !form.querySelector('[name="suitable"]:checked')?.value) form.querySelector('[name="suitable"][value="false"]').checked = true; });
    form.addEventListener('submit', saveFood);
  }
  async function saveFood(event) {
    event.preventDefault(); const form = event.target; const data = new FormData(form); const button = form.querySelector('[type="submit"]'); const name = String(data.get('name') || '').trim(); const day = data.get('date');
    const errors = []; if (!name) errors.push(['name', 'Укажите название корма.']); if (!day) errors.push(['date', 'Выберите дату.']); else if (day > dayKey(new Date())) errors.push(['date', 'Запись о корме не может быть в будущем.']);
    if (!showErrors(form, errors)) return;
    const rating = (value) => (value === 'true' ? true : value === 'false' ? false : null); const old = state.props.find((p) => p.id === state.editingProp);
    const body = propBody({ name, date: toIso(day, data.get('time')), msg: String(data.get('msg') || '').trim(), text: String(data.get('text') || '').trim(), category: 'food', liked: rating(data.get('liked')), suitable: rating(data.get('suitable')), reactions: data.getAll('reactions') }, old);
    busy(button, true);
    try {
      const saved = old ? await request(`/prop/edit?prop_id=${old.id}`, { method: 'PUT', body }) : await request('/prop/add', { method: 'POST', body });
      const store = extras(); store.props[saved.id] = { ...(store.props[saved.id] || {}), hasTime: !!data.get('time') }; saveExtras(store);
      if (old) await setPropPet(saved.id, data.get('petId')); else if (data.get('petId')) await linkProps(data.get('petId'), [saved.id]);
      closeModal(); await loadData(); renderPage(); notify('Запись о корме сохранена');
    } catch (error) { if (!applyApiFieldErrors(form, error)) notify(apiError(error), 'error'); } finally { busy(button, false); }
  }

  // ---------- Напоминания: список и календарь ----------
  function renderReminders() {
    const types = [['', 'Все события'], ...RECORD_CATEGORIES.map((c) => [c, `${CATEGORIES[c].icon} ${CATEGORIES[c].label}`]), ['birthday', '🎂 Дни рождения']];
    el.pageContent.innerHTML = `<div class="section-title"><div><h2>Ближайшие события</h2><p class="muted section-subtitle">Процедуры, приём препаратов, напоминания и дни рождения питомцев.</p></div><button class="primary-button compact-button" data-action="add-record" data-category="reminder" data-pet="${state.remindersPet}">+ Напоминание</button></div>
      <div class="filters"><select id="reminders-pet" aria-label="Питомец">${petOptions(state.remindersPet, 'Все питомцы')}</select><select id="reminders-type" aria-label="Тип события">${types.map(([value, label]) => `<option value="${value}" ${state.remindersType === value ? 'selected' : ''}>${label}</option>`).join('')}</select><div class="date-filter"><input id="reminders-date" type="date" value="${state.remindersDate}" aria-label="Дата">${state.remindersDate ? '<button class="outline-button" id="clear-reminders-date" type="button">Сбросить дату</button>' : ''}</div><div class="view-switch"><button class="outline-button ${state.procedureView === 'list' ? 'is-active' : ''}" data-view="list" type="button">Список</button><button class="outline-button ${state.procedureView === 'calendar' ? 'is-active' : ''}" data-view="calendar" type="button">Календарь</button></div></div><div id="procedure-output"></div>`;
    bindSelect('reminders-pet', (value) => { state.remindersPet = value; }); bindSelect('reminders-type', (value) => { state.remindersType = value; });
    $('#reminders-date').addEventListener('change', (event) => { state.remindersDate = event.target.value; if (event.target.value) { const date = new Date(`${event.target.value}T12:00:00`); state.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1); state.calendarSelectedDate = event.target.value; } renderPage(); });
    $('#clear-reminders-date')?.addEventListener('click', () => { state.remindersDate = ''; renderPage(); });
    $$('[data-view]').forEach((button) => button.addEventListener('click', () => { state.procedureView = button.dataset.view; renderPage(); }));
    bindDynamic(); updateProcedureOutput();
  }
  function updateProcedureOutput() {
    const output = $('#procedure-output'); if (!output) return;
    if (state.procedureView === 'calendar') output.innerHTML = calendarView();
    else if (state.remindersDate) { const from = new Date(`${state.remindersDate}T00:00:00`); const items = eventsFor(state.remindersPet, state.remindersType, from, addDays(from, 1)).filter((item) => dateOnly(item.date) === state.remindersDate).sort(byDateAsc); output.innerHTML = `<section class="calendar-day"><h3>${dayLabel(state.remindersDate)}</h3>${eventList(items, { empty: 'На эту дату ничего не запланировано.' })}</section>`; }
    else output.innerHTML = groupedEvents(upcomingEvents(state.remindersPet, state.remindersType));
    bindDynamic(output);
  }
  function groupedEvents(items) {
    if (!items.length) return '<div class="empty-state">Ближайших событий нет.<br>Добавьте прививку или обработку в карте здоровья — следующую дату мы рассчитаем сами.</div>';
    const groups = {}; items.forEach((item) => { (groups[dateOnly(item.date)] ||= []).push(item); });
    return Object.keys(groups).map((date) => { const relative = relativeDay(`${date}T12:00:00`); return `<section class="calendar-day"><h3>${dayLabel(date)}${relative ? ` <span class="muted day-relative">· ${relative}</span>` : ''}</h3>${eventList(groups[date])}</section>`; }).join('');
  }
  function calendarView() {
    const base = state.calendarMonth; const year = base.getFullYear(); const month = base.getMonth(); const first = new Date(year, month, 1); const days = new Date(year, month + 1, 0).getDate();
    const items = eventsFor(state.remindersPet, state.remindersType, first, new Date(year, month, days, 23, 59)); const byDate = {}; items.forEach((item) => { (byDate[dateOnly(item.date)] ||= []).push(item); });
    const today = dayKey(new Date()); const blanks = Array.from({ length: (first.getDay() + 6) % 7 }, () => '<div class="calendar-cell is-empty"></div>').join('');
    const cells = Array.from({ length: days }, (_, index) => { const day = index + 1; const key = `${year}-${pad(month + 1)}-${pad(day)}`; const dayItems = (byDate[key] || []).sort(byDateAsc); const classes = [dayItems.length ? 'has-procedures' : '', key === today ? 'is-today' : '', key === state.calendarSelectedDate ? 'is-selected' : ''].filter(Boolean).join(' '); return `<button class="calendar-cell ${classes}" type="button" data-calendar-date="${key}" aria-label="${dayLabel(key)}${dayItems.length ? `, событий: ${dayItems.length}` : ''}"><strong>${day}</strong>${dayItems.slice(0, 3).map((item) => { const pet = item.virtual ? state.pets.find((p) => p.id === item.petId) : petOf(item); return `<span title="${escapeHtml(item.name)}">${CATEGORIES[item.category]?.icon || ''} ${escapeHtml(item.name)}<small>${escapeHtml(pet ? pet.name : 'Все питомцы')}</small></span>`; }).join('')}${dayItems.length > 3 ? `<small class="calendar-more">+ ещё ${dayItems.length - 3}</small>` : ''}</button>`; }).join('');
    const selected = state.calendarSelectedDate; const selectedItems = selected ? eventsFor(state.remindersPet, state.remindersType, new Date(`${selected}T00:00:00`), new Date(`${selected}T23:59:59`)).filter((item) => dateOnly(item.date) === selected).sort(byDateAsc) : [];
    const selectedOutput = selected ? `<section class="calendar-selected-day"><h3>${dayLabel(selected)}</h3>${eventList(selectedItems, { empty: 'На этот день ничего не запланировано.' })}</section>` : '<div class="calendar-selection-hint">Нажмите на дату, чтобы увидеть все события этого дня.</div>';
    return `<div class="calendar-month"><div class="calendar-month-header"><button class="outline-button" type="button" data-calendar-month="prev" aria-label="Предыдущий месяц">←</button><h3>${base.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</h3><div class="calendar-header-actions"><button class="outline-button" type="button" data-calendar-today>Сегодня</button><button class="outline-button" type="button" data-calendar-month="next" aria-label="Следующий месяц">→</button></div></div><div class="calendar-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="calendar-grid">${blanks}${cells}</div></div>${selectedOutput}`;
  }

  // ---------- Аккаунт ----------
  function renderProfile() {
    const profile = extras().profile; const user = state.user;
    el.pageContent.innerHTML = `<div class="card profile-card"><h2>Данные аккаунта</h2><p class="muted">Измените имя, email или телефон. Для подтверждения введите текущий пароль.</p>${profile.avatar ? `<img class="avatar-large" src="${profile.avatar}" alt="Аватар">` : ''}<form id="profile-form" novalidate>
      <div class="field"><label for="profile-name">Имя *</label><input id="profile-name" name="name" autocomplete="name" maxlength="100" value="${escapeHtml(user.name || '')}"></div>
      <div class="field"><label for="profile-email">Email *</label><input id="profile-email" name="email" type="email" autocomplete="email" value="${escapeHtml(user.email || '')}">${user.email_verified === false ? '<p class="field-hint">⚠️ Email не подтверждён. <button class="text-button" type="button" data-action="verify-email">Подтвердить</button></p>' : ''}</div>
      <div class="field"><label for="profile-phone">Телефон</label><input id="profile-phone" name="phone_number" type="tel" autocomplete="tel" placeholder="+79990000000" value="${escapeHtml(user.phone_number || '')}"></div>
      <div class="field"><label for="profile-new-password">Новый пароль</label><input id="profile-new-password" name="new_passwd" type="password" autocomplete="new-password" placeholder="Оставьте пустым, чтобы не менять"></div>
      <div class="field"><label for="profile-password">Текущий пароль *</label><input id="profile-password" name="passwd" type="password" autocomplete="current-password" placeholder="Для подтверждения изменений"></div>
      <div class="field"><label for="profile-avatar">Аватар (сохраняется в этом браузере)</label><input id="profile-avatar" name="avatar" type="file" accept="image/*"></div>
      <button class="primary-button" type="submit">Сохранить данные</button></form></div>`;
    $('#profile-form').addEventListener('submit', updateProfile);
    $('[data-action="verify-email"]')?.addEventListener('click', async () => { await request('/user/verify/resend', { method: 'POST', body: { email: user.email } }).catch(() => {}); emailVerifyModal(user.email); });
    bindDynamic();
  }
  async function updateProfile(event) {
    event.preventDefault(); const form = event.target; const data = new FormData(form); const button = form.querySelector('[type="submit"]');
    const name = String(data.get('name') || '').trim(); const email = String(data.get('email') || '').trim().toLowerCase(); const phone = String(data.get('phone_number') || '').trim(); const current = String(data.get('passwd') || ''); const fresh = String(data.get('new_passwd') || ''); const avatar = data.get('avatar');
    const errors = []; if (name.length < 2) errors.push(['name', 'Имя должно содержать минимум 2 символа.']); if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(['email', 'Введите корректный email, например name@mail.ru']); if (phone && !/^\+?[\d\s()-]{10,18}$/.test(phone)) errors.push(['phone_number', 'Введите номер в формате +79990000000']); if (fresh && fresh.length < 6) errors.push(['new_passwd', 'Пароль должен быть не короче 6 символов.']); if (!current) errors.push(['passwd', 'Введите текущий пароль, чтобы сохранить изменения.']); if (avatar?.size && !avatar.type.startsWith('image/')) errors.push(['avatar', 'Аватар должен быть изображением.']);
    if (!showErrors(form, errors)) return;
    busy(button, true);
    try {
      // Сервер перезаписывает пароль тем, что пришёл, поэтому сначала проверяем текущий пароль входом
      try { await request('/user/login', { method: 'POST', body: { email: state.user.email, passwd: current } }); } catch (error) { if (error?.status === 401) { showErrors(form, [['passwd', 'Неверный текущий пароль.']]); return; } if (error?.status !== 403) throw error; }
      const oldEmail = state.user.email; const user = await request('/user/edit', { method: 'PUT', body: { email, passwd: fresh || current, name, phone_number: phone || null } });
      if (user.email !== oldEmail) { const oldExtras = localStorage.getItem(extrasKey(oldEmail)); if (oldExtras) { localStorage.setItem(extrasKey(user.email), oldExtras); localStorage.removeItem(extrasKey(oldEmail)); } }
      state.user = user;
      if (avatar?.size) { const store = extras(); store.profile.avatar = await readFile(avatar); saveExtras(store); }
      updateUserChip(); renderPage(); notify('Данные аккаунта обновлены');
      if (user.email !== oldEmail) emailVerifyModal(user.email);
    } catch (error) {
      if (error?.status === 409) showErrors(form, [[/phone/i.test(error.detail || '') ? 'phone_number' : 'email', apiError(error)]]);
      else if (!applyApiFieldErrors(form, error)) notify(apiError(error), 'error');
    } finally { busy(button, false); }
  }
  function emailVerifyModal(email) {
    openModal(`<h2>Подтвердите email</h2><p class="muted">Мы отправили 6-значный код на <strong>${escapeHtml(email)}</strong>. Код действует 15 минут.</p><form id="email-verify-form" novalidate><div class="field"><label for="modal-code">Код подтверждения</label><input id="modal-code" name="code" class="code-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><button class="primary-button" type="submit">Подтвердить</button></form><button class="secondary-button" type="button" id="modal-resend">Отправить код ещё раз</button><p class="resend-status" id="modal-resend-status">${USE_MOCK_API ? 'Демо-режим: код 123456' : ''}</p>`);
    const form = $('#email-verify-form');
    form.elements.code.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });
    $('#modal-resend').addEventListener('click', (event) => resendCode(email, $('#modal-resend-status'), event.currentTarget));
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const code = form.elements.code.value; if (!showErrors(form, /^\d{6}$/.test(code) ? [] : [['code', 'Введите 6 цифр из письма.']])) return;
      const button = form.querySelector('[type="submit"]'); busy(button, true, 'Проверяем…');
      try { const result = await request('/user/verify', { method: 'POST', body: { email, code } }); localStorage.setItem(TOKEN_KEY, result.access_token); state.user = await request('/user/me'); closeModal(); renderPage(); notify('Email подтверждён'); } catch (error) { showErrors(form, [['code', apiError(error)]]); } finally { busy(button, false); }
    });
  }

  // ---------- Питомцы: форма, фото, удаление ----------
  function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
  function petForm(pet = {}) {
    state.editingPet = pet.id || null; const extra = petExtra(pet.id); const type = pet.type || ''; const known = SPECIES.find((item) => item.toLowerCase() === type.toLowerCase() && item !== 'Другое');
    const species = known || (type ? 'Другое' : 'Кошка'); const custom = known || type.toLowerCase() === 'другое' ? '' : type;
    openModal(`<h2>${pet.id ? 'Редактировать питомца' : 'Новый питомец'}</h2>${pet.id ? '' : '<p class="muted modal-lead">Достаточно имени — остальное можно заполнить позже.</p>'}<form id="pet-form" novalidate>
      <div class="field"><label for="pet-name">Имя *</label><input id="pet-name" name="name" maxlength="100" value="${escapeHtml(pet.name || '')}" placeholder="Например, Барсик"></div>
      <div class="field-row"><div class="field"><label for="pet-species">Вид</label><select name="species" id="pet-species">${SPECIES.map((item) => `<option ${item === species ? 'selected' : ''}>${item}</option>`).join('')}</select></div><div class="field"><label for="pet-breed">Порода</label><input id="pet-breed" name="breed" maxlength="100" value="${escapeHtml(pet.breed || '')}" placeholder="Например, британская"></div></div>
      <div class="field ${species === 'Другое' ? '' : 'is-hidden'}" id="custom-type-field"><label for="pet-custom">Какой вид?</label><input id="pet-custom" name="customType" maxlength="100" value="${escapeHtml(custom)}" placeholder="Например, хорёк"></div>
      <div class="field"><label for="pet-birth">Дата рождения</label><input id="pet-birth" name="birth_date" type="date" max="${dayKey(new Date())}" value="${escapeHtml(pet.birth_date || '')}"></div>
      <div class="field"><label for="pet-photo">Фото</label><input id="pet-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="field-hint">JPEG, PNG или WebP до 5 МБ.</p>${pet.has_picture ? '<label class="checkbox-row"><input type="checkbox" name="removePhoto"> Удалить текущее фото</label>' : ''}</div>
      <details class="form-details" ${extra.description || extra.fields ? 'open' : ''}><summary>Дополнительно</summary><div class="field"><label for="pet-description">Особенности</label><textarea id="pet-description" name="description" placeholder="Характер, аллергии, хронические болезни…">${escapeHtml(extra.description || '')}</textarea></div><div class="field"><label for="pet-fields">Другие параметры</label><textarea id="pet-fields" name="fields" placeholder="Например: Чип: 643…&#10;Окрас: рыжий">${escapeHtml(extra.fields || '')}</textarea></div><p class="field-hint">Эти поля сохраняются в этом браузере.</p></details>
      <div class="form-actions"><button type="button" class="secondary-button" data-close-modal>Отмена</button><button class="primary-button" type="submit">${pet.id ? 'Сохранить' : 'Добавить питомца'}</button></div></form>`);
    $('#pet-form').addEventListener('submit', savePet); $('#pet-name').focus();
  }
  async function savePet(event) {
    event.preventDefault(); const form = event.target; const data = new FormData(form); const button = form.querySelector('[type="submit"]');
    const name = String(data.get('name') || '').trim(); const birth = data.get('birth_date'); const file = data.get('photo'); const species = data.get('species'); const custom = String(data.get('customType') || '').trim();
    const errors = []; if (!name) errors.push(['name', 'Введите имя питомца.']); if (birth && birth > dayKey(new Date())) errors.push(['birth_date', 'Дата рождения не может быть в будущем.']); if (file?.size && !PHOTO_TYPES.includes(file.type)) errors.push(['photo', 'Подойдут только JPEG, PNG или WebP.']); else if (file?.size > MAX_PHOTO_SIZE) errors.push(['photo', 'Фото больше 5 МБ — выберите файл поменьше.']);
    if (!showErrors(form, errors)) return;
    const old = state.pets.find((p) => p.id === state.editingPet);
    const body = { name, type: species === 'Другое' ? custom || 'Другое' : species, breed: String(data.get('breed') || '').trim() || null, birth_date: birth || null, own_ids: old?.own_ids || [], prop_ids: old?.prop_ids || [] };
    busy(button, true);
    try {
      const saved = old ? await request(`/pet/edit?pet_id=${old.id}`, { method: 'PUT', body }) : await request('/pet/add', { method: 'POST', body });
      const store = extras(); store.pets[saved.id] = { ...(store.pets[saved.id] || {}), description: String(data.get('description') || ''), fields: String(data.get('fields') || '') }; saveExtras(store);
      let photoError = '';
      try { if (file?.size) await uploadPetPhoto(saved.id, file); else if (data.get('removePhoto') === 'on') await deletePetPhoto(saved.id); } catch (error) { photoError = apiError(error); }
      closeModal(); await loadData(); renderPage();
      if (photoError) notify(`Питомец сохранён, но с фото не получилось: ${photoError}`, 'error'); else notify(old ? 'Изменения сохранены' : `${saved.name}: карточка создана!`);
    } catch (error) { if (!applyApiFieldErrors(form, error)) notify(apiError(error), 'error'); } finally { busy(button, false); }
  }
  async function uploadPetPhoto(id, file) {
    if (USE_MOCK_API) { localStorage.setItem(photoKey(id), await readFile(file)); await request(`/pets/${id}/photo`, { method: 'POST' }); return; }
    const form = new FormData(); form.append('file', file); await request(`/pets/${id}/photo`, { method: 'POST', body: form });
    if (state.photoUrls[id]) URL.revokeObjectURL(state.photoUrls[id]); delete state.photoUrls[id];
  }
  async function deletePetPhoto(id) { await request(`/pets/${id}/photo`, { method: 'DELETE' }); if (USE_MOCK_API) localStorage.removeItem(photoKey(id)); if (state.photoUrls[id]) URL.revokeObjectURL(state.photoUrls[id]); delete state.photoUrls[id]; }
  async function loadRemotePhotos() {
    if (USE_MOCK_API) return;
    await Promise.all(state.pets.filter((pet) => pet.has_picture && !state.photoUrls[pet.id]).map(async (pet) => { try { const response = await fetch(`${API}/pets/${pet.id}/photo`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } }); if (response.ok) state.photoUrls[pet.id] = URL.createObjectURL(await response.blob()); } catch {} }));
    $$('[data-photo-id]').forEach((image) => { const url = state.photoUrls[image.dataset.photoId]; if (url) image.src = url; else image.replaceWith(document.createTextNode('🐾')); });
  }
  async function deleteItem(type, id) {
    const pet = type === 'pet' ? state.pets.find((item) => item.id === Number(id)) : null; const prop = type === 'prop' ? state.props.find((item) => item.id === Number(id)) : null;
    const text = pet ? `Питомец «${pet.name}» будет удалён. Записи о нём останутся в журналах.` : prop && isRepeating(prop) ? `Запись «${prop.name}» и все её повторы будут удалены.` : `Запись «${prop?.name || ''}» будет удалена.`;
    if (!await confirmDialog(text)) return;
    try {
      await request(pet ? `/pet/del?pet_id=${id}` : `/prop/del?prop_id=${id}`, { method: 'DELETE' });
      const store = extras();
      if (pet) { if (state.selectedPet === pet.id) state.selectedPet = null; ['healthPet', 'foodPet', 'remindersPet'].forEach((key) => { if (String(state[key]) === String(pet.id)) state[key] = ''; }); delete store.pets[pet.id]; delete store.weights[pet.id]; localStorage.removeItem(photoKey(pet.id)); } else delete store.props[id];
      saveExtras(store); await loadData(); renderPage(); notify(pet ? 'Питомец удалён' : 'Запись удалена');
    } catch (error) { notify(apiError(error), 'error'); }
  }

  // ---------- Обработчики ----------
  function bindDynamic(root = el.pageContent) {
    const all = (selector) => [...root.querySelectorAll(selector)];
    all('[data-action="add-pet"]').forEach((b) => b.addEventListener('click', () => petForm()));
    all('[data-action="add-record"]').forEach((b) => b.addEventListener('click', () => recordForm({}, { category: b.dataset.category, petId: b.dataset.pet })));
    all('[data-action="add-food"]').forEach((b) => b.addEventListener('click', () => foodForm({}, { petId: b.dataset.pet })));
    all('[data-action="open-pet"]').forEach((b) => b.addEventListener('click', (event) => { event.stopPropagation(); navigate('pets', { selectedPet: Number(b.dataset.id) }); }));
    all('[data-action="select-pet"]').forEach((b) => b.addEventListener('click', () => { state.selectedPet = state.selectedPet === Number(b.dataset.id) ? null : Number(b.dataset.id); renderPage(); }));
    all('[data-action="back-pets"]').forEach((b) => b.addEventListener('click', () => { state.selectedPet = null; renderPage(); }));
    all('[data-action="edit-pet"]').forEach((b) => b.addEventListener('click', () => petForm(state.pets.find((p) => p.id === Number(b.dataset.id)))));
    all('[data-action="delete-pet"]').forEach((b) => b.addEventListener('click', (event) => { event.stopPropagation(); deleteItem('pet', b.dataset.id); }));
    all('[data-action="edit-prop"]').forEach((b) => b.addEventListener('click', () => { const prop = state.props.find((p) => p.id === Number(b.dataset.id)); if (prop) (prop.category === 'food' ? foodForm : recordForm)(prop); }));
    all('[data-action="delete-prop"]').forEach((b) => b.addEventListener('click', () => deleteItem('prop', b.dataset.id)));
    all('[data-action="delete-weight"]').forEach((b) => b.addEventListener('click', async () => { if (!await confirmDialog('Удалить это измерение веса?')) return; const store = extras(); store.weights[state.healthPet] = (store.weights[state.healthPet] || []).filter((w) => String(w.id) !== b.dataset.id); saveExtras(store); renderPage(); notify('Измерение удалено'); }));
    all('[data-action="open-notifications"]').forEach((b) => b.addEventListener('click', openNotifications));
    all('[data-goto]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.goto, { healthPet: b.dataset.goto === 'health' && b.dataset.pet ? b.dataset.pet : undefined, foodPet: b.dataset.goto === 'food' && b.dataset.pet ? b.dataset.pet : undefined })));
    all('[data-calendar-month]').forEach((b) => b.addEventListener('click', () => { state.calendarMonth.setMonth(state.calendarMonth.getMonth() + (b.dataset.calendarMonth === 'next' ? 1 : -1)); updateProcedureOutput(); }));
    all('[data-calendar-today]').forEach((b) => b.addEventListener('click', () => { const today = new Date(); state.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1); state.calendarSelectedDate = dayKey(today); updateProcedureOutput(); }));
    all('[data-calendar-date]').forEach((b) => b.addEventListener('click', () => { state.calendarSelectedDate = b.dataset.calendarDate; updateProcedureOutput(); $('.calendar-selected-day')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
  }
  function clearFieldError(event) { const field = event.target.closest?.('.has-error'); if (field) { field.classList.remove('has-error'); field.querySelector('.field-error')?.remove(); } }
  $$('[data-page]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.page)));
  $('#bell-button').addEventListener('click', openNotifications);
  $('.user-chip').addEventListener('click', () => navigate('profile'));
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.mode)));
  $('.password-toggle').addEventListener('click', (event) => { const visible = el.authPassword.type === 'text'; el.authPassword.type = visible ? 'password' : 'text'; event.currentTarget.textContent = visible ? 'Показать' : 'Скрыть'; });
  $('#back-to-auth').addEventListener('click', () => { el.verifyView.classList.add('is-hidden'); el.authView.classList.remove('is-hidden'); });
  $('#logout-button').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); location.reload(); });
  el.verifyCode.addEventListener('input', () => { el.verifyCode.value = el.verifyCode.value.replace(/\D/g, '').slice(0, 6); });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-close-modal]')) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !el.modal.classList.contains('is-hidden')) closeModal(); });
  // Подсветка ошибки снимается, как только пользователь начинает исправлять поле
  document.addEventListener('input', clearFieldError);
  document.addEventListener('change', (event) => { if (event.target.id === 'pet-species') $('#custom-type-field')?.classList.toggle('is-hidden', event.target.value !== 'Другое'); clearFieldError(event); });
  el.authForm.addEventListener('submit', async (event) => {
    event.preventDefault(); clearMessage(el.authMessage);
    const email = el.authEmail.value.trim().toLowerCase(); const password = el.authPassword.value; const register = state.authMode === 'register';
    const errors = [];
    if (register && el.authName.value.trim().length < 2) errors.push(['name', 'Введите имя — минимум 2 символа.']);
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(['email', 'Введите корректный email, например name@mail.ru']);
    if (password.length < 6) errors.push(['passwd', 'Пароль должен быть не короче 6 символов.']);
    if (register && !el.terms.checked) errors.push(['terms', 'Нужно принять условия использования.']);
    if (!showErrors(el.authForm, errors)) return;
    busy(el.authSubmit, true, 'Подождите…');
    try {
      if (register) { await request('/user/add', { method: 'POST', body: { email, passwd: password, name: el.authName.value.trim() } }); showVerify(email); message(el.verifyMessage, 'Мы отправили код на вашу почту.', 'success'); startResendCooldown(el.resendStatus, el.resend); }
      else { const result = await request('/user/login', { method: 'POST', body: { email, passwd: password } }); await enterApp(result.access_token); }
    } catch (error) {
      if (error?.status === 403 && !register) { showVerify(email); message(el.verifyMessage, 'Сначала подтвердите email — мы отправили новый код.', 'success'); resendCode(email, el.resendStatus, el.resend); }
      else if (error?.status === 401) showErrors(el.authForm, [['passwd', 'Неверный email или пароль.']]);
      else if (error?.status === 409) showErrors(el.authForm, [['email', apiError(error)]]);
      else message(el.authMessage, apiError(error));
    } finally { busy(el.authSubmit, false); }
  });
  el.verifyForm.addEventListener('submit', async (event) => {
    event.preventDefault(); clearMessage(el.verifyMessage);
    if (!/^\d{6}$/.test(el.verifyCode.value)) return message(el.verifyMessage, 'Введите 6 цифр из письма.');
    const button = el.verifyForm.querySelector('[type="submit"]'); busy(button, true, 'Проверяем…');
    try { const result = await request('/user/verify', { method: 'POST', body: { email: state.verifyEmail, code: el.verifyCode.value } }); el.verifyView.classList.add('is-hidden'); el.authView.classList.remove('is-hidden'); await enterApp(result.access_token); } catch (error) { message(el.verifyMessage, apiError(error)); } finally { busy(button, false); }
  });
  el.resend.addEventListener('click', () => resendCode(state.verifyEmail, el.resendStatus, el.resend));
  async function restoreSession() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try { await enterApp(); } catch { localStorage.removeItem(TOKEN_KEY); state.user = null; el.appScreen.classList.add('is-hidden'); el.authScreen.classList.remove('is-hidden'); setAuthMode('login'); }
  }
  setAuthMode('login'); restoreSession();
  if (IS_FILE && !USE_MOCK_API) message(el.authMessage, `Похоже, сайт открыт двойным кликом по файлу. ${RUN_HINT}`);
})();
