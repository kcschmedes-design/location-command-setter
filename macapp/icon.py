from pathlib import Path
from PIL import Image, ImageDraw

out = Path("macapp/build/GetMe.iconset")
out.mkdir(parents=True, exist_ok=True)
for size, name in [(16,"icon_16x16.png"),(32,"icon_16x16@2x.png"),(32,"icon_32x32.png"),(64,"icon_32x32@2x.png"),(128,"icon_128x128.png"),(256,"icon_128x128@2x.png"),(256,"icon_256x256.png"),(512,"icon_256x256@2x.png"),(512,"icon_512x512.png"),(1024,"icon_512x512@2x.png")]:
    image = Image.new("RGBA", (size, size), "#0b2d52")
    draw = ImageDraw.Draw(image)
    margin = size * .17
    draw.rounded_rectangle((margin, margin, size-margin, size-margin), radius=size*.18, fill="#ffffff")
    cx, cy = size / 2, size * .43
    r = size * .19
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill="#1f70d1")
    draw.polygon([(cx-r*.78, cy+r*.55), (cx, size*.83), (cx+r*.78, cy+r*.55)], fill="#1f70d1")
    image.save(out / name)
