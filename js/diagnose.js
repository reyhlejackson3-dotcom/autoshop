/* AVD problem checker — front end. All server text is inserted with textContent (never innerHTML). */
(() => {
  'use strict';
  const form = document.getElementById('dxForm');
  if (!form) return;
  const out = document.getElementById('dxOut');
  const note = document.getElementById('dxNote');
  const go = document.getElementById('dxGo');
  const count = document.getElementById('dxCount');
  const cfg = Object.assign({ phoneTel: '+17203832490' }, window.AVD_CONFIG || {});
  const NS = 'http://www.w3.org/2000/svg';

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const icon = (id) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ico');
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  };
  const say = (msg, kind) => { note.textContent = msg; note.className = 'form-note ' + (kind || ''); };
  const reveal = (n, i) => {
    n.classList.add('reveal');
    n.style.setProperty('--i', i || 0);
    if (window.AVD_reveal) window.AVD_reveal(n); else n.dataset.s = 'in';
  };

  form.elements.symptoms.addEventListener('input', () => { count.textContent = form.elements.symptoms.value.length; });

  const ADVICE = {
    ok_to_drive: ['banner--ok', 'i-check', 'Likely okay to drive for now', 'Still get it checked soon.'],
    drive_carefully: ['banner--care', 'i-alert', 'Drive carefully', 'This could get worse. Keep trips short until it is checked.'],
    do_not_drive: ['banner--stop', 'i-alert', 'Do not drive it', 'Some possible causes are safety issues. Call us before moving the vehicle.']
  };
  const URG = { low: 'Can wait', soon: 'Check soon', high: 'Urgent' };

  function skeleton() {
    out.replaceChildren();
    for (let i = 0; i < 5; i++) out.appendChild(el('div', 'dx__skel'));
  }

  function render(data, vehicle, symptoms) {
    out.replaceChildren();
    let i = 0;

    if (!data.is_vehicle_issue) {
      const c = el('div', 'card dx__empty');
      c.appendChild(icon('i-alert'));
      c.appendChild(el('p', null, data.summary || "That doesn't look like a vehicle problem. Describe what your vehicle is doing — a noise, a light, a smell."));
      out.appendChild(c); reveal(c, 0);
      return;
    }

    const a = ADVICE[data.drive_advice] || ADVICE.drive_carefully;
    const banner = el('div', 'dx__banner dx__' + a[0]);
    banner.appendChild(icon(a[1]));
    const bt = el('div');
    bt.appendChild(el('b', null, a[2]));
    bt.appendChild(el('p', null, data.summary || a[3]));
    banner.appendChild(bt);
    out.appendChild(banner); reveal(banner, i++);

    data.causes.forEach((c, n) => {
      const card = el('article', 'card dx__cause');
      card.dataset.fx = 'tilt';
      card.appendChild(el('div', 'dx__rank', String(n + 1)));
      const top = el('div', 'dx__top');
      top.appendChild(el('h3', null, c.title));
      top.appendChild(el('span', 'pill pill--' + c.urgency, URG[c.urgency] || URG.soon));
      card.appendChild(top);
      card.appendChild(el('p', null, c.why));
      const todo = el('p', 'do');
      todo.appendChild(el('b', null, 'Next: '));
      todo.appendChild(document.createTextNode(c.what_to_do));
      card.appendChild(todo);
      out.appendChild(card); reveal(card, i++);
    });

    if (data.questions && data.questions.length) {
      const q = el('div', 'card dx__ask');
      q.appendChild(el('b', null, 'A technician would ask'));
      const ul = el('ul');
      data.questions.forEach((t) => ul.appendChild(el('li', null, t)));
      q.appendChild(ul);
      out.appendChild(q); reveal(q, i++);
    }

    out.appendChild(el('p', 'dx__disc', 'These are possibilities based on your description, not a diagnosis. Urgency is a general guide. Please do not rely on this for safety decisions — when in doubt, call us.'));

    const cta = el('div', 'dx__cta');
    const call = el('a', 'btn', 'Call us'); call.href = 'tel:' + cfg.phoneTel;
    const smsBody = 'Hi AVD — ' + (vehicle ? vehicle + ': ' : '') + symptoms.slice(0, 300);
    const text = el('a', 'btn btn--ghost', 'Text us'); text.href = 'sms:' + cfg.phoneTel + '?&body=' + encodeURIComponent(smsBody);
    const msg = el('a', 'btn btn--ghost', 'Send a message'); msg.href = 'index.html#contact';
    msg.addEventListener('click', () => {
      try { sessionStorage.setItem('avd_prefill', JSON.stringify({ vehicle, message: symptoms })); } catch (e) { /* ignore */ }
    });
    [call, text, msg].forEach((b) => { b.dataset.fx = 'magnet'; cta.appendChild(b); });
    out.appendChild(cta); reveal(cta, i++);

    if (matchMedia('(max-width: 900px)').matches) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.website.value) return;
    const vehicle = form.elements.vehicle.value.trim();
    const symptoms = form.elements.symptoms.value.trim();
    if (symptoms.length < 8) { say('Please describe the problem in a little more detail.', 'err'); return; }
    say('');
    go.disabled = true;
    const label = go.firstChild.textContent;
    go.firstChild.textContent = 'Checking… ';
    skeleton();
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle, symptoms, website: form.elements.website.value })
      });
      let data = null;
      try { data = await res.json(); } catch (err) { /* non-JSON */ }
      if (!res.ok || !data) throw new Error((data && data.error) || 'fail');
      render(data, vehicle, symptoms);
    } catch (err) {
      out.replaceChildren();
      const c = el('div', 'card dx__empty');
      c.appendChild(icon('i-alert'));
      c.appendChild(el('p', null, err.message && err.message !== 'fail' && err.message !== 'Failed to fetch'
        ? err.message
        : "We couldn't run the check just now. Please try again, or call or text us at (720) 383-2490."));
      out.appendChild(c); reveal(c, 0);
    } finally {
      go.disabled = false;
      go.firstChild.textContent = label;
    }
  });
})();
