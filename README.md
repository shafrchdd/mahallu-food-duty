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
App data is stored locally in each browser using localStorage. It does not automatically synchronize between phones. Export JSON backups regularly.
