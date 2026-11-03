(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAd1tvf9Ug0a5EwV36r6HT7k6LhUxEaD40",
    authDomain: "gen-lang-client-0800757362.firebaseapp.com",
    projectId: "gen-lang-client-0800757362",
    storageBucket: "gen-lang-client-0800757362.firebasestorage.app",
    messagingSenderId: "391856621870",
    appId: "1:391856621870:web:b9770fe2b0163e7879d2bf"
  };
  const $ = id => document.getElementById(id);
  const status = (message, kind) => {
    const el = $('sheetSyncStatus');
    if (el) { el.textContent = message; el.dataset.kind = kind || ''; }
  };
  let db, docRef, ready = false, applyingRemote = false, saveTimer = null;
  let lastRemoteJson = '';

  async function start() {
    try {
      if (!window.firebase) throw new Error('Firebase SDK ലോഡ് ആയില്ല. ഇന്റർനെറ്റ് പരിശോധിക്കുക.');
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      await firebase.auth().signInAnonymously();
      db = firebase.firestore();
      docRef = db.collection('mahallu').doc('sharedAppData');
      const snapshot = await docRef.get();
      if (snapshot.exists && snapshot.data().state) {
        applyingRemote = true;
        window.MahalluApp.replaceState(snapshot.data().state);
        lastRemoteJson = JSON.stringify(snapshot.data().state);
        applyingRemote = false;
        ready = true;
        status('Firebase-ൽ നിന്നുള്ള ഡാറ്റ ലഭിച്ചു ✓', 'ok');
      } else {
        const initialState = window.MahalluApp.getState();
        await docRef.set({ state: initialState, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        lastRemoteJson = JSON.stringify(initialState);
        ready = true;
        status('പുതിയ Firebase ഡാറ്റാബേസ് തയ്യാറായി ✓', 'ok');
      }
      docRef.onSnapshot(snapshot => {
        if (!snapshot.exists || !snapshot.data().state) return;
        const remoteState = snapshot.data().state;
        const remoteJson = JSON.stringify(remoteState);
        if (remoteJson === lastRemoteJson) return;
        applyingRemote = true;
        window.MahalluApp.replaceState(remoteState);
        lastRemoteJson = remoteJson;
        applyingRemote = false;
        status('മറ്റൊരു ഫോണിലെ പുതിയ മാറ്റങ്ങൾ ലഭിച്ചു ✓', 'ok');
      }, error => {
        console.error('Firestore listener:', error);
        status('Firebase sync പിശക്: ' + (error.message || 'വീണ്ടും ശ്രമിക്കുക.'), 'error');
      });
    } catch (error) {
      console.error('Firebase setup:', error);
      status('Firebase ബന്ധിപ്പിക്കാൻ കഴിഞ്ഞില്ല: ' + (error.message || 'ക്രമീകരണം പരിശോധിക്കുക.'), 'error');
    }
  }
  function queueSave() {
    if (!ready || applyingRemote) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const state = window.MahalluApp.getState();
        const json = JSON.stringify(state);
        if (json === lastRemoteJson) return;
        await docRef.set({ state, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        lastRemoteJson = json;
        status('Firebase-ൽ സേവ് ചെയ്തു ✓', 'ok');
      } catch (error) {
        console.error('Firebase save:', error);
        status('ഡാറ്റ സേവ് ചെയ്തില്ല: ' + (error.message || 'വീണ്ടും ശ്രമിക്കുക.'), 'error');
      }
    }, 600);
  }
  window.MahalluCloud = { queueSave, isReady: () => ready };
  window.addEventListener('load', start);
})();