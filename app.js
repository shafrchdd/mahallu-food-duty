// @ts-nocheck


const AREAS = [
  'തോട്ടുങ്ങൽ പള്ളിയാൽ',
  'പള്ളിക്കുന്ന്',
  'ഒടുവങ്കാട്',
  'കുറ്റിപ്പുളി',
  'മന്തോണിക്കുന്ന്',
  'നീലാണ്ടൻക്കുന്ന്',
  'മരുതംപാറ',
];
const MEALS = [
  { id: 'morning', label: 'രാവിലെ' },
  { id: 'noon', label: 'ഉച്ചയ്ക്ക്' },
  { id: 'night', label: 'രാത്രി' },
];
const KEY = 'mahallu_food_duty_pwa_v1';
const $ = id => document.getElementById(id);
const today = () => dateString(new Date());
function dateString(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}
function parseDate(s) {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
}
function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateString(d);
}
function diffDays(a, b) {
  const x = parseDate(a),
    y = parseDate(b);
  return Math.round(
    (Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) -
      Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) /
      86400000
  );
}
function pretty(s) {
  return parseDate(s).toLocaleDateString('ml-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
}
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}
const freshState = () => ({
  people: [],
  days: {},
  rotation: { startDate: today(), startPersonId: '', swap: null },
  order: 1,
});
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && Array.isArray(v.people) && v.days && v.rotation
      ? v
      : freshState();
  } catch {
    return freshState();
  }
}
let state = load(),
  historyPage = 1,
  modalDate = null,
  toastTimer = null;
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function ordered() {
  return [...state.people].sort(
    (a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.order - b.order
  );
}
function findPerson(id) {
  return state.people.find(p => p.id === id) || null;
}
function serial(id) {
  return ordered().findIndex(p => p.id === id) + 1;
}
function snapshot(p) {
  return p
    ? { id: p.id, name: p.name, phone: p.phone || '', area: p.area }
    : null;
}
function rotationInfo(date) {
  const list = ordered(),
    n = list.length;
  if (!n) return { n: 0, loop: 0, slot: 0, sequence: [] };
  let start = Math.max(
    0,
    list.findIndex(p => p.id === state.rotation.startPersonId)
  );
  const sequence = [...list.slice(start), ...list.slice(0, start)];
  const offset = diffDays(state.rotation.startDate, date);
  return {
    n,
    loop: Math.floor(offset / n),
    slot: ((offset % n) + n) % n,
    sequence,
  };
}
function autoPerson(date) {
  const info = rotationInfo(date);
  if (!info.n) return null;
  const seq = [...info.sequence],
    sw = state.rotation.swap;
  if (sw && sw.loop === info.loop) {
    const a = seq.findIndex(p => p.id === sw.a),
      b = seq.findIndex(p => p.id === sw.b);
    if (a >= 0 && b >= 0) {
      const temp = seq[a];
      seq[a] = seq[b];
      seq[b] = temp;
    }
  }
  return seq[info.slot] || null;
}
function hasFood(d) {
  return Object.values(d.meals || {}).some(Boolean);
}
function day(date) {
  let d = state.days[date];
  if (!d) {
    d = {
      personId: null,
      personSnapshot: null,
      manual: false,
      callStatus: 'pending',
      activeMeals: ['morning', 'noon', 'night'],
      meals: {},
    };
    state.days[date] = d;
  }
  if (!Array.isArray(d.activeMeals))
    d.activeMeals = ['morning', 'noon', 'night'];
  if (!d.meals) d.meals = {};
  if (
    date >= today() &&
    !d.manual &&
    d.callStatus !== 'confirmed' &&
    !hasFood(d)
  ) {
    const p = autoPerson(date);
    d.personId = p ? p.id : null;
    d.personSnapshot = snapshot(p);
  }
  if (d.personId) {
    const p = findPerson(d.personId);
    if (p && date >= today() && !d.manual) d.personSnapshot = snapshot(p);
  }
  return d;
}
function selectedPerson(d) {
  return findPerson(d.personId) || d.personSnapshot || null;
}
function refreshUpcoming() {
  for (
    let i = 0;
    i <= Math.min(500, Math.max(2, state.people.length * 2));
    i++
  ) {
    const date = addDays(today(), i),
      d = state.days[date];
    if (!d || d.manual || d.callStatus === 'confirmed' || hasFood(d)) continue;
    const p = autoPerson(date);
    d.personId = p ? p.id : null;
    d.personSnapshot = snapshot(p);
  }
}
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
function setDayPerson(date, p) {
  const d = day(date);
  d.personId = p.id;
  d.personSnapshot = snapshot(p);
  d.manual = true;
  d.callStatus = 'pending';
  d.meals = {};
  save();
  renderSchedule();
  renderHistoryIfOpen();
  toast('ഈ ദിവസത്തേക്ക് വ്യക്തിയെ മാറ്റി.');
}
function renderDay(date, index) {
  const d = day(date),
    p = selectedPerson(d),
    labels = ['ഇന്ന്', 'നാളെ', 'മറ്റന്നാൾ'],
    required = d.activeMeals.length,
    got = d.activeMeals.filter(id => d.meals[id]).length;
  const call =
    d.callStatus === 'confirmed'
      ? '<span class="call-status yes">വിളിച്ച് ഉറപ്പിച്ചു ✓</span>'
      : d.callStatus === 'notconfirmed'
        ? '<span class="call-status no">ഉറപ്പായില്ല</span>'
        : '<span class="call-status">വിളിക്കാനുണ്ട്</span>';
  const meals = MEALS.map(m => {
    const active = d.activeMeals.includes(m.id);
    return (
      '<div class="meal-box ' +
      (active ? '' : 'disabled') +
      '"><div class="meal-title">' +
      m.label +
      '</div>' +
      (index === 0
        ? active
          ? '<label class="meal-check"><input type="checkbox" data-meal-date="' +
            date +
            '" data-meal="' +
            m.id +
            '" ' +
            (d.meals[m.id] ? 'checked' : '') +
            '> ലഭിച്ചു</label>'
          : '<div class="meal-check">വേണ്ട</div>'
        : '<div class="meal-check">' + (active ? ' ' : 'വേണ്ട') + '</div>') +
      '</div>'
    );
  }).join('');
  const config = MEALS.map(
    m =>
      '<label class="meal-setting"><input type="checkbox" data-active-date="' +
      date +
      '" data-active="' +
      m.id +
      '" ' +
      (d.activeMeals.includes(m.id) ? 'checked' : '') +
      '> ' +
      m.label +
      '</label>'
  ).join('');
  return (
    '<article class="day-card day-' + index + ' ' +
    (index === 0 ? 'today' : '') +
    '"><div class="day-header"><div><div class="day-title">' +
    labels[index] +
    '</div><div class="day-date">' +
    pretty(date) +
    '</div></div>' +
    (index === 2
      ? '<span class="day-badge">2 ദിവസം മുമ്പ് വിളിക്കുക</span>'
      : d.manual
        ? '<span class="day-badge">മാനുവൽ മാറ്റം</span>'
        : '') +
    '</div>' +
    (p
      ? '<div class="person-block"><div class="person-main"><h3>' +
        esc(p.name) +
        '</h3><p>' +
        esc(p.area || 'ഏരിയ ലഭ്യമല്ല') +
        '</p><div class="phone-line">' +
        esc(p.phone || 'ഫോൺ ചേർത്തിട്ടില്ല') +
        '</div></div><span class="serial">#' +
        (serial(p.id) || '–') +
        '</span></div>'
      : '<div class="empty-state">ആളുകളെ ആദ്യം ചേർക്കുക</div>') +
    '<div class="day-summary">' +
    call +
    (index === 0 ? '<span class="meal-count">' + got + '/' + required + ' ഭക്ഷണം ലഭിച്ചു</span>' : '') +
    '</div>' +
    '<div class="action-row call-row">' +
    (p && p.phone
      ? '<a class="btn primary" style="flex:1" href="tel:' +
        encodeURIComponent(p.phone) +
        '">📞 വിളിക്കുക</a>'
      : '<button class="btn primary" style="flex:1" disabled>📞 വിളിക്കുക</button>') +
    '<button class="btn light" data-change="' +
    date +
    '">മാറ്റുക</button></div>' +
    '<div class="action-row"><button class="btn soft" data-confirm="' +
    date +
    '">ഉറപ്പിച്ചു ✓</button><button class="btn light" data-decline="' +
    date +
    '">ഉറപ്പായില്ല</button></div>' +
    '<div class="meal-grid">' +
    meals +
    '</div><details class="meal-settings"><summary>ഈ ദിവസത്തെ ഭക്ഷണ സമയം മാറ്റുക</summary><div class="meal-setting-row">' +
    config +
    '</div></details></article>'
  );
}
function populatePersonSelect(el, all) {
  const old = el.value,
    list = ordered();
  el.innerHTML =
    (all ? '<option value="">എല്ലാവരും</option>' : '') +
    list
      .map(
        (p, i) =>
          '<option value="' +
          esc(p.id) +
          '">#' +
          (i + 1) +
          ' · ' +
          esc(p.name) +
          ' — ' +
          esc(p.area) +
          '</option>'
      )
      .join('');
  if ([...el.options].some(o => o.value === old)) el.value = old;
}
function renderRotation() {
  const list = ordered();
  ['startPerson', 'swapA', 'swapB'].forEach(id => {
    const el = $(id),
      old = el.value;
    populatePersonSelect(el, false);
    if ([...el.options].some(o => o.value === old)) el.value = old;
  });
  if (list.length && !state.rotation.startPersonId)
    state.rotation.startPersonId = list[0].id;
  if (
    state.rotation.startPersonId &&
    [...$('startPerson').options].some(
      o => o.value === state.rotation.startPersonId
    )
  )
    $('startPerson').value = state.rotation.startPersonId;
  $('startDate').value = state.rotation.startDate || today();
  const info = rotationInfo(today()),
    end = info.n
      ? addDays(state.rotation.startDate, (info.loop + 1) * info.n - 1)
      : '';
  $('swapStatus').textContent =
    state.rotation.swap && state.rotation.swap.loop === info.loop
      ? 'ഈ ലൂപ്പിലെ താൽക്കാലിക മാറ്റം സജീവമാണ്. അടുത്ത ലൂപ്പ് ' +
        pretty(addDays(end, 1)) +
        ' ന് പഴയ ക്രമത്തിൽ തുടങ്ങും.'
      : 'ഇപ്പോൾ താൽക്കാലിക മാറ്റമില്ല.' +
        (info.n ? ' നിലവിലെ ലൂപ്പ് ' + pretty(end) + ' ന് അവസാനിക്കും.' : '');
  $('totalPeopleBadge').textContent = list.length + ' പേർ';
}
function renderSchedule() {
  $('todayLabel').textContent = pretty(today());
  $('dayCards').innerHTML = [0, 1, 2]
    .map(i => renderDay(addDays(today(), i), i))
    .join('');
  $('dayCards')
    .querySelectorAll('[data-change]')
    .forEach(b => (b.onclick = () => openPicker(b.dataset.change)));
  $('dayCards')
    .querySelectorAll('[data-confirm]')
    .forEach(
      b =>
        (b.onclick = () => {
          const d = day(b.dataset.confirm);
          d.callStatus = 'confirmed';
          d.callAt = new Date().toISOString();
          save();
          renderSchedule();
          toast('വിളി സ്ഥിരീകരിച്ചു.');
        })
    );
  $('dayCards')
    .querySelectorAll('[data-decline]')
    .forEach(
      b =>
        (b.onclick = () => {
          const d = day(b.dataset.decline);
          d.callStatus = 'notconfirmed';
          d.callAt = new Date().toISOString();
          save();
          renderSchedule();
          toast('സ്ഥിരീകരണം ലഭിച്ചിട്ടില്ല എന്ന് രേഖപ്പെടുത്തി.');
        })
    );
  $('dayCards')
    .querySelectorAll('[data-meal-date]')
    .forEach(
      b =>
        (b.onchange = () => {
          const d = day(b.dataset.mealDate);
          d.meals[b.dataset.meal] = b.checked;
          save();
          renderSchedule();
          renderHistoryIfOpen();
        })
    );
  $('dayCards')
    .querySelectorAll('[data-active-date]')
    .forEach(
      b =>
        (b.onchange = () => {
          const d = day(b.dataset.activeDate),
            id = b.dataset.active;
          d.activeMeals = b.checked
            ? [...new Set([...d.activeMeals, id])]
            : d.activeMeals.filter(x => x !== id);
          if (!b.checked) delete d.meals[id];
          save();
          renderSchedule();
          renderHistoryIfOpen();
        })
    );
  renderRotation();
  save();
}
function renderPeople() {
  const list = ordered(),
    q = $('peopleSearch').value.trim().toLowerCase();
  $('peopleCount').textContent = list.length + ' പേർ';
  $('personArea').innerHTML = AREAS.map(
    a => '<option value="' + esc(a) + '">' + esc(a) + '</option>'
  ).join('');
  let index = 0,
    out = '';
  AREAS.forEach(area => {
    const group = list.filter(
      p =>
        p.area === area &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q))
    );
    if (q && !group.length) return;
    out +=
      '<section class="area-group"><div class="area-heading"><span>' +
      esc(area) +
      '</span><span>' +
      group.length +
      ' പേർ</span></div>';
    if (!group.length)
      out += '<div class="empty-state">ആളുകളെ ചേർത്തിട്ടില്ല</div>';
    group.forEach(p => {
      index++;
      out +=
        '<div class="person-row"><span class="person-number">' +
        serial(p.id) +
        '</span><div class="person-info"><b>' +
        esc(p.name) +
        '</b><small>' +
        esc(p.phone || 'ഫോൺ ഇല്ല') +
        '</small></div><button class="mini-action" data-edit="' +
        esc(p.id) +
        '">തിരുത്തുക</button><button class="mini-action delete" data-remove="' +
        esc(p.id) +
        '">×</button></div>';
    });
    out += '</section>';
  });
  $('peopleList').innerHTML =
    out || '<div class="empty-state">ആളുകളെ കണ്ടെത്തിയില്ല.</div>';
  $('peopleList')
    .querySelectorAll('[data-edit]')
    .forEach(b => (b.onclick = () => editPerson(b.dataset.edit)));
  $('peopleList')
    .querySelectorAll('[data-remove]')
    .forEach(b => (b.onclick = () => removePerson(b.dataset.remove)));
  renderRotation();
  renderHistoryOptions();
}
function renderHistoryOptions() {
  populatePersonSelect($('historyPerson'), true);
}
function allHistory() {
  const filter = $('historyPerson').value,
    from = $('historyFrom').value,
    to = $('historyTo').value;
  Object.keys(state.days)
    .filter(d => d <= today())
    .forEach(d => day(d));
  return Object.keys(state.days)
    .filter(
      date => date <= today() && (!from || date >= from) && (!to || date <= to)
    )
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      d: state.days[date],
      p: selectedPerson(state.days[date]),
    }))
    .filter(x => x.p && (!filter || x.p.id === filter));
}
function renderHistory() {
  const rows = allHistory(),
    pages = Math.max(1, Math.ceil(rows.length / 15));
  historyPage = Math.min(historyPage, pages);
  const slice = rows.slice((historyPage - 1) * 15, historyPage * 15);
  $('historyRows').innerHTML = slice.length
    ? slice
        .map(({ date, d, p }) => {
          const tags = MEALS.map(m =>
            !d.activeMeals.includes(m.id)
              ? '<span class="tag">' + m.label + ' വേണ്ട</span>'
              : '<span class="tag ' +
                (d.meals[m.id] ? 'yes' : 'no') +
                '">' +
                (d.meals[m.id] ? '✓' : '○') +
                ' ' +
                m.label +
                '</span>'
          ).join('');
          const call =
            d.callStatus === 'confirmed'
              ? 'വിളിച്ച് ഉറപ്പിച്ചു'
              : d.callStatus === 'notconfirmed'
                ? 'ഉറപ്പായില്ല'
                : 'വിളിക്കാനുണ്ട്';
          return (
            '<article class="history-row"><div class="history-row-head"><div><b>' +
            esc(p.name) +
            '</b><div class="hint">' +
            esc(p.area || '') +
            ' · ' +
            esc(p.phone || '') +
            '</div></div><small>' +
            pretty(date) +
            '</small></div><div class="tag-list">' +
            tags +
            '<span class="tag">' +
            call +
            '</span>' +
            (d.manual ? '<span class="tag">മാനുവൽ മാറ്റം</span>' : '') +
            '</div></article>'
          );
        })
        .join('')
    : '<div class="empty-state">ചരിത്രം ലഭ്യമല്ല. ആളുകളെ ചേർത്ത് ദിവസേന വിവരങ്ങൾ രേഖപ്പെടുത്തുക.</div>';
  $('pageInfo').textContent =
    'പേജ് ' + historyPage + '/' + pages + ' · ' + rows.length + ' ദിവസങ്ങൾ';
  $('prevPage').disabled = historyPage <= 1;
  $('nextPage').disabled = historyPage >= pages;
}
function renderHistoryIfOpen() {
  if ($('historyPage').classList.contains('active')) renderHistory();
}
function openPicker(date) {
  modalDate = date;
  $('modalTitle').textContent = pretty(date) + ' — വ്യക്തിയെ തിരഞ്ഞെടുക്കുക';
  $('personSearch').value = '';
  renderChoices();
  $('personModal').classList.remove('hidden');
}
function renderChoices() {
  const q = $('personSearch').value.trim().toLowerCase(),
    list = ordered().filter(
      p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q)
    );
  $('personChoices').innerHTML = list.length
    ? list
        .map(
          p =>
            '<button class="choice-row" data-pick="' +
            esc(p.id) +
            '"><span><b>' +
            esc(p.name) +
            '</b><small>' +
            esc(p.area) +
            ' · ' +
            esc(p.phone || 'ഫോൺ ഇല്ല') +
            '</small></span><span class="serial">#' +
            serial(p.id) +
            '</span></button>'
        )
        .join('')
    : '<div class="empty-state">വ്യക്തിയെ കണ്ടെത്തിയില്ല.</div>';
  $('personChoices')
    .querySelectorAll('[data-pick]')
    .forEach(
      b =>
        (b.onclick = () => {
          const p = findPerson(b.dataset.pick);
          if (p) {
            setDayPerson(modalDate, p);
            $('personModal').classList.add('hidden');
          }
        })
    );
}
function refreshAll() {
  renderPeople();
  renderSchedule();
  renderHistoryOptions();
  renderHistoryIfOpen();
}
let activeRecognition = null;
function startVoiceInput(targetId, button) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast('ഈ ബ്രൗസറിൽ voice typing ലഭ്യമല്ല. Chrome ഉപയോഗിക്കുക.');
    return;
  }
  if (activeRecognition) {
    activeRecognition.stop();
    activeRecognition = null;
  }
  const input = $(targetId);
  const language = $('voiceLanguage')?.value || 'ml-IN';
  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  recognition.lang = language;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  button.classList.add('listening');
  button.textContent = '⏺';
  $('voiceHint').textContent = targetId === 'personName'
    ? 'കേൾക്കുന്നു… പേര് വ്യക്തമായി പറയുക.'
    : 'കേൾക്കുന്നു… ഫോൺ നമ്പറിലെ അക്കങ്ങൾ ഓരോന്നായി പറയുക.';
  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript.trim();
    if (targetId === 'personPhone') {
      const digits = transcript.replace(/[^0-9+]/g, '');
      input.value = digits || transcript;
    } else {
      input.value = transcript;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  recognition.onerror = event => {
    $('voiceHint').textContent = event.error === 'not-allowed'
      ? 'മൈക്ക് അനുമതി അനുവദിക്കുക.'
      : 'ശബ്ദം തിരിച്ചറിയാനായില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.';
  };
  recognition.onend = () => {
    button.classList.remove('listening');
    button.textContent = '🎙️';
    if (activeRecognition === recognition) activeRecognition = null;
    if (!$('voiceHint').textContent.includes('അനുമതി') &&
        !$('voiceHint').textContent.includes('തിരിച്ചറിയാനായില്ല')) {
      $('voiceHint').textContent = 'ശബ്ദം ചേർത്തു. ശരിയാണെന്ന് പരിശോധിച്ച് വ്യക്തിയെ ചേർക്കുക.';
    }
  };
  try {
    recognition.start();
  } catch {
    button.classList.remove('listening');
    button.textContent = '🎙️';
    activeRecognition = null;
    toast('മൈക്ക് ആരംഭിക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.');
  }
}
document.querySelectorAll('[data-voice-target]').forEach(button => {
  button.addEventListener('click', () => startVoiceInput(button.dataset.voiceTarget, button));
});

function addPerson(name, phone, area) {
  const p = { id: uid(), name, phone, area, order: state.order++ };
  state.people.push(p);
  if (!state.rotation.startPersonId) state.rotation.startPersonId = p.id;
  refreshUpcoming();
  save();
  refreshAll();
  toast('വ്യക്തിയെ ചേർത്തു.');
}
function removePerson(id) {
  const p = findPerson(id);
  if (
    !p ||
    !confirm(
      p.name + ' നെ സജീവ പട്ടികയിൽ നിന്ന് നീക്കണോ? പഴയ ചരിത്രത്തിൽ പേര് തുടരും.'
    )
  )
    return;
  state.people = state.people.filter(x => x.id !== id);
  if (state.rotation.startPersonId === id)
    state.rotation.startPersonId = ordered()[0]?.id || '';
  if (
    state.rotation.swap &&
    (state.rotation.swap.a === id || state.rotation.swap.b === id)
  )
    state.rotation.swap = null;
  refreshUpcoming();
  save();
  refreshAll();
  toast('വ്യക്തിയെ നീക്കി.');
}
function editPerson(id) {
  const p = findPerson(id);
  if (!p) return;
  const name = prompt('പേര് തിരുത്തുക', p.name);
  if (name === null) return;
  const phone = prompt('ഫോൺ നമ്പർ തിരുത്തുക', p.phone || '');
  if (phone === null) return;
  const areaNo = prompt('ഏരിയ നമ്പർ (1–7)', String(AREAS.indexOf(p.area) + 1));
  if (areaNo === null) return;
  const ai = Number(areaNo) - 1;
  if (!name.trim() || !Number.isInteger(ai) || ai < 0 || ai >= AREAS.length) {
    alert('പേരോ ഏരിയയോ ശരിയല്ല.');
    return;
  }
  p.name = name.trim();
  p.phone = phone.trim();
  p.area = AREAS[ai];
  refreshUpcoming();
  save();
  refreshAll();
  toast('വിവരങ്ങൾ പുതുക്കി.');
}
function switchPage(id) {
  document
    .querySelectorAll('.page')
    .forEach(p => p.classList.toggle('active', p.id === id));
  document
    .querySelectorAll('.nav-item')
    .forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'peoplePage') renderPeople();
  if (id === 'historyPage') {
    renderHistoryOptions();
    historyPage = 1;
    renderHistory();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function download(content, name, type) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv() {
  const rows = [
    [
      'Date',
      'Name',
      'Area',
      'Phone',
      'Call status',
      'Manual override',
      'Morning required',
      'Morning received',
      'Lunch required',
      'Lunch received',
      'Dinner required',
      'Dinner received',
    ],
  ];
  allHistory().forEach(({ date, d, p }) =>
    rows.push([
      date,
      p.name,
      p.area,
      p.phone,
      d.callStatus,
      d.manual ? 'Yes' : 'No',
      ...MEALS.flatMap(m => [
        d.activeMeals.includes(m.id) ? 'Yes' : 'No',
        d.activeMeals.includes(m.id) && d.meals[m.id] ? 'Yes' : 'No',
      ]),
    ])
  );
  download(
    '\\ufeff' +
      rows
        .map(r =>
          r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')
        )
        .join('\\r
'),
    'mahallu-food-history.csv',
    'text/csv;charset=utf-8'
  );
}
document
  .querySelectorAll('.nav-item')
  .forEach(b => (b.onclick = () => switchPage(b.dataset.page)));
$('todayBtn').onclick = () => {
  switchPage('schedulePage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
$('personForm').onsubmit = e => {
  e.preventDefault();
  const name = $('personName').value.trim(),
    phone = $('personPhone').value.trim(),
    area = $('personArea').value;
  if (!name) {
    toast('പേര് നൽകുക.');
    return;
  }
  if (
    state.people.some(
      p => p.name.toLowerCase() === name.toLowerCase() && p.area === area
    )
  ) {
    toast('ഈ ഏരിയയിൽ ഈ പേര് നിലവിലുണ്ട്.');
    return;
  }
  addPerson(name, phone, area);
  $('personName').value = '';
  $('personPhone').value = '';
  $('personName').focus();
};
$('peopleSearch').oninput = renderPeople;
$('toggleRotation').onclick = () => {
  const panel = $('rotationPanel');
  panel.classList.toggle('hidden');
  $('toggleRotation').setAttribute(
    'aria-expanded',
    String(!panel.classList.contains('hidden'))
  );
};
$('saveStart').onclick = () => {
  const personId = $('startPerson').value,
    date = $('startDate').value;
  if (!personId || !date) {
    toast('തുടക്ക വ്യക്തിയും തീയതിയും തിരഞ്ഞെടുക്കുക.');
    return;
  }
  if (
    !confirm(
      'റൊട്ടേഷൻ തുടക്കം മാറ്റണോ? മാനുവൽ ദിവസങ്ങളും പഴയ ചരിത്രവും മാറ്റില്ല.'
    )
  )
    return;
  state.rotation.startPersonId = personId;
  state.rotation.startDate = date;
  state.rotation.swap = null;
  refreshUpcoming();
  save();
  renderSchedule();
  renderHistoryIfOpen();
  toast('റൊട്ടേഷൻ തുടക്കം മാറ്റി.');
};
$('applySwap').onclick = () => {
  const a = $('swapA').value,
    b = $('swapB').value,
    info = rotationInfo(today());
  if (!a || !b || a === b || !info.n) {
    toast('രണ്ട് വ്യത്യസ്ത വ്യക്തികളെ തിരഞ്ഞെടുക്കുക.');
    return;
  }
  const end = addDays(state.rotation.startDate, (info.loop + 1) * info.n - 1);
  if (
    !confirm(
      'ഈ ലൂപ്പിൽ മാത്രം ഇരുവരുടെയും സ്ഥാനം മാറ്റണോ? ' +
        pretty(addDays(end, 1)) +
        ' മുതൽ പഴയ ക്രമം തിരികെ വരും.'
    )
  )
    return;
  state.rotation.swap = { a, b, loop: info.loop };
  refreshUpcoming();
  save();
  renderSchedule();
  renderRotation();
  toast('ഈ ലൂപ്പിൽ മാത്രം മാറ്റം സജ്ജമാക്കി.');
};
$('clearSwap').onclick = () => {
  state.rotation.swap = null;
  refreshUpcoming();
  save();
  renderSchedule();
  renderRotation();
  toast('താൽക്കാലിക മാറ്റം ഒഴിവാക്കി.');
};
$('closeModal').onclick = () => $('personModal').classList.add('hidden');
$('personModal').onclick = e => {
  if (e.target === $('personModal')) $('personModal').classList.add('hidden');
};
$('personSearch').oninput = renderChoices;
$('historyPerson').onchange = () => {
  historyPage = 1;
  renderHistory();
};
['historyFrom', 'historyTo'].forEach(
  id =>
    ($(id).onchange = () => {
      historyPage = 1;
      renderHistory();
    })
);
$('clearFilters').onclick = () => {
  $('historyPerson').value = '';
  $('historyFrom').value = '';
  $('historyTo').value = '';
  historyPage = 1;
  renderHistory();
};
$('prevPage').onclick = () => {
  historyPage = Math.max(1, historyPage - 1);
  renderHistory();
};
$('nextPage').onclick = () => {
  historyPage++;
  renderHistory();
};
$('exportCsv').onclick = exportCsv;
$('backupBtn').onclick = () =>
  download(
    JSON.stringify(state, null, 2),
    'mahallu-food-duty-backup.json',
    'application/json'
  );
$('restoreInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.people) || !data.days || !data.rotation)
      throw new Error('invalid');
    if (!confirm('നിലവിലെ വിവരങ്ങൾ മാറ്റി ഈ ബാക്കപ്പ് ഉപയോഗിക്കണോ?')) return;
    state = data;
    save();
    refreshAll();
    toast('ബാക്കപ്പ് തിരിച്ചെടുത്തു.');
  } catch {
    alert('ഈ ബാക്കപ്പ് ഫയൽ ശരിയല്ല.');
  }
  e.target.value = '';
};
if (!state.rotation.startDate) state.rotation.startDate = today();
if (!state.rotation.startPersonId && ordered().length)
  state.rotation.startPersonId = ordered()[0].id;
[0, 1, 2].forEach(i => day(addDays(today(), i)));
save();
renderPeople();
renderSchedule();
renderHistoryOptions();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  );
}

window.MahalluApp = {
  getState: () => JSON.parse(JSON.stringify(state)),
  replaceState: next => {
    if (!next || !Array.isArray(next.people) || !next.days || !next.rotation) throw new Error('Invalid Sheet data');
    state = next;
    if (!state.rotation.startDate) state.rotation.startDate = today();
    save(); refreshAll(); renderSchedule(); renderPeople(); renderHistoryIfOpen();
  }
};
