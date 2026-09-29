# Иконки Android из android/app/store-icon.png — той же картинки, что стоит на витрине RuStore.
# Модерация сверяет иконку витрины с установленной, поэтому дефолтную иконку Capacitor
# подменяем всегда: python tools/make-android-icons.py
from PIL import Image, ImageDraw
import os
res = 'android/app/src/main/res'
src = Image.open('android/app/store-icon.png').convert('RGBA')
bg = src.getpixel((6, 6))[:3]
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    p = f'{res}/mipmap-{d}'
    s = round(48 * k)
    sq = src.resize((s, s), Image.LANCZOS)
    sq.save(f'{p}/ic_launcher.png')
    m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    rd = sq.copy(); rd.putalpha(m.resize((s, s), Image.LANCZOS)); rd.save(f'{p}/ic_launcher_round.png')
    # adaptive: слой 108dp, содержимое в безопасной зоне 66dp
    f = round(108 * k); inner = round(66 * k)
    fg = Image.new('RGBA', (f, f), (0, 0, 0, 0))
    fg.paste(src.resize((inner, inner), Image.LANCZOS), ((f - inner) // 2, (f - inner) // 2))
    fg.save(f'{p}/ic_launcher_foreground.png')
open(f'{res}/values/ic_launcher_background.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % bg)
print('bg', '#%02X%02X%02X' % bg)
