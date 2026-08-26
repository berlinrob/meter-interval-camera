# Meter Watch

A static, iPhone-focused PWA for private interval meter photos.

## Privacy model

- Photos, OCR results, and readings are stored only in IndexedDB on the device.
- The app sends no photo, reading, or analytics data to a server.
- OCR runs in the browser through a locally bundled worker, engine, and English language model. It does not fetch OCR assets or send images to a service.
- Export creates a ZIP locally with the photos and a CSV reading table.

## iPhone operation

Use Safari over HTTPS, grant camera access, keep the app open, the iPhone unlocked, and connected to power. iOS can suspend camera access when the screen locks or the app backgrounds.

## GitHub Pages

Enable GitHub Pages using the `GitHub Actions` source after pushing the repository to GitHub. The included workflow builds and deploys the static site.

## Local development

```sh
npm install
npm run dev
```
