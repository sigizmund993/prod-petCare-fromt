(() => {
  'use strict';

  // Когда бэкенд будет готов, замените true на false.
  const USE_MOCK_API = false;
  const API_BASE_URL = 'http://139.100.200.207:8080';
  const MOCK_CODE = '123456';

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    authView: $('#auth-view'), verifyView: $('#verify-view'), successView: $('#success-view'),
    authForm: $('#auth-form'), verifyForm: $('#verify-form'), nameField: $('#name-field'), termsField: $('#terms-field'),
    name: $('#name'), email: $('#email'), password: $('#password'), terms: $('#terms'), code: $('#code'),
    title: $('#form-title'), subtitle: $('#form-subtitle'), submit: $('#submit-button'), message: $('#message'),
    verifyMessage: $('#verify-message'), verifyEmail: $('#verify-email'), resend: $('#resend-button'), resendStatus: $('#resend-status'),
    mockHint: $('#mock-hint'), successText: $('#success-text')
  };
  let mode = 'login';
  let emailForVerification = '';
  let resendTimer;

  function showMessage(element, text, type = 'error') {
    element.textContent = text;
    element.className = `message is-visible ${type}`;
  }

  function clearMessage(element) { element.textContent = ''; element.className = 'message'; }

  function setBusy(button, busy, busyText) {
    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.defaultText;
  }

  function setFieldError(name, text = '') {
    const field = document.querySelector(`[data-error-for="${name}"]`);
    const input = document.getElementById(name);
    if (field) field.textContent = text;
    if (input) input.closest('.field')?.classList.toggle('has-error', Boolean(text));
  }

  function validateAuth() {
    let valid = true;
    const email = elements.email.value.trim();
    const password = elements.password.value;
    setFieldError('email'); setFieldError('password'); setFieldError('name');
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFieldError('email', 'Введите корректный email.'); valid = false; }
    if (password.length < 6) { setFieldError('password', 'Пароль должен содержать минимум 6 символов.'); valid = false; }
    if (mode === 'register' && elements.name.value.trim().length < 2) { setFieldError('name', 'Введите имя.'); valid = false; }
    if (mode === 'register' && !elements.terms.checked) { showMessage(elements.message, 'Примите условия использования, чтобы продолжить.'); valid = false; }
    return valid;
  }

  function setMode(nextMode) {
    mode = nextMode;
    document.querySelectorAll('.tab').forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active));
    });
    const register = mode === 'register';
    elements.nameField.classList.toggle('is-hidden', !register); elements.termsField.classList.toggle('is-hidden', !register);
    $('#forgot-link').classList.toggle('is-hidden', register);
    elements.title.textContent = register ? 'Создайте аккаунт' : 'Войдите в аккаунт';
    elements.subtitle.textContent = register ? 'Начните заботиться о питомце ещё удобнее' : 'Продолжите заботиться о своём питомце';
    elements.submit.textContent = register ? 'Зарегистрироваться' : 'Войти';
    elements.mockHint.textContent = USE_MOCK_API ? 'Демо-режим включён: после регистрации используйте код 123456.' : 'Данные передаются на сервер PetCare.';
    clearMessage(elements.message);
    ['name', 'email', 'password'].forEach((name) => setFieldError(name));
  }

  async function api(path, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('petcare_access_token');
    const response = await fetch(API_BASE_URL + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw { status: response.status, detail: data.detail };
    return data;
  }

  function mockApi(path, { body } = {}) {
    return new Promise((resolve, reject) => setTimeout(() => {
      const stored = JSON.parse(localStorage.getItem('petcare_mock_users') || '{}');
      if (path === '/user/add') {
        if (stored[body.email]) return reject({ status: 409, detail: 'Email already registered' });
        stored[body.email] = { ...body, verified: false };
        localStorage.setItem('petcare_mock_users', JSON.stringify(stored));
        return resolve({ id: Date.now(), email: body.email, name: body.name, email_verified: false });
      }
      if (path === '/user/login') {
        const user = stored[body.email];
        if (user && !user.verified) return reject({ status: 403, detail: 'Email not verified' });
        if (user && user.passwd !== body.passwd) return reject({ status: 401, detail: 'Invalid credentials' });
        return resolve({ access_token: `mock-token-${Date.now()}`, token_type: 'bearer', name: user?.name || 'Пользователь' });
      }
      if (path === '/user/verify') {
        if (body.code !== MOCK_CODE) return reject({ status: 400, detail: 'Wrong or expired code' });
        if (stored[body.email]) { stored[body.email].verified = true; localStorage.setItem('petcare_mock_users', JSON.stringify(stored)); }
        return resolve({ access_token: `mock-token-${Date.now()}`, token_type: 'bearer', name: stored[body.email]?.name || 'Пользователь' });
      }
      if (path === '/user/verify/resend') return resolve(null);
      return reject({ status: 404, detail: 'Not found' });
    }, 450));
  }

  function request(path, options) { return USE_MOCK_API ? mockApi(path, options) : api(path, options); }

  function errorText(error) {
    if (Array.isArray(error.detail)) return 'Проверьте заполнение полей.';
    const known = { 'Email already registered': 'Этот email уже зарегистрирован.', 'Email not verified': 'Email ещё не подтверждён.', 'Invalid credentials': 'Неверный email или пароль.', 'Wrong or expired code': 'Код неверный или истёк.' };
    return known[error.detail] || error.detail || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }

  function openVerification(email) {
    emailForVerification = email; elements.verifyEmail.textContent = email; elements.authView.classList.add('is-hidden'); elements.verifyView.classList.remove('is-hidden'); elements.code.focus();
  }

  function finishAuth(token, name) {
    localStorage.setItem('petcare_access_token', token); elements.authView.classList.add('is-hidden'); elements.verifyView.classList.add('is-hidden'); elements.successView.classList.remove('is-hidden'); elements.successText.textContent = `Добро пожаловать${name ? `, ${name}` : ''}! Вы успешно вошли в PetCare.`;
  }

  elements.authForm.addEventListener('submit', async (event) => {
    event.preventDefault(); clearMessage(elements.message); if (!validateAuth()) return;
    setBusy(elements.submit, true, mode === 'register' ? 'Регистрация…' : 'Вход…');
    try {
      const email = elements.email.value.trim().toLowerCase();
      if (mode === 'register') { await request('/user/add', { method: 'POST', body: { email, passwd: elements.password.value, name: elements.name.value.trim() } }); openVerification(email); showMessage(elements.verifyMessage, 'Код подтверждения отправлен на вашу почту.', 'success'); }
      else { const result = await request('/user/login', { method: 'POST', body: { email, passwd: elements.password.value } }); finishAuth(result.access_token, result.name); }
    } catch (error) { if (error.status === 403 && error.detail === 'Email not verified') { openVerification(elements.email.value.trim().toLowerCase()); showMessage(elements.verifyMessage, 'Подтвердите email кодом из письма.'); } else showMessage(elements.message, errorText(error)); }
    finally { setBusy(elements.submit, false); }
  });

  elements.verifyForm.addEventListener('submit', async (event) => {
    event.preventDefault(); clearMessage(elements.verifyMessage); setFieldError('code');
    if (!/^\d{6}$/.test(elements.code.value.trim())) { setFieldError('code', 'Введите 6 цифр.'); return; }
    setBusy($('#verify-button'), true, 'Проверка…');
    try { const result = await request('/user/verify', { method: 'POST', body: { email: emailForVerification, code: elements.code.value.trim() } }); finishAuth(result.access_token, result.name); }
    catch (error) { showMessage(elements.verifyMessage, errorText(error)); }
    finally { setBusy($('#verify-button'), false); }
  });

  elements.resend.addEventListener('click', async () => { elements.resend.disabled = true; elements.resendStatus.textContent = 'Отправляем код…'; try { await request('/user/verify/resend', { method: 'POST', body: { email: emailForVerification } }); let seconds = 60; elements.resendStatus.textContent = `Если адрес зарегистрирован, код отправлен. Повторить через ${seconds} с.`; resendTimer = setInterval(() => { seconds -= 1; elements.resendStatus.textContent = seconds ? `Повторить через ${seconds} с.` : 'Можно отправить код ещё раз.'; if (!seconds) { clearInterval(resendTimer); elements.resend.disabled = false; } }, 1000); } catch (error) { elements.resendStatus.textContent = errorText(error); elements.resend.disabled = false; } });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  $('.password-toggle').addEventListener('click', (event) => { const visible = elements.password.type === 'text'; elements.password.type = visible ? 'password' : 'text'; event.currentTarget.textContent = visible ? 'Показать' : 'Скрыть'; event.currentTarget.setAttribute('aria-label', visible ? 'Показать пароль' : 'Скрыть пароль'); });
  $('#back-to-auth').addEventListener('click', () => { elements.verifyView.classList.add('is-hidden'); elements.authView.classList.remove('is-hidden'); });
  $('#logout-button').addEventListener('click', () => { localStorage.removeItem('petcare_access_token'); elements.successView.classList.add('is-hidden'); elements.authView.classList.remove('is-hidden'); });
  $('#forgot-link').addEventListener('click', () => showMessage(elements.message, 'Восстановление пароля будет доступно после подключения бэкенда.', 'success'));
  elements.code.addEventListener('input', () => { elements.code.value = elements.code.value.replace(/\D/g, '').slice(0, 6); });
  setMode('login');
})();