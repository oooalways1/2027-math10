"""차시별 QR 이미지 만들기 (문항이 아직 없는 차시도 미리 만듦)

사용법:  python tools/make_qr.py 4-1
결과:    qr/4-1/01.png ~ 36.png       (QR + 아래에 학년·차시·제목)
         qr/4-1/4-1_QR_전체.zip       (36개)
         qr/4-1/4-1_QR_문항있음.zip   (문항이 들어간 차시만)
         qr/manifest.json             (관리 페이지 QR 보관함 목록)
필요:    pip install qrcode pillow
"""
import json
import re
import sys
import zipfile
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

BASE_URL = 'https://2027-math10.mathedu.workers.dev/'
ROOT = Path(__file__).resolve().parent.parent


def font(size, bold=False):
    for name in (['malgunbd.ttf'] if bold else []) + ['malgun.ttf', 'AppleSDGothicNeo.ttc', 'NanumGothic.ttf']:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def read_toc(grade):
    """data.js 에서 단원, 단원당 차시 수, 문항이 있는 차시 제목을 읽음"""
    js = (ROOT / grade / 'data.js').read_text(encoding='utf-8')
    units_src = re.search(r'const UNITS\s*=\s*\{([^}]*)\}', js).group(1)
    units = {int(k): v for k, v in re.findall(r"(\d+):\s*'([^']+)'", units_src)}
    m = re.search(r'const LESSONS_PER_UNIT\s*=\s*(\d+)', js)
    per = int(m.group(1)) if m else 6
    titles = dict(re.findall(r"'(\d\d)':\s*\{\s*unit:\s*\d+,\s*title:\s*'([^']+)'", js))
    toc = []
    for u in sorted(units):
        for k in range(per):
            no = f'{(u - 1) * per + k + 1:02d}'
            toc.append({'no': no, 'unit': u, 'unitName': units[u], 'title': titles.get(no, ''), 'ready': no in titles})
    return toc


def make_png(url, line1, line2, path):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    q = qr.make_image(fill_color='black', back_color='white').convert('RGB')
    w, h = q.size
    canvas = Image.new('RGB', (w, h + 150), 'white')
    canvas.paste(q, (0, 0))
    d = ImageDraw.Draw(canvas)
    for text, f, y in ((line1, font(44, True), h - 4), (line2, font(34), h + 60)):
        tw = d.textlength(text, font=f)
        d.text(((w - tw) / 2, y), text, font=f, fill='black')
    canvas.save(path)


def main(grade, base=BASE_URL):
    out = ROOT / 'qr' / grade
    out.mkdir(parents=True, exist_ok=True)
    toc = read_toc(grade)
    for t in toc:
        t['url'] = f'{base}{grade}/#{t["no"]}'
        t['file'] = f'{grade}/{t["no"]}.png'
        make_png(t['url'], f'{grade} · {t["no"]}차시 심화', t['title'] or t['unitName'], out / f'{t["no"]}.png')

    for name, items in ((f'{grade}_QR_전체.zip', toc), (f'{grade}_QR_문항있음.zip', [t for t in toc if t['ready']])):
        with zipfile.ZipFile(out / name, 'w', zipfile.ZIP_DEFLATED) as z:
            for t in items:
                z.write(out / f'{t["no"]}.png', f'{grade}_{t["no"]}차시.png')

    manifest_path = ROOT / 'qr' / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    manifest[grade] = {
        'lessons': toc,
        'zipAll': f'{grade}/{grade}_QR_전체.zip',
        'zipReady': f'{grade}/{grade}_QR_문항있음.zip',
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{grade}: QR {len(toc)}개 (문항 있음 {sum(t["ready"] for t in toc)}개)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('학년 폴더를 넣어 주세요: python tools/make_qr.py 4-1')
    main(sys.argv[1], *(sys.argv[2:3]))
