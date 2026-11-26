"""차시별 QR 이미지 만들기

사용법:  python tools/make_qr.py 4-1
         (학년 폴더 이름을 넣으면 그 폴더 index.html 의 차시 목록을 읽어 QR을 만듭니다)
결과:    qr/4-1/07.png ... (QR + 아래에 차시 이름)
필요:    pip install qrcode pillow
"""
import re
import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

BASE_URL = 'https://oooalways1.github.io/2027-math10/'
ROOT = Path(__file__).resolve().parent.parent


def font(size, bold=False):
    for name in (['malgunbd.ttf'] if bold else []) + ['malgun.ttf', 'AppleSDGothicNeo.ttc', 'NanumGothic.ttf']:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def lessons(grade):
    html = (ROOT / grade / 'index.html').read_text(encoding='utf-8')
    return re.findall(r"'(\d\d)':\s*\{\s*unit:\s*\d+,\s*title:\s*'([^']+)'", html)


def main(grade, base=BASE_URL):
    out = ROOT / 'qr' / grade
    out.mkdir(parents=True, exist_ok=True)
    for no, title in lessons(grade):
        url = f'{base}{grade}/#{no}'
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=3)
        qr.add_data(url)
        qr.make(fit=True)
        q = qr.make_image(fill_color='black', back_color='white').convert('RGB')
        w, h = q.size
        canvas = Image.new('RGB', (w, h + 150), 'white')
        canvas.paste(q, (0, 0))
        d = ImageDraw.Draw(canvas)
        for text, f, y in ((f'{grade} · {no}차시 심화', font(44, True), h - 4), (title, font(34), h + 60)):
            tw = d.textlength(text, font=f)
            d.text(((w - tw) / 2, y), text, font=f, fill='black')
        canvas.save(out / f'{no}.png')
        print(no, url)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('학년 폴더를 넣어 주세요: python tools/make_qr.py 4-1')
    main(sys.argv[1], *(sys.argv[2:3]))
