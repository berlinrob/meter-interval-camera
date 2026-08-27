# Meter Watch

A static, iPhone-focused PWA for private interval meter photos.

## Privacy model

- Before private sync is connected, photos, OCR results, and readings are stored only in IndexedDB on the device.
- When private sync is connected, the app uploads photos and readings only to the selected private GitHub repository. It does not send them to any other service.
- OCR runs in the browser through a locally bundled worker, engine, and English language model. It does not fetch OCR assets or send images to a service.
- Export creates a ZIP locally with the photos and a CSV reading table.

## Private GitHub sync

The public app repository and GitHub Pages URL never contain meter photos. Photos are written as individual JPEG and JSON metadata files to the private `berlinrob/Meter-Reader` repository.

Create a separate fine-grained personal access token for each device that will use the app:

1. Open GitHub **Settings**, then **Developer settings**, then **Personal access tokens**, then **Fine-grained tokens**.
2. Create a token with a clear device name, such as `Meter Watch iPhone` or `Meter Watch Mac`.
3. Set an expiration that you are comfortable renewing, such as 90 days.
4. Set resource owner to `berlinrob`, choose **Only select repositories**, and select `Meter-Reader` only.
5. Under repository permissions, set **Contents** to **Read and write**. Leave all other permissions as **No access**.
6. Copy the token once, open Meter Watch on that device, paste it into the private-sync field, and select **Connect private sync**.

The app clears the token field after connection and keeps the token only in the open browser tab's memory. It does not save the token in local storage, IndexedDB, the repository, or the deployed app. Create and revoke separate tokens per device at any time from GitHub settings.

## iPhone operation

Use Safari over HTTPS, grant camera access, keep the app open, the iPhone unlocked, and connected to power. iOS can suspend camera access when the screen locks or the app backgrounds.

## GitHub Pages

Enable GitHub Pages using the `GitHub Actions` source after pushing the repository to GitHub. The included workflow builds and deploys the static site.

## Local development

```sh
npm install
npm run dev
```
