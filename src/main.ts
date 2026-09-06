import "./style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import worldFallback from "./world-fallback.svg";
import type { LatLng, LeafletMouseEvent, Marker } from "leaflet";

const map = L.map("map", { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 2);

L.imageOverlay(worldFallback, [[-90, -180], [90, 180]], { opacity: 1, interactive: false }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const selectionTitle = document.querySelector<HTMLElement>("#selection-title")!;
const latitude = document.querySelector<HTMLElement>("#latitude")!;
const longitude = document.querySelector<HTMLElement>("#longitude")!;
const commandOutput = document.querySelector<HTMLElement>("#command-output code")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy-button")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button")!;
const copyStatus = document.querySelector<HTMLElement>("#copy-status")!;
const statusText = document.querySelector<HTMLElement>("#status-text")!;
const statusDot = document.querySelector<HTMLElement>("#status-dot")!;
const deviceSelect = document.querySelector<HTMLSelectElement>("#device-select")!;
const refreshDevices = document.querySelector<HTMLButtonElement>("#refresh-devices")!;
const startButton = document.querySelector<HTMLButtonElement>("#start-button")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop-button")!;
const deviceStatus = document.querySelector<HTMLElement>("#device-status")!;

let marker: Marker | null = null;
let selectedCommand = "";
let selectedDevice = "";
let bridgeAvailable = false;

type BridgeMessage = { event: string; state?: string; message?: string; detail?: string; devices?: Array<{id: string; name: string}>; resetUncertain?: boolean };
const bridge = (window as Window & { webkit?: { messageHandlers?: { bridge?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.bridge;
function sendBridge(value: unknown) { bridge?.postMessage(value); }
function setStatus(state: string, message: string) {
  statusText.textContent = message;
  statusDot.dataset.state = state;
  startButton.disabled = !selectedCommand || !selectedDevice || state === "starting" || state === "active" || !bridgeAvailable;
  stopButton.disabled = state !== "active" && state !== "starting";
}
function renderDevices(devices: Array<{id:string; name:string}>) {
  deviceSelect.replaceChildren();
  if (!devices.length) { deviceSelect.add(new Option("Kein Gerät gefunden", "")); selectedDevice = ""; }
  devices.forEach((device) => deviceSelect.add(new Option(device.name, device.id)));
  selectedDevice = deviceSelect.value;
  startButton.disabled = !selectedCommand || !selectedDevice || !bridgeAvailable;
}

window.addEventListener("message", (event: MessageEvent<BridgeMessage>) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.event === "bridgeReady") { bridgeAvailable = true; setStatus("idle", "Bereit · iPhone anschließen"); sendBridge({cmd: "devices"}); }
  if (msg.event === "devices") renderDevices(msg.devices ?? []);
  if (msg.event === "status") setStatus(msg.state ?? "idle", msg.message ?? "");
  if (msg.event === "requestError") { deviceStatus.textContent = msg.message ?? "Fehler"; setStatus("error", "Fehler"); }
});

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function buildCommand(lat: string, lon: string): string {
  return [
    "cd /Users/karlschmedes/CCode/GetMe/app/sidecar",
    "UDID=$(.venv/bin/python -m pymobiledevice3 usbmux list --usb --simple | tr -dc '0-9A-Fa-f-')",
    ".venv/bin/python -m pymobiledevice3 mounter auto-mount --udid \"$UDID\"",
    `.venv/bin/python -m pymobiledevice3 developer dvt simulate-location set --userspace --udid \"$UDID\" -- ${lat} ${lon}`,
  ].join("\n");
}

function selectLocation(point: LatLng): void {
  const lat = formatCoordinate(point.lat);
  const lon = formatCoordinate(point.lng);
  selectedCommand = buildCommand(lat, lon);

  if (marker) marker.setLatLng(point);
  else marker = L.marker(point).addTo(map);

  selectionTitle.textContent = "Punkt ausgewählt";
  latitude.textContent = `${lat}°`;
  longitude.textContent = `${lon}°`;
  commandOutput.textContent = selectedCommand;
  copyButton.disabled = false;
  resetButton.disabled = false;
  copyStatus.textContent = "";
  startButton.disabled = !selectedDevice || !bridgeAvailable;
}

function resetSelection(): void {
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  selectedCommand = "";
  selectionTitle.textContent = "Noch kein Punkt";
  latitude.textContent = "—";
  longitude.textContent = "—";
  commandOutput.textContent = "Wähle einen Punkt auf der Karte.";
  copyButton.disabled = true;
  resetButton.disabled = true;
  copyStatus.textContent = "";
}

map.on("click", (event: LeafletMouseEvent) => selectLocation(event.latlng));
resetButton.addEventListener("click", resetSelection);
deviceSelect.addEventListener("change", () => { selectedDevice = deviceSelect.value; startButton.disabled = !selectedCommand || !selectedDevice || !bridgeAvailable; });
refreshDevices.addEventListener("click", () => sendBridge({cmd: "devices"}));
startButton.addEventListener("click", () => { if (selectedCommand && selectedDevice) sendBridge({cmd: "start", udid: selectedDevice, lat: Number(latitude.textContent?.replace("°", "")), lon: Number(longitude.textContent?.replace("°", ""))}); });
stopButton.addEventListener("click", () => sendBridge({cmd: "stop"}));

copyButton.addEventListener("click", async () => {
  if (!selectedCommand) return;
  try {
    await navigator.clipboard.writeText(selectedCommand);
    copyStatus.textContent = "Command kopiert";
    window.setTimeout(() => { copyStatus.textContent = ""; }, 2200);
  } catch {
    copyStatus.textContent = "Kopieren nicht möglich – Command markieren und kopieren.";
  }
});
