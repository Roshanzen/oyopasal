from PIL import Image, ImageDraw, ImageFilter
import numpy as np

src = Image.open('scratch/robot_source_crop.png').convert('RGBA')
w, h = src.size
arr = np.array(src, dtype=float)
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]

# Base geometric mask
scale = 4
mask_img = Image.new('L', (w * scale, h * scale), 0)
draw = ImageDraw.Draw(mask_img)

def S(x, y):
    return (int(x * scale), int(y * scale))

# 1. Handle outer loop
draw.ellipse([S(90, 65), S(162, 122)], fill=255)

# 2. Main Head & Torso
draw.rounded_rectangle([S(62, 105), S(196, 226)], radius=int(26 * scale), fill=255)
# Torso bottom connector
draw.rounded_rectangle([S(80, 215), S(178, 236)], radius=int(8 * scale), fill=255)

# 3. Left ear
draw.ellipse([S(50, 128), S(70, 176)], fill=255)

# 4. Right ear
draw.ellipse([S(188, 128), S(208, 176)], fill=255)

# 5. Left arm
left_arm = [
    S(66, 155),
    S(48, 178),
    S(36, 202),
    S(38, 216),
    S(50, 222),
    S(58, 216),
    S(68, 190),
    S(72, 168),
]
draw.polygon(left_arm, fill=255)
draw.ellipse([S(36, 202), S(58, 222)], fill=255)

# 6. Right arm
right_arm = [
    S(192, 155),
    S(210, 178),
    S(218, 200),
    S(216, 214),
    S(204, 222),
    S(194, 216),
    S(188, 190),
    S(186, 168),
]
draw.polygon(right_arm, fill=255)
draw.ellipse([S(194, 202), S(216, 222)], fill=255)

# 7. Left leg
draw.rounded_rectangle([S(86, 226), S(120, 272)], radius=int(10 * scale), fill=255)

# 8. Right leg
draw.rounded_rectangle([S(138, 226), S(172, 272)], radius=int(10 * scale), fill=255)

# 9. Handle inner hole (cut out)
draw.ellipse([S(102, 80), S(150, 108)], fill=0)

smooth_mask = mask_img.resize((w, h), Image.Resampling.LANCZOS)
mask_data = np.array(smooth_mask, dtype=float)

# Detect mint background:
# r > 145, g > 185, b > 165
# Calculate bg likelihood (0 inside robot, 1 in pale mint bg)
bg_score = np.clip((r - 130) / 35, 0, 1) * np.clip((b - 150) / 35, 0, 1) * np.clip((g - 170) / 30, 0, 1)

# Attenuate alpha near background
clean_alpha = mask_data * (1.0 - bg_score)

# Slight Gaussian blur to keep edge soft & antialiased without any halo
final_alpha = Image.fromarray(clean_alpha.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius=0.5))

src.putalpha(final_alpha)
bbox = src.getbbox()
cropped = src.crop(bbox)

pad = 8
final_im = Image.new('RGBA', (cropped.width + pad*2, cropped.height + pad*2), (0, 0, 0, 0))
final_im.paste(cropped, (pad, pad))

out1 = 'public/assets/images/oyopasal_robot_character.png'
out2 = 'src/assets/images/oyopasal_robot_character.png'
final_im.save(out1, 'PNG')
final_im.save(out2, 'PNG')
print(f"Refined character saved: {final_im.size}")
