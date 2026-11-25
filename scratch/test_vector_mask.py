from PIL import Image, ImageDraw, ImageFilter
import numpy as np

im = Image.open('scratch/robot_source_crop.png').convert('RGBA')
w, h = im.size

# Let's create a high-resolution mask using PIL ImageDraw on 4x supersampled canvas for ultra-smooth anti-aliased curves
scale = 4
mask_img = Image.new('L', (w * scale, h * scale), 0)
draw = ImageDraw.Draw(mask_img)

# Let's define the robot parts in scaled coordinates:
def S(x, y):
    return (int(x * scale), int(y * scale))

# 1. Main body (rounded torso + head):
# Head & Torso is a rounded rectangle from x=48..202, y=105..228
draw.rounded_rectangle([S(48, 105), S(202, 226)], radius=int(32 * scale), fill=255)

# 2. Top handle loop:
# Outer loop:
draw.ellipse([S(92, 65), S(162, 125)], fill=255)
# Torso overlays bottom of handle
draw.rounded_rectangle([S(48, 105), S(202, 226)], radius=int(32 * scale), fill=255)

# 3. Left ear headphone:
draw.ellipse([S(32, 128), S(66, 178)], fill=255)

# 4. Right ear headphone:
draw.ellipse([S(184, 128), S(218, 178)], fill=255)

# 5. Left arm:
# Arm extends from shoulder (65, 155) down-left to hand (38, 218)
left_arm_pts = [
    S(68, 155),
    S(50, 168),
    S(34, 195),
    S(36, 214),
    S(46, 222),
    S(58, 216),
    S(72, 185),
    S(78, 165),
]
draw.polygon(left_arm_pts, fill=255)
# rounded hand tip
draw.ellipse([S(33, 198), S(56, 222)], fill=255)

# 6. Right arm:
# Arm extends from shoulder (182, 155) down-right to hand (216, 218)
right_arm_pts = [
    S(182, 155),
    S(200, 168),
    S(216, 195),
    S(218, 212),
    S(208, 222),
    S(196, 216),
    S(178, 185),
    S(172, 165),
]
draw.polygon(right_arm_pts, fill=255)
# rounded hand tip
draw.ellipse([S(194, 198), S(220, 222)], fill=255)

# 7. Left leg:
draw.rounded_rectangle([S(80, 218), S(116, 272)], radius=int(14 * scale), fill=255)

# 8. Right leg:
draw.rounded_rectangle([S(134, 218), S(170, 272)], radius=int(14 * scale), fill=255)

# 9. Now carve out the handle hole (inner arch):
draw.ellipse([S(112, 82), S(142, 110)], fill=0)

# Resize mask with high-quality Lanczos/Bicubic resampling to get pristine anti-aliasing
smooth_mask = mask_img.resize((w, h), Image.Resampling.LANCZOS)

# Apply mask to image
im.putalpha(smooth_mask)

# Crop to tight bounding box with 6px margin
bbox = im.getbbox()
cropped = im.crop(bbox)
pad = 6
final_im = Image.new('RGBA', (cropped.width + pad*2, cropped.height + pad*2), (0, 0, 0, 0))
final_im.paste(cropped, (pad, pad))

final_im.save('scratch/test_vector_mask.png')
print("Saved scratch/test_vector_mask.png, size:", final_im.size)
