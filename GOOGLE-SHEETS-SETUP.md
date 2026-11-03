# Google Sheets Sync Setup — Mahallu Food Duty

## Your shared spreadsheet
The app is configured to use this spreadsheet:
https://docs.google.com/spreadsheets/d/1oAfB8ocXOXprf11ww8mrBdi1ND2fBttigwAl13qLjWs/edit

## 1. Add the Apps Script backend
1. Open the spreadsheet above.
2. Select **Extensions → Apps Script**.
3. Open [Code.gs in the repository](https://github.com/shafrchdd/mahallu-food-duty/blob/main/Code.gs).
4. Replace the Apps Script editor contents with the complete Code.gs source and save.
5. In Apps Script, open **Project Settings → Script Properties → Add script property**:
   - Property: `ACCESS_KEY`
   - Value: create a long random password and keep it private. Enter the same value on every phone that should use the app.

## 2. Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy**, approve the requested permissions, and copy the URL ending in `/exec`.

The backend is configured to open the spreadsheet ID above directly. The app checks the shared Access Key before reading or writing data. Keep the Web App URL and key private.

## 3. Connect the phones
1. Open Mahallu Food Duty → **ക്രമീകരണം**.
2. Paste the Web App URL and shared Access Key.
3. On the phone that currently has the correct data, download a JSON backup first, then press **ആദ്യ ഡാറ്റ മാറ്റുക** if the sheet is empty.
4. On other phones, enter the same URL and key, press **ബന്ധിപ്പിക്കുക**, and confirm loading the Sheet data.

## Backup and restore
Use **ക്രമീകരണം → ഡാറ്റ ബാക്കപ്പ്** to download a JSON backup or restore a previously downloaded backup. Keep a backup before first migration and before major changes.

## Important
- Do not delete the `AppData` tab; it stores the app state.
- Other phones check for changes about every 30 seconds.
- If two phones edit at the same time, the app detects a version conflict and asks you to refresh rather than silently overwriting newer data.
- This is a lightweight shared-data setup, not a real-time database. Avoid editing the same record simultaneously on multiple phones.
