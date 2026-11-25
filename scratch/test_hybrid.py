from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

im = Image.open('scratch/robot_source_crop.png').convert('RGBA')
w, h = im.size
arr = np.array(im, dtype=float)
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]

# 1. Base vector mask
scale = 4
mask_img = Image.new('L', (w * scale, h * scale), 0)
draw = ImageDraw.Draw(mask_img)

def S(x, y):
    return (int(x * scale), int(y * scale))

# Head & Torso: x=50..200, y=108..220
draw.rounded_rectangle([S(52, 108), S(198, 220)], radius=int(28 * scale), fill=255)

# Top handle loop:
draw.ellipse([S(92, 65), S(158, 120)], fill=255)
# Redraw torso over bottom of handle
draw.rounded_rectangle([S(52, 108), S(198, 220)], radius=int(28 * scale), fill=255)

# Left ear:
draw.ellipse([S(36, 128), S(66, 178)], fill=255)
# Right ear:
draw.ellipse([S(184, 128), S(214, 178)], fill=255)

# Left arm:
left_arm_pts = [
    S(68, 155),
    S(50, 168),
    S(34, 192),
    S(36, 214),
    S(46, 222),
    S(58, 214),
    S(72, 185),
    S(78, 165),
]
draw.polygon(left_arm_pts, fill=255)
draw.ellipse([S(34, 196), S(58, 222)], fill=255)

# Right arm:
right_arm_pts = [
    S(182, 155),
    S(200, 168),
    S(216, 192),
    S(218, 212),
    S(208, 222),
    S(196, 214),
    S(178, 185),
    S(172, 165),
]
draw.polygon(right_arm_pts, fill=255)
draw.ellipse([S(194, 196), S(218, 222)], fill=255)

# Left leg:
draw.rounded_rectangle([S(84, 214), S(116, 268)], radius=int(12 * scale), fill=255)
# Right leg:
draw.rounded_rectangle([S(134, 214), S(166, 268)], radius=int(12 * scale), fill=255)

# Carve handle hole:
draw.ellipse([S(112, 80), S(138, 104)], fill=0)

smooth_mask = mask_img.resize((w, h), Image.Resampling.LANCZOS)
mask_arr = np.array(smooth_mask, dtype=float) / 255.0

# 2. Refine with color check:
# Pale background:
is_pale_bg = (r > 160) & (g > 195) & (b > 180)
# White card border:
is_card_border = (r > 180) & (g > 180) & (b > 180)
# Highlight reflection on green body has g > r + 30 and r < 140, which is NOT background.
# But pure pale bg has r > 160.
is_bg = is_pale_bg | is_card_border

# Mask out background
mask_arr[is_bg] = 0.0

# In the handle hole area:
# Ensure handle hole is clean:
mask_arr[76:106, 110:140][(r[76:106, 110:140] > 140)] = 0.0

# Re-close small holes inside body/screen
binary = mask_arr > 0.4
binary = ndimage.binary_fill_holes(binary)
binary[76:106, 110:140] = False # reopen handle hole

# Antialias with gaussian filter
alpha_float = ndimage.gaussian_filter(binary.astype(float), sigma=0.65)
final_alpha = np.clip(alpha_float * 255 * 1.15, 0, 255).astype(np.uint8)

im.putalpha(Image.fromarray(final_alpha, 'L'))
bbox = im.getbbox()
cropped = im.crop(bbox)

pad = 6
final_im = Image.new('RGBA', (cropped.width + pad*2, cropped.height + pad*2), (0, 0, 0, 0))
final_im.paste(cropped, (pad, pad))

final_im.save('scratch/test_hybrid.png')
print("Saved scratch/test_hybrid.png, size:", final_im.size)
