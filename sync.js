(function () {
  // Only connection credentials are kept on this device. App records live in Google Sheets.
  const CONFIG_KEY = 'mahallu_food_duty_sheet_url';
  const ACCESS_KEY = 'mahallu_food_duty_access_key';
  let endpoint = localStorage.getItem(CONFIG_KEY) || '';
  let accessKey = localStorage.getItem(ACCESS_KEY) || '';
  let version = 0, timer = null, pollTimer = null;
  let busy = false, pending = false, ready = false, bootstrapped = false;
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
      const callback = '__mahalluRead' + Date.now() + Math.random().toString(16).slice(2);
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
  function writeRemote(appState, expectedVersion) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      const form = document.createElement('form');
      const payload = document.createElement('input');
      const requestId = 'm' + Date.now() + Math.random().toString(16).slice(2);
      frame.name = requestId; frame.hidden = true;
      form.method = 'POST'; form.action = endpoint; form.target = requestId; form.hidden = true;
      payload.name = 'payload';
      payload.value = JSON.stringify({ expectedVersion, state: appState, key: accessKey });
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
  function storeConnection(url, key) {
    endpoint = url; accessKey = key;
    localStorage.setItem(CONFIG_KEY, endpoint);
    localStorage.setItem(ACCESS_KEY, accessKey);
  }
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(pollRemote, 4000);
  }
  async function connect(loadFromSheet) {
    const url = $('sheetUrl').value.trim();
    const key = $('sheetAccessKey').value.trim();
    if (!validUrl(url)) { status('ശരിയായ Apps Script /exec URL നൽകുക.', 'error'); return; }
    if (!key) { status('Shared Access Key നൽകുക.', 'error'); return; }
    storeConnection(url, key);
    status('Google Sheet ബന്ധിപ്പിക്കുന്നു…');
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok) throw new Error(remote && remote.error || 'Sheet വായിക്കാൻ കഴിഞ്ഞില്ല.');
      if (remote.exists && remote.state) {
        if (loadFromSheet) {
          pending = false; ready = false;
          window.MahalluApp.replaceState(remote.state);
          version = Number(remote.version) || 0;
          pending = false; ready = true; bootstrapped = true;
          status('Google Sheet-ലെ ഏറ്റവും പുതിയ ഡാറ്റ ലഭിച്ചു ✓', 'ok');
          startPolling();
        }
      } else {
        status('Google Sheet ഇപ്പോൾ ഒഴിഞ്ഞതാണ്. പഴയ ഫോണിലെ ഡാറ്റ ഒരിക്കൽ മാത്രം മാറ്റാൻ “ആദ്യ ഡാറ്റ മാറ്റുക” അമർത്തുക.', 'warn');
      }
    } catch (err) { status(err.message || 'Sync പരാജയപ്പെട്ടു.', 'error'); }
  }
  async function migrateOnce() {
    const url = $('sheetUrl').value.trim();
    const key = $('sheetAccessKey').value.trim();
    if (!validUrl(url) || !key) { status('ശരിയായ Sheet URL-വും Access Key-യും നൽകുക.', 'error'); return; }
    storeConnection(url, key);
    status('ആദ്യ ഡാറ്റ Google Sheet-ലേക്ക് മാറ്റുന്നു…');
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok) throw new Error(remote && remote.error || 'Sheet പരിശോധിക്കാൻ കഴിഞ്ഞില്ല.');
      if (remote.exists && remote.state) {
        pending = false; ready = false;
        window.MahalluApp.replaceState(remote.state);
        version = Number(remote.version) || 0;
        pending = false; ready = true; bootstrapped = true;
        status('Sheet-ൽ ഡാറ്റ നേരത്തേ ഉണ്ട്. അതേ ഡാറ്റ ഉപയോഗിക്കുന്നു ✓', 'ok');
      } else {
        const result = await writeRemote(window.MahalluApp.getState(), Number(remote.version) || 0);
        if (!result || !result.ok) throw new Error(result && result.message || 'ആദ്യ ഡാറ്റ മാറ്റാൻ കഴിഞ്ഞില്ല.');
        version = Number(result.version) || 1;
        ready = true; bootstrapped = true;
        status('ആദ്യ ഡാറ്റ Google Sheet-ൽ സേവ് ചെയ്തു ✓', 'ok');
      }
      startPolling();
    } catch (err) { status(err.message || 'ആദ്യ ഡാറ്റ മാറ്റാൻ കഴിഞ്ഞില്ല.', 'error'); }
  }
  async function syncNow() {
    if (!endpoint || !ready || busy || !pending) return;
    busy = true; status('Google Sheet-ലേക്ക് സേവ് ചെയ്യുന്നു…');
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok) throw new Error('Sheet വായിക്കാൻ കഴിഞ്ഞില്ല.');
      // If another phone saved first, retry this phone's latest edit against the new version.
      if (Number(remote.version || 0) !== version) version = Number(remote.version) || 0;
      let result = await writeRemote(window.MahalluApp.getState(), version);
      if (result && result.conflict) {
        const latest = await readRemote();
        if (!latest || !latest.ok) throw new Error('പുതിയ Sheet ഡാറ്റ വായിക്കാൻ കഴിഞ്ഞില്ല.');
        version = Number(latest.version) || 0;
        result = await writeRemote(window.MahalluApp.getState(), version);
      }
      if (!result || !result.ok) throw new Error(result && result.message || 'സേവ് പരാജയപ്പെട്ടു.');
      version = Number(result.version) || version + 1;
      pending = false;
      status('Google Sheet-ൽ സേവ് ചെയ്തു ✓', 'ok');
    } catch (err) { status('Sync പ്രശ്നം: ' + (err.message || 'വീണ്ടും ശ്രമിക്കുക.'), 'error'); }
    busy = false;
    if (pending) { clearTimeout(timer); timer = setTimeout(syncNow, 1000); }
  }
  function queueSave() {
    if (!ready) return;
    pending = true; clearTimeout(timer); timer = setTimeout(syncNow, 700);
  }
  async function pollRemote() {
    if (!ready || busy || pending) return;
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok) return;
      const remoteVersion = Number(remote.version) || 0;
      if (remoteVersion > version && remote.state) {
        // Silent refresh: no confirmation dialog on any phone.
        ready = false;
        window.MahalluApp.replaceState(remote.state);
        version = remoteVersion;
        pending = false;
        ready = true;
        status('മറ്റൊരു ഫോണിലെ പുതിയ മാറ്റങ്ങൾ ലഭിച്ചു ✓', 'ok');
      }
    } catch (_) {
      status('Sheet-ുമായി ബന്ധപ്പെടാൻ കഴിയുന്നില്ല. ഇന്റർനെറ്റ് പരിശോധിക്കുക.', 'error');
    }
  }
  async function pull() {
    if (!endpoint) { status('ആദ്യം Google Sheet ബന്ധിപ്പിക്കുക.', 'error'); return; }
    try {
      const remote = await readRemote();
      if (!remote || !remote.ok || !remote.state) throw new Error('Sheet-ൽ ഡാറ്റ ലഭ്യമല്ല.');
      pending = false; ready = false;
      window.MahalluApp.replaceState(remote.state);
      version = Number(remote.version) || 0;
      pending = false; ready = true; bootstrapped = true;
      status('ഏറ്റവും പുതിയ Sheet ഡാറ്റ ലഭിച്ചു ✓', 'ok');
      startPolling();
    } catch (err) { status(err.message || 'പുതുക്കാൻ കഴിഞ്ഞില്ല.', 'error'); }
  }
  window.MahalluCloud = { queueSave, isReady: () => ready };
  window.addEventListener('load', () => {
    if ($('sheetUrl')) $('sheetUrl').value = endpoint;
    if ($('sheetAccessKey')) $('sheetAccessKey').value = accessKey;
    $('connectSheet').onclick = () => connect(true);
    $('migrateSheet').onclick = migrateOnce;
    $('pullSheet').onclick = pull;
    if (endpoint && accessKey) connect(true);
    else status('Google Sheet ബന്ധിപ്പിക്കുക. ബന്ധിപ്പിച്ച ശേഷം എല്ലാ ഫോണിലും ഒരേ ഡാറ്റ ഉപയോഗിക്കും.', 'warn');
  });
})();