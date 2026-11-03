# Google Sheets Sync Setup — Mahallu Food Duty

## 1. Create the Google Sheet
1. Sign in to the Google account that should own the data.
2. Create a new Google Spreadsheet.
3. Open **Extensions → Apps Script** from that spreadsheet.

## 2. Add the Apps Script backend
1. Open [Code.gs in the repository](https://github.com/shafrchdd/mahallu-food-duty/blob/main/Code.gs).
2. Copy its complete contents into the Apps Script editor, replacing the starter code.
3. Save the project.
4. In Apps Script, open **Project Settings → Script Properties → Add script property**:
   - Property: `ACCESS_KEY`
   - Value: create a long random password and keep it private. Enter the same value on every phone that should use the app.
5. Deploy the project as a Web App (steps below). Google will request permission to access the spreadsheet.

## 3. Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy**, approve the requested permissions, and copy the URL ending in `/exec`.

The app checks the shared Access Key before reading or writing the sheet. Keep the URL and key private and share them only with trusted volunteers. Anyone who has both can access the shared app data.

## 4. Connect the phones
1. Open Mahallu Food Duty.
2. Go to **ആളുകൾ → Google Sheets Sync**.
3. Paste the Web App URL and the shared Access Key.
4. On the first phone, press **ആദ്യ ഡാറ്റ മാറ്റുക** to upload the existing phone data if the sheet is empty.
5. On other phones, enter the same URL and key, press **ബന്ധിപ്പിക്കുക**, and confirm loading the Sheet data.

## Important
- Download a JSON backup before the first migration.
- Do the first migration from the phone that currently has the correct complete data.
- Other phones check for changes about every 30 seconds and can refresh when prompted.
- If two phones edit at the same time, the app detects a version conflict and asks you to refresh instead of silently overwriting newer data.
- This is a lightweight shared-data setup, not a real-time database. Avoid editing the same record simultaneously on multiple phones.
- The spreadsheet is owned by your Google account. Do not delete the `AppData` tab; it stores the app state.
