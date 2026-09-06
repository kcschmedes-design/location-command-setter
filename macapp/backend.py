"""GetMe JSON-lines worker. Only an explicit start command writes a location."""
import asyncio
from contextlib import AsyncExitStack
import json
import math
import signal
import sys
import time

# Pin these APIs in requirements.lock; no dependency on another project's venv.
list_devices = create_using_usbmux = UserspaceRsdTunnel = auto_mount = DvtProvider = LocationSimulation = None


def emit(value):
    print(json.dumps(value, ensure_ascii=False, allow_nan=False), flush=True)


async def devices():
    global list_devices
    if list_devices is None:
        from pymobiledevice3.usbmux import list_devices as discover
        list_devices = discover
    return [{"id": d.serial, "name": "iPhone / iPad · " + d.serial[-8:]}
            for d in await asyncio.wait_for(list_devices(), 8) if d.is_usb]


def coordinates(req):
    lat, lon = req.get("lat"), req.get("lon")
    if (type(lat) not in (int, float) or type(lon) not in (int, float)
            or not math.isfinite(lat) or not math.isfinite(lon)
            or not -90 <= lat <= 90 or not -180 <= lon <= 180):
        raise ValueError("Bitte gültige Koordinaten auf der Karte auswählen.")
    return lat, lon


class PhoneSession:
    async def open(self, uid):
        global create_using_usbmux, UserspaceRsdTunnel, auto_mount, DvtProvider, LocationSimulation
        if create_using_usbmux is None:
            from pymobiledevice3.lockdown import create_using_usbmux as lockdown_factory
            from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel as tunnel_factory
            from pymobiledevice3.services.mobile_image_mounter import auto_mount as mount
            from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider as provider
            from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation as simulator
            create_using_usbmux, UserspaceRsdTunnel, auto_mount, DvtProvider, LocationSimulation = lockdown_factory, tunnel_factory, mount, provider, simulator
        self.stack = AsyncExitStack()
        try:
            # Require USB and one explicit identifier. Discovery never clears GPS.
            if uid not in {d["id"] for d in await devices()}:
                raise ValueError("Das ausgewählte iPhone ist nicht per USB verbunden.")
            lockdown = await create_using_usbmux(serial=uid, connection_type="USB", pair_timeout=30)
            async with lockdown:
                version = tuple(int(v) for v in lockdown.product_version.split(".")[:2])
                if version < (17, 4):
                    raise ValueError("Diese Ausgabe benötigt iOS 17.4 oder neuer.")
                await auto_mount(lockdown)
            rsd = await self.stack.enter_async_context(UserspaceRsdTunnel(serial=uid, remotepairing_fallback=False))
            dvt = await self.stack.enter_async_context(DvtProvider(rsd))
            self.location = await self.stack.enter_async_context(LocationSimulation(dvt))
        except BaseException:
            await self.stack.aclose()
            raise

    async def set(self, lat, lon):
        await self.location.set(lat, lon)

    async def clear(self):
        await self.location.clear()

    async def close(self):
        await self.stack.aclose()


class Controller:
    def __init__(self, factory=PhoneSession, send=emit, interval=15):
        self.factory, self.send, self.interval = factory, send, interval
        self.task = None
        self.state = "idle"
        self.reset_uncertain = False

    def status(self, state, message, **extra):
        self.state = state
        self.send({"event": "status", "state": state, "message": message, **extra})

    async def run_session(self, uid, lat, lon):
        session = self.factory()
        opened = False
        attempted = False
        failure = None
        try:
            self.status("starting", "iPhone vorbereiten und USB-Tunnel öffnen …")
            await asyncio.wait_for(session.open(uid), 180)
            opened = True
            while True:
                attempted = True
                await asyncio.wait_for(session.set(lat, lon), 10)
                self.status("active", "Standortsimulation aktiv", lat=lat, lon=lon, lastAck=time.time())
                # Keep the SAME tunnel and DVT channel alive; never block the event loop.
                # The acknowledged refresh also detects an unresponsive transport.
                await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            failure = f"{type(exc).__name__}: {exc}"
        finally:
            reset_ok = not attempted
            if opened:
                if attempted:
                    try:
                        await asyncio.wait_for(session.clear(), 5)
                        reset_ok = True
                    except Exception as exc:
                        failure = (failure + " · " if failure else "") + f"Zurücksetzen fehlgeschlagen: {exc}"
                try:
                    await asyncio.wait_for(session.close(), 5)
                except Exception as exc:
                    failure = (failure + " · " if failure else "") + f"Verbindung schließen: {exc}"
            self.reset_uncertain = not reset_ok
            if failure:
                self.status("error", "Verbindung fehlgeschlagen. iPhone entsperren, Vertrauen und Entwicklermodus prüfen.",
                            detail=failure, resetUncertain=self.reset_uncertain)
            else:
                self.status("idle", "Gestoppt · Rücksetz-Befehl gesendet" if attempted else "Bereit · Punkt auswählen")

    async def start(self, req):
        if self.task and not self.task.done():
            raise ValueError("Simulation läuft bereits. Zuerst stoppen.")
        if self.reset_uncertain:
            raise ValueError("Zurücksetzen war nicht bestätigt. iPhone neu starten und App erneut öffnen.")
        lat, lon = coordinates(req)
        uid = req.get("udid")
        if not isinstance(uid, str) or not uid or len(uid) > 100:
            raise ValueError("Bitte ein USB-Gerät auswählen.")
        self.task = asyncio.create_task(self.run_session(uid, lat, lon))

    async def stop(self):
        if self.task and not self.task.done():
            self.status("stopping", "Simulation stoppen und Standort zurücksetzen …")
            self.task.cancel()
            await self.task
        self.task = None


async def main():
    controller = Controller()
    loop = asyncio.get_running_loop()
    main_task = asyncio.current_task()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, main_task.cancel)
    reader = asyncio.StreamReader(limit=16384)
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    controller.status("idle", "Bereit · iPhone per Kabel anschließen")
    try:
        while line := await reader.readline():
            try:
                req = json.loads(line)
                if not isinstance(req, dict):
                    raise ValueError("Ungültige Anfrage")
                cmd = req.get("cmd")
                if cmd == "devices":
                    emit({"event": "devices", "devices": await devices()})
                elif cmd == "start":
                    await controller.start(req)
                elif cmd == "stop":
                    await controller.stop()
                elif cmd == "quit":
                    break
                else:
                    raise ValueError("Unbekannte Anfrage")
            except Exception as exc:
                emit({"event": "requestError", "message": str(exc) or type(exc).__name__})
    except asyncio.CancelledError:
        pass
    finally:
        await controller.stop()


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        from importlib.metadata import version
        emit({"ok": True, "pymobiledevice3": version("pymobiledevice3"), "hardwareAccess": False})
    else:
        asyncio.run(main())
