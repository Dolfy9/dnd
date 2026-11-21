# Placeholder portret pro Postava_Ysmera_Vanthal (1024x1536 webp).
# Temny stylizovany placeholder: kapucena silueta s rohy, jantarove oci,
# treti oko na cele, sova na rameni, vinjetace a papirfernetovy sum.
# Spusteni: python tools/portret_placeholder_ysmera.py
import math
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 1024, 1536
OUT = "04_Postavy/obrazky/Postava_Ysmera_Vanthal.webp"

random.seed(20240117)

img = Image.new("RGB", (W, H), (26, 30, 40))
d = ImageDraw.Draw(img)

# Pozadi: vertikalni gradient tmmave sedo-modre
for y in range(H):
    t = y / H
    r = int(30 - 12 * t)
    g = int(36 - 14 * t)
    b = int(50 - 18 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# Naznak regalu se svazky knih ve hmle
for sx in (70, 790):
    d.rectangle([sx, 180, sx + 165, 1180], fill=(20, 24, 33))
    for sy in range(220, 1150, 95):
        x = sx + 12
        while x < sx + 150:
            w = random.randint(14, 26)
            h = random.randint(55, 80)
            shade = random.randint(24, 40)
            d.rectangle([x, sy + (85 - h), x + w, sy + 85], fill=(shade, shade + 3, shade + 9))
            x += w + random.randint(2, 6)

# Sviccove svetlo zleva
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([-300, 350, 420, 1050], fill=90)
glow = glow.filter(ImageFilter.GaussianBlur(180))
warm = Image.new("RGB", (W, H), (60, 42, 20))
img = Image.composite(warm, img, glow)
d = ImageDraw.Draw(img)

fig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
f = ImageDraw.Draw(fig)

cx = W // 2

# Plast/kutna (siroke plece, zuzujici se dolu)
f.polygon([(cx - 330, H), (cx - 300, 820), (cx - 210, 700), (cx - 150, 640),
           (cx + 150, 640), (cx + 210, 700), (cx + 300, 820), (cx + 330, H)],
          fill=(38, 42, 55, 255))

# Kapuce
f.ellipse([cx - 170, 330, cx + 170, 760], fill=(34, 38, 51, 255))
f.polygon([(cx - 170, 620), (cx - 120, 760), (cx - 60, 700), (cx + 60, 700),
           (cx + 120, 760), (cx + 170, 620), (cx + 170, 760), (cx - 170, 760)],
          fill=(34, 38, 51, 255))

# Stin obliceje pod kapuci
f.ellipse([cx - 115, 400, cx + 115, 730], fill=(14, 15, 22, 255))

# Rohy zahnuté dozadu (dva krive oblouky z kapuce)
def horn(side):
    pts = []
    for i in range(40):
        t = i / 39
        x = cx + side * (95 + 150 * math.sin(t * math.pi * 0.9))
        y = 480 - 200 * t - 60 * math.sin(t * math.pi)
        pts.append((x, y))
    pts2 = []
    for i in range(40):
        t = 1 - i / 39
        x = cx + side * (60 + 140 * math.sin(t * math.pi * 0.9))
        y = 490 - 190 * t - 60 * math.sin(t * math.pi)
        pts2.append((x, y))
    f.polygon(pts + pts2, fill=(70, 74, 88, 255))
    # stribrne krouzky na rozich
    for i in (12, 22, 30):
        t = i / 39
        x = cx + side * (77 + 145 * math.sin(t * math.pi * 0.9))
        y = 485 - 195 * t - 60 * math.sin(t * math.pi)
        f.ellipse([x - 7, y - 4, x + 7, y + 4], outline=(160, 165, 178, 255), width=3)

horn(-1)
horn(1)

# Prehnuta krajka kapuce nad celem
f.arc([cx - 170, 330, cx + 170, 760], 200, 340, fill=(48, 52, 68, 255), width=14)

fig = fig.filter(ImageFilter.GaussianBlur(1.2))
img = Image.alpha_composite(img.convert("RGBA"), fig)
d = ImageDraw.Draw(img)

# Jantarove oci s jemnym svetlem
eye = Image.new("RGBA", (W, H), (0, 0, 0, 0))
e = ImageDraw.Draw(eye)
for ex in (cx - 48, cx + 48):
    e.ellipse([ex - 16, 545, ex + 16, 575], fill=(255, 176, 60, 255))
    e.ellipse([ex - 30, 535, ex + 30, 585], fill=(255, 150, 40, 70))
eye = eye.filter(ImageFilter.GaussianBlur(4))
img = Image.alpha_composite(img, eye)
d = ImageDraw.Draw(img)
for ex in (cx - 48, cx + 48):
    d.ellipse([ex - 12, 551, ex + 12, 570], fill=(255, 196, 90))

# Treti oko: mlecne bile, pulootevrene
d.ellipse([cx - 18, 478, cx + 18, 502], fill=(212, 216, 224))
d.ellipse([cx - 18, 478, cx + 18, 490], fill=(150, 155, 168))
third = Image.new("RGBA", (W, H), (0, 0, 0, 0))
t3 = ImageDraw.Draw(third)
t3.ellipse([cx - 26, 470, cx + 26, 510], fill=(220, 225, 235, 60))
third = third.filter(ImageFilter.GaussianBlur(8))
img = Image.alpha_composite(img, third)
d = ImageDraw.Draw(img)

# Sova na pravem rameni (silueta)
ox, oy = cx + 205, 640
d.ellipse([ox - 55, oy - 40, ox + 55, oy + 120], fill=(88, 90, 98))
d.ellipse([ox - 42, oy - 95, ox + 42, oy - 15], fill=(96, 98, 106))
d.polygon([(ox - 40, oy - 90), (ox - 55, oy - 115), (ox - 30, oy - 100)], fill=(96, 98, 106))
d.polygon([(ox + 40, oy - 90), (ox + 55, oy - 115), (ox + 30, oy - 100)], fill=(96, 98, 106))
for ex in (ox - 20, ox + 20):
    d.ellipse([ex - 10, oy - 70, ex + 10, oy - 50], fill=(20, 20, 24))
    d.ellipse([ex - 5, oy - 65, ex + 5, oy - 55], fill=(230, 190, 90))
d.polygon([(ox - 8, oy - 48), (ox + 8, oy - 48), (ox, oy - 36)], fill=(60, 45, 20))
# kridlo
d.polygon([(ox - 55, oy), (ox - 20, oy + 30), (ox - 35, oy + 115), (ox - 55, oy + 110)], fill=(70, 72, 80))

# Vinjetace
vig = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vig)
vd.ellipse([-W * 0.45, -H * 0.3, W * 1.45, H * 1.3], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(160))
dark = Image.new("RGB", (W, H), (8, 9, 14))
img = Image.composite(img.convert("RGB"), dark, vig)

# Papierovy sum
noise = Image.effect_noise((W, H), 14)
img = Image.blend(img.convert("L").convert("RGB") if False else img, Image.merge("RGB", (noise, noise, noise)), 0.06)

img.save(OUT, "WEBP", quality=88)
print("ulozeno", OUT, img.size)
