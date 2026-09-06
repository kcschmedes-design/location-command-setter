# Location Command Setter

Kleine eigenständige Web-App zum Auswählen eines Punkts auf einer Weltkarte und Erzeugen des passenden `pymobiledevice3`-Terminal-Befehls.

## Starten

```bash
npm install
npm run dev
```

Danach die von Vite angezeigte lokale URL im Browser öffnen. Die App benötigt eine Internetverbindung für OpenStreetMap-Kartenkacheln. Sie führt den erzeugten Befehl nicht selbst aus.

## Produktions-Build

```bash
npm run build
```

## Installierbare macOS-App

`macapp/build.sh` erstellt `macapp/release/GetMe-Standort-macOS.dmg` und `.zip`. Die App enthält die Web-Oberfläche, einen gebündelten Python-Worker und `pymobiledevice3` 11.3.0. Der Worker öffnet für iOS 17.4+ einen langlebigen Userspace-RSD-Tunnel und hält den DVT-Location-Simulation-Kanal offen; ein periodisches Setzen bestätigt die Verbindung, statt pro Klick einen neuen CLI-Prozess zu starten.

Die App zeigt USB-Geräte, Start, Stop, laufenden Status und Fehler. Ohne angeschlossenes iPhone führt sie keine Standortänderung aus. Für einen Praxistest: iPhone per Kabel verbinden, koppeln, Developer Mode aktivieren, einen Kartenpunkt wählen, Gerät auswählen und Start drücken. Die DMG ist ad-hoc signiert und daher nicht notarisiert; macOS kann beim ersten Start eine Sicherheitsbestätigung verlangen. Ein realer Hardwaretest ist in dieser Umgebung nicht möglich.

## Landing-Page

Die Vercel-Seite dient als GetMe-Landing-Page: Hero, Produktablauf und die interaktive Standortauswahl liegen gemeinsam in diesem Repository. Das bestehende Deployment unter `location-command-setter.vercel.app` kann damit aus demselben GitHub-Repository weiterbauen.
