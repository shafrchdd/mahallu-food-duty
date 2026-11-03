(function () {
  const CONFIG_KEY = 'mahallu_food_duty_sheet_url';\n  const ACCESS_KEY = 'mahallu_food_duty_access_key';\n  let accessKey = localStorage.getItem(ACCESS_KEY) || '';
  let endpoint = localStorage.getItem(CONFIG_KEY) || '';
  let version = Number(localStorage.getItem(CONFIG_KEY + '_version') || 0);
  let timer = null, busy = false, pending = false, ready = false;
  const $ = id => document.getElementById(id);
  function status(message, kind) {
    const el = $('sheetSyncStatus');
    if (el) { el.textContent = message; el.dataset.kind = kind || ''; }
  }
  function validUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url);
  }
  function readRemote() {
    return new Promise((resolve, reject) => {
      const callback = '__mahalluRead' + Date.now();
      const script = document.createElement('script');
      const timeout = setTimeout(() => finish(new Error('സർവറിൽ നിന്ന് മറുപടി ലഭിച്ചില്ല.')), 15000);
      function finish(err, data) {
        clearTimeout(timeout); delete window[callback]; script.remove();
        err ? reject(err) : resolve(data);
      }
      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('Google Sheet ബന്ധിപ്പിക്കാൻ കഴിഞ്ഞില്ല.'));
      script.src = endpoint + '?prefix=' + callback + '&key=' + encodeURIComponent(accessKey) + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }
  function writeRemote(state) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      const form = document.createElement('form');
      const payload = document.createElement('input');
      const requestId = 'm' + Date.now() + Math.random().toString(16).slice(2);
      frame.name = requestId; frame.hidden = true;
      form.method = 'POST'; form.action = endpoint; form.target = requestId; form.hidden = true;
      payload.name = 'payload';
      payload.value = JSON.stringify({ expectedVersion: version, state: state, key: accessKey });
      form.appendChild(payload); document.body.append(frame, form);
      const timeout = setTimeout(() => finish(new Error('Sync സമയപരിധി കഴിഞ്ഞു.')), 20000);
      function finish(err, data) {
        clearTimeout(timeout); window.removeEventListener('message', onMessage);
        form.remove(); frame.remove();
        err ? reject(err) : resolve(data);
      }
      function onMessage(event) {
        if (event.source !== frame.contentWindow || !event.data || event.data.type !== 'mahallu-sheet-result') return;
        finish(null, event.data.data);
      }
      window.addEventListener('message', onMessage);
      form.submit();
    });
  }
  async function connect(migrate) {
    const url = $('sheetUrl').value.trim();
    if (!validUrl(url)) { status('ശരിയായ Apps Script /exec URL നൽകുക.', 'error'); return; }
    endpoint = url; localStorage.setItem(CONFIG_KEY, endpoint);\n    accessKey = $('sheetAccessKey').value.trim();\n    if (!accessKey) { status('Access Key നൽകുക.', 'error'); return; }\n    localStorage.setItem(ACCESS_KEY, accessKey);
    status('Google Sheet പരിശോധിക്കുന്നു…');
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok) throw new Error('Sheet വായിക്കാൻ കഴിഞ്ഞില്ല.');
      if (remote.exists && remote.state) {
        if (migrate && !confirm('Google Sheet-ൽ ഇതിനകം ഡാറ്റയുണ്ട്. അതിനെ ഈ ഫോണിലെ ഡാറ്റയാക്കി മാറ്റണോ?')) return;
        if (!migrate && !confirm('Google Sheet-ലെ ഡാറ്റ ഈ ഫോണിൽ ലോഡ് ചെയ്യണോ? ഈ ഫോണിലെ നിലവിലെ ഡാറ്റ മാറ്റിസ്ഥാപിക്കും.')) return;
        window.MahalluApp.replaceState(remote.state);
        version = remote.version || 0;
        localStorage.setItem(CONFIG_KEY + '_version', String(version));
        status('Google Sheet-ലെ ഡാറ്റ ലോഡ് ചെയ്തു ✓', 'ok');
      } else {
        if (!confirm('Sheet ഒഴിഞ്ഞിരിക്കുന്നു. ഈ ഫോണിലെ നിലവിലെ വിവരങ്ങൾ Google Sheet-ലേക്ക് മാറ്റണോ?')) return;
        const result = await writeRemote(window.MahalluApp.getState());
        if (!result || !result.ok) throw new Error(result && result.message || 'ഡാറ്റ അപ്‌ലോഡ് പരാജയപ്പെട്ടു.');
        version = result.version; localStorage.setItem(CONFIG_KEY + '_version', String(version));
        status('നിലവിലുള്ള ഡാറ്റ Google Sheet-ലേക്ക് മാറ്റി ✓', 'ok');
      }
      ready = true; localStorage.setItem(CONFIG_KEY + '_connected', '1');
    } catch (err) { status(err.message || 'Sync പരാജയപ്പെട്ടു.', 'error'); }
  }
  async function syncNow() {
    if (!endpoint || !ready || busy) return;
    busy = true; status('Sync ചെയ്യുന്നു…');
    try {
      const remote = await readRemote();
      if (!remote.ok) throw new Error('Sheet വായിക്കാൻ കഴിഞ്ഞില്ല.');
      if ((remote.version || 0) !== version) {
        if (pending) {
          status('മറ്റൊരു ഫോണിൽ മാറ്റമുണ്ട്. ഡാറ്റ സുരക്ഷയ്ക്കായി Sync നിർത്തി; “Sheet-ൽ നിന്ന് പുതുക്കുക” അമർത്തുക.', 'error');
          pending = false; busy = false; return;
        }
        window.MahalluApp.replaceState(remote.state || window.MahalluApp.getState());
        version = remote.version || 0;
        localStorage.setItem(CONFIG_KEY + '_version', String(version));
      } else {
        const result = await writeRemote(window.MahalluApp.getState());
        if (!result || !result.ok) throw new Error(result && result.message || 'Sync പരാജയപ്പെട്ടു.');
        version = result.version; localStorage.setItem(CONFIG_KEY + '_version', String(version));
      }
      pending = false; status('അവസാനം Sync ചെയ്തു ✓', 'ok');
    } catch (err) { status(err.message || 'Sync പരാജയപ്പെട്ടു.', 'error'); }
    busy = false;
  }
  function queueSave() {
    if (!ready) return;
    pending = true; clearTimeout(timer); timer = setTimeout(syncNow, 1200);
  }
  async function pull() {
    if (!endpoint) { status('ആദ്യം Google Sheet URL ബന്ധിപ്പിക്കുക.', 'error'); return; }
    try {
      const remote = await readRemote();
      if (!remote.ok || !remote.state) throw new Error('Sheet-ൽ ഡാറ്റ ലഭ്യമല്ല.');
      if (!confirm('Google Sheet-ലെ ഡാറ്റ ഈ ഫോണിലേക്ക് ലോഡ് ചെയ്യണോ?')) return;
      window.MahalluApp.replaceState(remote.state);
      version = remote.version || 0; ready = true;
      localStorage.setItem(CONFIG_KEY + '_version', String(version));
      status('Sheet-ൽ നിന്ന് പുതുക്കി ✓', 'ok');
    } catch (err) { status(err.message || 'പുതുക്കാൻ കഴിഞ്ഞില്ല.', 'error'); }
  }
  window.MahalluCloud = { queueSave };
  window.addEventListener('load', () => {
    if ($('sheetUrl')) $('sheetUrl').value = endpoint;\n    if ($('sheetAccessKey')) $('sheetAccessKey').value = accessKey;
    if (endpoint && localStorage.getItem(CONFIG_KEY + '_connected') === '1') {
      connectExisting();
    }
    $('connectSheet').onclick = () => connect(false);
    $('migrateSheet').onclick = () => connect(true);
    $('pullSheet').onclick = pull;
  });
  async function connectExisting() {
    try {
      const remote = await readRemote();
      if (remote && remote.ok) {
        version = remote.version || 0; ready = true;
        localStorage.setItem(CONFIG_KEY + '_version', String(version));
        status('Google Sheet ബന്ധിപ്പിച്ചു ✓', 'ok');
        if (remote.state && remote.version > 0) {
          window.MahalluApp.replaceState(remote.state);
        }
      }
    } catch (err) { status('Sheet ബന്ധം ലഭ്യമല്ല: ' + err.message, 'error'); }
  }
  setInterval(() => { if (ready && !pending && !busy) syncNowReadOnly(); }, 30000);
  async function syncNowReadOnly() {
    try {
      const remote = await readRemote();
      if (remote.ok && (remote.version || 0) > version) {
        if (confirm('മറ്റൊരു ഫോണിൽ പുതിയ മാറ്റങ്ങളുണ്ട്. പുതുക്കണോ?')) {
          window.MahalluApp.replaceState(remote.state);
          version = remote.version; localStorage.setItem(CONFIG_KEY + '_version', String(version));
          status('പുതിയ ഡാറ്റ ലഭിച്ചു ✓', 'ok');
        } else status('പുതിയ മാറ്റങ്ങൾ ലഭ്യമാണ്. പിന്നീട് പുതുക്കാം.', 'warn');
      }
    } catch (_) {}
  }
})();