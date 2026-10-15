'use strict';
const form = document.getElementById('appeal-form'), errorBox = document.getElementById('appeal-error'), card = document.getElementById('appeal-card');
form.addEventListener('submit', async e => {
  e.preventDefault();
  errorBox.textContent = '';
  const button = form.querySelector('button[type=submit]');
  const payload = { email: form.email.value.trim(), subject: form.subject.value.trim(), message: form.message.value.trim() };
  if (!payload.email || !payload.message) { errorBox.textContent = 'E-posta ve açıklama alanlarını doldur.'; return; }
  button.disabled = true;
  try {
    const r = await fetch('/api/support/appeal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Talep gönderilemedi. Lütfen tekrar dene.');
    card.classList.add('done');
    form.reset();
  } catch (er) {
    errorBox.textContent = er.message;
  } finally {
    button.disabled = false;
  }
});
