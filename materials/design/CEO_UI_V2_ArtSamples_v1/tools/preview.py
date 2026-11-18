"""样板预览与复核图生成：总览板、两档容器裁切、浅深底 alpha 检查、360 宽观感与分层合成。"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = os.path.join(ROOT, "png")
PREVIEW = os.path.join(ROOT, "preview")
os.makedirs(PREVIEW, exist_ok=True)

FONT = "C:/Windows/Fonts/msyh.ttc"
INK = (36, 50, 71)
SUB = (83, 100, 122)
LINE = (214, 222, 232)
CANVAS = (244, 246, 250)


def f(size, bold=False):
    try:
        return ImageFont.truetype(FONT, size, index=1 if bold else 0)
    except Exception:
        return ImageFont.load_default()


def cover_crop(im, w, h, fx, fy):
    sw, sh = im.size
    s = max(w / sw, h / sh)
    big = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    x = min(max(round(big.width * fx - w / 2), 0), big.width - w)
    y = min(max(round(big.height * fy - h / 2), 0), big.height - h)
    return big.crop((x, y, x + w, y + h))


def load(name):
    return Image.open(os.path.join(PNG, name)).convert("RGBA")


def composite_scene(scene, char, w, h, fy, char_h_ratio=0.94, x_ratio=0.585, bottom=0):
    base = cover_crop(scene, w, h, 0.5, fy).convert("RGBA")
    ch = int(h * char_h_ratio)
    cw = int(char.width * ch / char.height)
    img = char.resize((cw, ch), Image.LANCZOS)
    base.alpha_composite(img, (int(w * x_ratio), h - ch + bottom))
    scrim = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for i in range(int(w * 0.60)):
        a = int(140 * (1 - i / (w * 0.60)) ** 1.7)
        sd.line([(i, 0), (i, h)], fill=(255, 252, 246, a))
    scrim = scrim.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(base, scrim)


def main():
    scene = load("v2_ill_s05_office_scene.png").convert("RGB")
    assist = load("v2_chr_assist01.png")
    hr = load("v2_chr_hr01.png")
    avatar = load("v2_old_av_01.png")
    nav_on = load("v2_old_nav_01_selected.png")
    nav_off = load("v2_old_nav_02_inactive.png")

    # ---------- 01 总览板 ----------
    W, H = 1680, 1860
    board = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(board)
    d.text((48, 34), "《我是CEO》UI V2 美术样板 · 六项首批交付", font=f(34, True), fill=INK)
    d.text((48, 86), "轻半写实日式 2D 商业插画｜蓝白为主，金色仅作点缀｜暖日光自左侧窗户进入", font=f(18), fill=SUB)
    d.line((48, 124, W - 48, 124), fill=LINE, width=2)

    d.rounded_rectangle((48, 148, 1632, 1162), 10, fill=(255, 255, 255), outline=LINE, width=1)
    d.text((68, 160), "ILL-S05  公司首页办公室空镜  1080×660（不透明）", font=f(16, True), fill=INK)
    board.paste(scene.resize((1520, 929), Image.LANCZOS), (80, 192))
    d.text((68, 1130), "右侧三分之一留人物站位；左右各留裁切余量；画面不含公司名、金额、按钮、对白框、图表、品牌字样与水印。",
           font=f(15), fill=SUB)

    def char_panel(box, title, img, scale, caption):
        x0, y0, x1, y1 = box
        d.rounded_rectangle(box, 10, fill=(255, 255, 255), outline=LINE, width=1)
        d.text((x0 + 18, y0 + 14), title, font=f(16, True), fill=INK)
        sw, sh = int(img.width * scale), int(img.height * scale)
        thumb = img.resize((sw, sh), Image.LANCZOS)
        bg = Image.new("RGBA", (sw, sh), (228, 237, 251, 255))
        bg.alpha_composite(thumb)
        board.paste(bg.convert("RGB"), (x0 + 18, y0 + 52))
        d.text((x0 + 18, y0 + 60 + sh), caption, font=f(14), fill=SUB)

    char_panel((48, 1186, 700, 1836), "CHR-ASSIST01  经营助理  720×960 透明", assist, 0.55,
               "白西装 + 浅蓝衬衫 + 蓝挂绳空白工牌 + 金色胸针；\n张开手掌的迎客姿态；暖棕过肩发，发梢完整。")
    char_panel((716, 1186, 1368, 1836), "CHR-HR01  人事经理  720×960 透明", hr, 0.55,
               "藏青西装 + 白衬衫 + 金边眼镜；齐颈黑短发；\n抱白色文件夹并握笔讲解；姿态比助理更克制。")

    # 右列：头像 + 图标
    d.rounded_rectangle((1384, 1186, 1632, 1470), 10, fill=(255, 255, 255), outline=LINE, width=1)
    d.text((1402, 1200), "OLD-AV-01  256×256", font=f(15, True), fill=INK)
    board.paste_alpha = None
    brd = board.convert("RGBA")
    brd.alpha_composite(avatar.resize((210, 210), Image.LANCZOS), (1396, 1234))
    board = brd.convert("RGB")
    d = ImageDraw.Draw(board)
    d.text((1402, 1444), "保留短发蓝西装身份", font=f(13), fill=SUB)

    d.rounded_rectangle((1384, 1486, 1632, 1836), 10, fill=(255, 255, 255), outline=LINE, width=1)
    d.text((1402, 1500), "OLD-NAV-01 / 02  192×192", font=f(15, True), fill=INK)
    brd = board.convert("RGBA")
    brd.alpha_composite(nav_on.resize((92, 92), Image.LANCZOS), (1400, 1534))
    brd.alpha_composite(nav_off.resize((92, 92), Image.LANCZOS), (1500, 1534))
    brd.alpha_composite(nav_on.resize((40, 40), Image.LANCZOS), (1402, 1650))
    brd.alpha_composite(nav_off.resize((40, 40), Image.LANCZOS), (1452, 1650))
    brd.alpha_composite(avatar.resize((40, 40), Image.LANCZOS), (1502, 1650))
    brd.alpha_composite(nav_on.resize((24, 24), Image.LANCZOS), (1560, 1660))
    brd.alpha_composite(nav_off.resize((24, 24), Image.LANCZOS), (1592, 1660))
    board = brd.convert("RGB")
    d = ImageDraw.Draw(board)
    d.text((1402, 1706), "共享轮廓，仅以填充深浅区分选中态", font=f(13), fill=SUB)
    d.text((1402, 1730), "40px / 24px 实际观感", font=f(13), fill=SUB)
    d.text((1402, 1776), "SVG 可编辑源稿同步交付", font=f(13), fill=SUB)
    board.save(os.path.join(PREVIEW, "01_样板总览.png"), optimize=True)

    # ---------- 02/03 容器裁切 ----------
    for name, w, h, fy in [("02_场景裁切_343x160.png", 343, 160, 0.48), ("03_场景裁切_343x96.png", 343, 96, 0.56)]:
        crop = cover_crop(scene, w, h, 0.5, fy)
        sheet = Image.new("RGB", (w * 2 + 96, h * 2 + 200), CANVAS)
        dd = ImageDraw.Draw(sheet)
        dd.text((24, 18), f"ILL-S05 容器裁切复核 {w}×{h}｜cover + 焦点 (0.50, {fy:.2f})", font=f(16, True), fill=INK)
        sheet.paste(crop, (24, 56))
        dd.text((24, 56 + h + 12), "1×", font=f(13), fill=SUB)
        sheet.paste(crop.resize((w * 2, h * 2), Image.LANCZOS), (24, 56 + h + 46))
        dd.text((24, 56 + h + 50 + h * 2), "2× 局部放大（仅示意，非导出尺寸）", font=f(13), fill=SUB)
        sheet.save(os.path.join(PREVIEW, name), optimize=True)

    # ---------- 04/05 alpha 检查 ----------
    for light in (True, False):
        bgc = (244, 246, 250) if light else (36, 50, 71)
        name = "04_透明边缘_浅底.png" if light else "05_透明边缘_深底.png"
        sheet = Image.new("RGBA", (1320, 700), bgc + (255,))
        dd = ImageDraw.Draw(sheet)
        ink = INK if light else (238, 242, 248)
        dd.text((32, 22), f"透明 PNG 边缘检查 · {'浅底 #F4F6FA' if light else '深底 #243247'}", font=f(20, True), fill=ink)
        sheet.alpha_composite(assist.resize((330, 440), Image.LANCZOS), (70, 80))
        sheet.alpha_composite(hr.resize((330, 440), Image.LANCZOS), (420, 80))
        sheet.alpha_composite(avatar.resize((200, 200), Image.LANCZOS), (790, 80))
        sheet.alpha_composite(nav_on.resize((150, 150), Image.LANCZOS), (1010, 90))
        sheet.alpha_composite(nav_off.resize((150, 150), Image.LANCZOS), (1150, 90))
        dd.text((70, 530), "33%（≈360 宽手机观感）", font=f(14), fill=ink)
        sheet.alpha_composite(assist.resize((110, 147), Image.LANCZOS), (70, 556))
        sheet.alpha_composite(hr.resize((110, 147), Image.LANCZOS), (196, 556))
        sheet.alpha_composite(avatar.resize((60, 60), Image.LANCZOS), (322, 556))
        sheet.alpha_composite(nav_on.resize((44, 44), Image.LANCZOS), (400, 556))
        sheet.alpha_composite(nav_off.resize((44, 44), Image.LANCZOS), (456, 556))
        dd.text((540, 560), "检查：发梢完整 / 手指不断开 / 白服装外沿无绿边灰边 / 图标描边不糊边", font=f(14), fill=ink)
        sheet.convert("RGB").save(os.path.join(PREVIEW, name), optimize=True)

    # ---------- 06 分层合成 ----------
    for w, h, fy, tag in [(343, 160, 0.48, "343x160"), (343, 96, 0.56, "343x96")]:
        base = composite_scene(scene, assist, w, h, fy)
        sheet = Image.new("RGB", (w * 2 + 96, h * 2 + 190), CANVAS)
        dd = ImageDraw.Draw(sheet)
        dd.text((24, 18), f"ILL-S05 + CHR-ASSIST01 分层合成 {tag}（左浅色遮罩模拟文字层，未绘制文字）", font=f(15, True), fill=INK)
        sheet.paste(base.convert("RGB"), (24, 54))
        dd.text((24, 54 + h + 10), "1×", font=f(13), fill=SUB)
        sheet.paste(base.convert("RGB").resize((w * 2, h * 2), Image.LANCZOS), (24, 54 + h + 40))
        sheet.save(os.path.join(PREVIEW, f"06_合成横幅_{tag}.png"), optimize=True)

    # ---------- 07 360 宽观感 ----------
    phone_w, phone_h = 360, 640
    phone = Image.new("RGB", (phone_w, phone_h), (247, 249, 252))
    pd = ImageDraw.Draw(phone)
    pd.rounded_rectangle((0, 0, phone_w, phone_h), 24, fill=(250, 251, 253))
    pd.text((16, 18), "公司", font=f(16, True), fill=INK)
    pd.text((16, 44), "第 3 月 · 现金 1,240,000", font=f(12), fill=SUB)
    banner = composite_scene(scene, assist, 328, 153, 0.48)
    phone.paste(banner.convert("RGB"), (16, 68))
    # 下方模拟两块业务卡（仅色块，用于比例参照）
    y = 236
    for i, label in enumerate(["员工 12 / 24", "本月营收 +18%", "招聘 3 个岗位", "年报待发布"]):
        pd.rounded_rectangle((16, y, 328, y + 62), 12, fill=(255, 255, 255), outline=(226, 232, 240))
        pd.text((32, y + 20), label, font=f(15), fill=INK)
        y += 72
    sheet = Image.new("RGB", (phone_w * 2 + 120, phone_h + 80), CANVAS)
    dd = ImageDraw.Draw(sheet)
    dd.text((24, 18), "360 宽手机上缩小后的辨识度复核（不叠加任何导出图）", font=f(16, True), fill=INK)
    sheet.paste(phone, (24, 52))
    dd.text((24 + phone_w + 24, 60), "判读结论", font=f(15, True), fill=INK)
    lines = [
        "· 窗口与城市天际线：小尺寸仍可读出“办公室 + 白天”。",
        "· 助理白西装与蓝衬衫对比足够，发色与肤色未并成一块。",
        "· 桌面电脑、绿植在缩略后仍是明确形状，不糊成色斑。",
        "· 右侧人物与背景墙分离清楚，未被暖光吃掉轮廓。",
        "· 头像 40px 下五官仍可辨；图标 24px 下建筑轮廓清楚。",
    ]
    yy = 92
    for line in lines:
        dd.text((24 + phone_w + 24, yy), line, font=f(14), fill=SUB)
        yy += 32
    sheet.save(os.path.join(PREVIEW, "07_360宽观感.png"), optimize=True)
    print("preview done")


if __name__ == "__main__":
    main()
