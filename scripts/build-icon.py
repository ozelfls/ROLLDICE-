from itertools import combinations
from math import sqrt
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
SIZE = 1024
PHI = (1 + sqrt(5)) / 2


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def unit(v):
    length = sqrt(dot(v, v))
    return tuple(x / length for x in v)


vertices = [
    (0, -1, -PHI), (0, -1, PHI), (0, 1, -PHI), (0, 1, PHI),
    (-1, -PHI, 0), (-1, PHI, 0), (1, -PHI, 0), (1, PHI, 0),
    (-PHI, 0, -1), (-PHI, 0, 1), (PHI, 0, -1), (PHI, 0, 1),
]
faces = []
for indexes in combinations(range(len(vertices)), 3):
    a, b, c = (vertices[index] for index in indexes)
    if all(abs(dot(sub(p, q), sub(p, q)) - 4) < 1e-8 for p, q in ((a, b), (b, c), (c, a))):
        normal = unit(cross(sub(b, a), sub(c, a)))
        center = tuple((a[i] + b[i] + c[i]) / 3 for i in range(3))
        if dot(normal, center) < 0:
            indexes = (indexes[0], indexes[2], indexes[1])
            normal = tuple(-x for x in normal)
        faces.append((indexes, normal))

front_indexes, forward = faces[3]
front_center = tuple(sum(vertices[index][axis] for index in front_indexes) / 3 for axis in range(3))
up = unit(sub(vertices[front_indexes[0]], front_center))
right = unit(cross(up, forward))
scale = 212


def project(vertex):
    return (SIZE / 2 + scale * dot(vertex, right), SIZE / 2 - scale * dot(vertex, up), dot(vertex, forward))


icon = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
background = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
background_draw = ImageDraw.Draw(background)
for y in range(SIZE):
    t = y / (SIZE - 1)
    background_draw.line((0, y, SIZE, y), fill=(round(33 - 15 * t), round(49 - 24 * t), round(58 - 29 * t), 255))
mask = Image.new('L', (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((22, 22, SIZE - 22, SIZE - 22), radius=186, fill=255)
icon.paste(background, (0, 0), mask)
glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((195, 210, 830, 880), fill=(226, 109, 68, 50))
icon = Image.alpha_composite(icon, glow.filter(ImageFilter.GaussianBlur(90)))
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((220, 735, 820, 925), fill=(2, 3, 6, 170))
icon = Image.alpha_composite(icon, shadow.filter(ImageFilter.GaussianBlur(38)))

die = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(die)
light = unit((-0.55, 0.72, 0.42))
visible = []
for indexes, normal in faces:
    facing = dot(normal, forward)
    if facing <= 0.005:
        continue
    points = [project(vertices[index]) for index in indexes]
    depth = sum(point[2] for point in points) / 3
    visible.append((depth, indexes, normal, points))
visible.sort(key=lambda face: face[0])

for _, indexes, normal, points in visible:
    lighting = max(0, dot(normal, light))
    facing = max(0, dot(normal, forward))
    strength = 0.68 + 0.42 * lighting + 0.09 * facing
    base = (127, 13, 37) if indexes == front_indexes else (105, 9, 30)
    color = tuple(min(255, round(channel * strength)) for channel in base) + (255,)
    polygon = [(point[0], point[1]) for point in points]
    draw.polygon(polygon, fill=color)
    draw.line(polygon + [polygon[0]], fill=(46, 17, 19, 255), width=22, joint='curve')
    draw.line(polygon + [polygon[0]], fill=(178, 124, 53, 255), width=12, joint='curve')
    draw.line(polygon + [polygon[0]], fill=(244, 203, 112, 255), width=4, joint='curve')

front_points = [project(vertices[index]) for index in front_indexes]
front_polygon = [(point[0], point[1]) for point in front_points]
draw.line(front_polygon + [front_polygon[0]], fill=(255, 220, 133, 255), width=9, joint='curve')
center_x = sum(point[0] for point in front_points) / 3
center_y = sum(point[1] for point in front_points) / 3
font_file = ASSETS / 'fonts' / 'Cinzel-Bold.ttf'
font_size = 220
while True:
    font = ImageFont.truetype(str(font_file), font_size)
    bounds = draw.textbbox((0, 0), '20', font=font, stroke_width=0)
    if bounds[2] - bounds[0] <= 285 and bounds[3] - bounds[1] <= 154:
        break
    font_size -= 2
number_shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(number_shadow).text((center_x, center_y + 11), '20', font=font, anchor='mm', fill=(30, 4, 9, 230), stroke_width=7, stroke_fill=(30, 4, 9, 220))
die = Image.alpha_composite(die, number_shadow.filter(ImageFilter.GaussianBlur(8)))
draw = ImageDraw.Draw(die)
draw.text((center_x, center_y), '20', font=font, anchor='mm', fill=(250, 222, 152, 255), stroke_width=3, stroke_fill=(92, 47, 15, 255))
draw.line((front_polygon[0], front_polygon[1]), fill=(255, 235, 170, 180), width=5)
icon = Image.alpha_composite(icon, die)
ImageDraw.Draw(icon).rounded_rectangle((22, 22, SIZE - 22, SIZE - 22), radius=186, outline=(225, 135, 92, 255), width=12)

ASSETS.mkdir(parents=True, exist_ok=True)
icon.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / 'icon.png')
icon.save(ASSETS / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
