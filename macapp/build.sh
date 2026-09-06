#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
rm -rf macapp/build/GetMe.app macapp/release
mkdir -p macapp/build/GetMe.app/Contents/{MacOS,Resources/web}
cp -R dist/. macapp/build/GetMe.app/Contents/Resources/web/
python3 macapp/inline_web.py
python3 macapp/icon.py
cp macapp/build/GetMe.iconset/icon_512x512.png macapp/build/GetMe.app/Contents/Resources/GetMe.png
if [[ ! -x macapp/build/worker/getme-worker ]]; then
  macapp/.venv/bin/pyinstaller --clean --noconfirm --onefile --name getme-worker macapp/backend.py --distpath macapp/build/worker --workpath macapp/build/pyinstaller --specpath macapp/build \
    --hidden-import=pymobiledevice3.usbmux --hidden-import=pymobiledevice3.lockdown --hidden-import=pymobiledevice3.remote.userspace_tunnel \
    --hidden-import=pymobiledevice3.services.mobile_image_mounter --hidden-import=pymobiledevice3.services.dvt.instruments.dvt_provider \
    --hidden-import=pymobiledevice3.services.dvt.instruments.location_simulation --copy-metadata=apple-compress --copy-metadata=pymobiledevice3
fi
cp macapp/build/worker/getme-worker macapp/build/GetMe.app/Contents/Resources/getme-worker
xcrun swiftc -O -parse-as-library -framework SwiftUI -framework WebKit -o macapp/build/GetMe.app/Contents/MacOS/GetMe macapp/App.swift
cat > macapp/build/GetMe.app/Contents/Info.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>GetMe</string><key>CFBundleDisplayName</key><string>GetMe Standort</string>
<key>CFBundleIconFile</key><string>GetMe.png</string>
<key>CFBundleIdentifier</key><string>de.getme.location</string><key>CFBundleVersion</key><string>1.0.0</string>
<key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleExecutable</key><string>GetMe</string>
<key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>
</dict></plist>
PLIST
codesign --force --deep --sign - macapp/build/GetMe.app
mkdir -p macapp/release
ditto -c -k --keepParent macapp/build/GetMe.app macapp/release/GetMe-Standort-macOS.zip
hdiutil create -volname "GetMe Standort" -srcfolder macapp/build/GetMe.app -ov -format UDZO macapp/release/GetMe-Standort-macOS.dmg >/dev/null
echo "Created macapp/release/GetMe-Standort-macOS.{dmg,zip}"
