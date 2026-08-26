import { createWorker } from "tesseract.js";
import { addCapture, clearCaptures, listCaptures, removeCapture, updateCapture } from "./db.js";
import { createZip } from "./zip.js";

const elements = Object.fromEntries(["camera", "camera-empty", "session-state", "next-capture", "interval-minutes", "duration-hours", "capture-size", "start-session", "stop-session", "capture-now", "reading-list", "reading-template", "reading-count", "storage-estimate", "export-zip", "delete-all", "photo-dialog", "full-photo", "close-photo"].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
let stream;
let timer;
let stopAt = 0;
let nextAt = 0;
let active = false;
let wakeLock;
let captures = [];
let worker;
let ocrBusy = false;

const formatTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
const download = (blob, name) => { const url = URL.createObjectURL(blob); const link = Object.assign(document.createElement("a"), { href: url, download: name }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const setSessionControls = () => { elements.startSession.disabled = active; elements.stopSession.disabled = !active; elements.captureNow.disabled = !active; elements.intervalMinutes.disabled = active; elements.durationHours.disabled = active; elements.captureSize.disabled = active; };

async function requestWakeLock() { if ("wakeLock" in navigator && active) { try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* iOS may not support wake locks; the visible warning remains. */ } } }
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try { await navigator.storage.persist(); } catch { /* Storage persistence is a best-effort browser feature. */ }
}
function closeStream() { stream?.getTracks().forEach((track) => track.stop()); stream = undefined; elements.camera.srcObject = null; document.querySelector(".camera-card").classList.remove("is-active"); }
async function openCamera() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } } });
  elements.camera.srcObject = stream;
  await elements.camera.play();
  document.querySelector(".camera-card").classList.add("is-active");
}
function scheduleNext() {
  clearTimeout(timer);
  if (!active) return;
  if (stopAt && Date.now() >= stopAt) { stopSession("Completed"); return; }
  const delay = Math.max(100, nextAt - Date.now());
  elements.nextCapture.textContent = `Next: ${formatTime(nextAt)}`;
  timer = setTimeout(async () => { await capturePhoto(); nextAt += Number(elements.intervalMinutes.value) * 60_000; scheduleNext(); }, delay);
}
async function startSession() {
  try {
    await openCamera();
    await requestPersistentStorage();
    active = true;
    stopAt = Number(elements.durationHours.value) ? Date.now() + Number(elements.durationHours.value) * 3_600_000 : 0;
    nextAt = Date.now();
    elements.sessionState.textContent = "Capturing";
    setSessionControls();
    await requestWakeLock();
    await capturePhoto();
    nextAt = Date.now() + Number(elements.intervalMinutes.value) * 60_000;
    scheduleNext();
  } catch (error) {
    elements.sessionState.textContent = "Camera permission needed";
    alert(`Meter Watch could not open the rear camera. ${error.message || "Allow camera access and try again."}`);
    closeStream();
  }
}
function stopSession(label = "Stopped") { active = false; clearTimeout(timer); wakeLock?.release(); wakeLock = undefined; closeStream(); elements.sessionState.textContent = label; elements.nextCapture.textContent = "No capture scheduled"; setSessionControls(); }
async function imageBlob() {
  const video = elements.camera;
  const maxWidth = Number(elements.captureSize.value);
  const ratio = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
  canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.66));
}
async function capturePhoto() {
  if (!stream) return;
  const blob = await imageBlob();
  const capture = { createdAt: Date.now(), blob, reading: "", ocr: "Reading queued for local review", ocrConfidence: 0 };
  capture.id = await addCapture(capture);
  captures.unshift(capture);
  renderCaptures();
  void readMeter(capture);
}
async function getWorker() {
  if (!worker) {
    worker = await createWorker("eng", 1, {
      workerPath: "./ocr/worker.min.js",
      corePath: "./ocr/core/",
      langPath: "./ocr/lang/",
    });
    await worker.setParameters({ tessedit_char_whitelist: "0123456789." });
  }
  return worker;
}
async function readMeter(capture) {
  if (ocrBusy) { capture.ocr = "Waiting for on-device reading"; await updateCapture(capture); renderCaptures(); return; }
  ocrBusy = true;
  try {
    const localWorker = await getWorker();
    const { data } = await localWorker.recognize(capture.blob, {}, { text: true });
    const candidate = data.text.replace(/[^0-9.]/g, "").trim();
    capture.reading = candidate;
    capture.ocrConfidence = Math.round(data.confidence || 0);
    capture.ocr = candidate ? `Local OCR: ${capture.ocrConfidence}% confidence. Confirm this value.` : "No number found. Enter the meter reading manually.";
  } catch {
    capture.ocr = "Could not read this photo. Enter the meter reading manually.";
  } finally {
    ocrBusy = false;
    await updateCapture(capture); renderCaptures();
    const queued = captures.find((item) => item.ocr === "Waiting for on-device reading");
    if (queued) void readMeter(queued);
  }
}
function renderCaptures() {
  elements.readingList.replaceChildren();
  elements.readingCount.textContent = captures.length ? `${captures.length} photo${captures.length === 1 ? "" : "s"} stored locally` : "No photos yet";
  elements.exportZip.disabled = !captures.length; elements.deleteAll.disabled = !captures.length;
  for (const capture of captures) {
    const item = elements.readingTemplate.content.firstElementChild.cloneNode(true);
    const image = item.querySelector("img"); const url = URL.createObjectURL(capture.blob);
    image.src = url; image.dataset.url = url; item.querySelector("time").textContent = formatTime(capture.createdAt);
    const input = item.querySelector("input"); input.value = capture.reading; input.addEventListener("change", async () => { capture.reading = input.value.trim(); capture.ocr = "Reviewed manually"; await updateCapture(capture); renderCaptures(); });
    item.querySelector(".ocr-status").textContent = capture.ocr;
    item.querySelector(".thumbnail-button").addEventListener("click", () => { elements.fullPhoto.src = url; elements.photoDialog.showModal(); });
    item.querySelector(".delete-reading").addEventListener("click", async () => { if (!confirm("Delete this local photo and reading?")) return; await removeCapture(capture.id); captures = captures.filter((item) => item.id !== capture.id); URL.revokeObjectURL(url); renderCaptures(); });
    elements.readingList.append(item);
  }
  updateStorageEstimate();
}
async function updateStorageEstimate() { if (!navigator.storage?.estimate) { elements.storageEstimate.textContent = "Photos stay on this iPhone. Export important sessions."; return; } const { usage = 0, quota = 0 } = await navigator.storage.estimate(); elements.storageEstimate.textContent = quota ? `${Math.round(usage / 1_048_576)} MB of ${Math.round(quota / 1_048_576)} MB local storage used. Export important sessions.` : "Photos stay on this iPhone. Export important sessions."; }
async function exportZip() {
  const rows = ["timestamp,meter_reading,ocr_confidence", ...captures.slice().reverse().map((item) => `${new Date(item.createdAt).toISOString()},${JSON.stringify(item.reading)},${item.ocrConfidence || ""}`)];
  const entries = [{ name: "meter-readings.csv", bytes: new TextEncoder().encode(rows.join("\n")) }, ...captures.map((item) => ({ name: `photos/meter-${new Date(item.createdAt).toISOString().replace(/[:.]/g, "-")}.jpg`, blob: item.blob }))];
  elements.exportZip.disabled = true; elements.exportZip.textContent = "Preparing ZIP…";
  try { download(await createZip(entries), `meter-watch-${new Date().toISOString().slice(0, 10)}.zip`); } finally { elements.exportZip.textContent = "Export ZIP"; elements.exportZip.disabled = !captures.length; }
}

elements.startSession.addEventListener("click", startSession); elements.stopSession.addEventListener("click", () => stopSession()); elements.captureNow.addEventListener("click", capturePhoto); elements.exportZip.addEventListener("click", exportZip);
elements.deleteAll.addEventListener("click", async () => { if (!confirm("Delete every local photo and reading from this iPhone? This cannot be undone.")) return; await clearCaptures(); captures = []; renderCaptures(); }); elements.closePhoto.addEventListener("click", () => elements.photoDialog.close());
document.addEventListener("visibilitychange", () => { if (!document.hidden) void requestWakeLock(); });
window.addEventListener("beforeunload", () => stopSession());
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
captures = await listCaptures(); captures.sort((a, b) => b.createdAt - a.createdAt); renderCaptures(); setSessionControls();
