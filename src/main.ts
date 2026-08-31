import "./style.css";
import type * as Leaflet from "leaflet";

declare global {
  interface Window {
    L: typeof Leaflet;
  }
}

const map = window.L.map("map", { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 2);

window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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

let marker: Leaflet.Marker | null = null;
let selectedCommand = "";

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

function selectLocation(point: Leaflet.LatLng): void {
  const lat = formatCoordinate(point.lat);
  const lon = formatCoordinate(point.lng);
  selectedCommand = buildCommand(lat, lon);

  if (marker) marker.setLatLng(point);
  else marker = window.L.marker(point).addTo(map);

  selectionTitle.textContent = "Punkt ausgewählt";
  latitude.textContent = `${lat}°`;
  longitude.textContent = `${lon}°`;
  commandOutput.textContent = selectedCommand;
  copyButton.disabled = false;
  resetButton.disabled = false;
  copyStatus.textContent = "";
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

map.on("click", (event: Leaflet.LeafletMouseEvent) => selectLocation(event.latlng));
resetButton.addEventListener("click", resetSelection);

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
