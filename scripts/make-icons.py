#!/usr/bin/env python3
"""Genera los iconos de la PWA a partir de icons/source.png (la chapa-ruleta, PNG transparente 512 px).
 - icon-192/512 y icon.svg: la chapa con su transparencia ("any").
 - maskable-192/512: fondo sólido + chapa dentro de la zona segura (~62 %).
 - apple-touch-icon y store-1024: iOS y las tiendas no admiten transparencia → fondo sólido.
Uso: npm run icons   (requiere `pip install pillow`)."""
import base64, io, os
from PIL import Image

BG = (6, 9, 20)  # = background_color del manifest (#060914)
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'icons')
src = Image.open(os.path.join(OUT, 'source.png')).convert('RGBA')
src = src.crop(src.getchannel('A').getbbox())  # recorta el margen transparente


def fit(size, fraction, bg=None):
    """La chapa centrada ocupando `fraction` del lienzo, sobre transparente o `bg`."""
    canvas = Image.new('RGBA', (size, size), (*bg, 255) if bg else (0, 0, 0, 0))
    k = size * fraction / max(src.size)
    art = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


os.makedirs(OUT, exist_ok=True)
for size in (192, 512):
    fit(size, 0.96).save(os.path.join(OUT, f'icon-{size}.png'), optimize=True)
    fit(size, 0.66, BG).convert('RGB').save(os.path.join(OUT, f'maskable-{size}.png'), optimize=True)
fit(180, 0.84, BG).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
fit(1024, 0.84, BG).convert('RGB').save(os.path.join(OUT, 'store-1024.png'), optimize=True)

buf = io.BytesIO(); fit(512, 0.96).save(buf, 'PNG', optimize=True)
with open(os.path.join(OUT, 'icon.svg'), 'w') as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">'
            f'<image width="512" height="512" xlink:href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>\n')
print('Iconos generados en', os.path.abspath(OUT))
