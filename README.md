# Mahallu Food Duty

Malayalam mobile-first progressive web app for household food-duty rotation.

## Deploy with GitHub Pages

This repository is configured to publish the root directory using GitHub Actions. In GitHub, open **Settings → Pages**, set the source to **GitHub Actions**, and the workflow will publish each push to `main`.

Expected site URL: https://shafrchdd.github.io/mahallu-food-duty/

## Features
- Seven-area household/person registry
- Daily today/tomorrow/day-after rotation
- Temporary swaps and manual assignments
- Call confirmation, meal tracking and history
- CSV export and JSON backup/restore
- Malayalam/English browser voice input where supported
- Offline app shell and installable PWA

## Data
Google Sheets is the single source of truth for app records. Each device keeps only the Apps Script URL and shared access key locally; app records are loaded from the Sheet and changes are written back to it. Other connected devices silently refresh when the Sheet version changes. The PWA shell may be cached for offline loading, but app records are not persisted as a separate local database.
