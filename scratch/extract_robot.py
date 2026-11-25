import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('public/assets/images/test_robot_cropped.png').convert('RGB')
arr = np.array(im, dtype=float)
h, w, _ = arr.shape
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# Let's define the robot color condition:
# 1. Dark screen:
is_screen = (r < 75) & (g < 85) & (b < 85)

# 2. Glowing cyan eyes/smile:
is_cyan_glow = (g > 160) & (b > 160) & (r < 120)

# 3. Green body & handle:
# emerald/teal: g > 80, g > r + 30, and not light mint background
is_green = (g > 70) & (g > r + 20) & (r < 115) & (g < 235)

# 4. Gold / bronze headphones/accents:
is_gold = (r > 90) & (g > 80) & (b < 140) & (r >= b - 10) & (r < 210) & (g < 200)

# 5. Bottom legs:
is_legs = (g > 60) & (g > r + 15) & (r < 110)

raw_robot = is_screen | is_cyan_glow | is_green | is_gold | is_legs

# Exclude outside borders / card borders:
# Card border in top-left is white: r > 200, g > 200, b > 200
is_white_card = (r > 195) & (g > 195) & (b > 195)
# Light mint background:
is_mint_bg = (r > 160) & (g > 200) & (b > 200)

# The shadow in the bottom right (outside the legs):
# legs are between x=65 and x=155.
# any shadow with x > 155 and y > 215 should be cut
mask = raw_robot & (~is_white_card) & (~is_mint_bg)

# Mask out bottom right background shadow
for y in range(h):
    for x in range(w):
        if x > 155 and y > 215:
            mask[y, x] = False
        if x < 40 and y > 215:
            mask[y, x] = False
        if y > 268: # below feet
            mask[y, x] = False

# Fill holes inside the robot (like inside the visor and body)
mask = ndimage.binary_fill_holes(mask)

# Morphological clean up: remove small noise specs
mask = ndimage.binary_opening(mask, structure=np.ones((3,3)))
mask = ndimage.binary_closing(mask, structure=np.ones((4,4)))
mask = ndimage.binary_fill_holes(mask)

# Keep only the largest connected component (the robot)
labeled, num_features = ndimage.label(mask)
sizes = ndimage.sum(mask, labeled, range(1, num_features + 1))
largest_label = np.argmax(sizes) + 1
robot_mask = (labeled == largest_label)
robot_mask = ndimage.binary_fill_holes(robot_mask)

# Smooth edges with slight gaussian blur for anti-aliasing
smooth_mask = ndimage.gaussian_filter(robot_mask.astype(float), sigma=0.7)
alpha = np.clip(smooth_mask * 255 * 1.1, 0, 255).astype(np.uint8)

# Construct RGBA image
rgba = np.dstack((arr.astype(np.uint8), alpha))
result = Image.fromarray(rgba, 'RGBA')

# Crop bounding box of robot with small padding
bbox = result.getbbox()
print("Robot bounding box:", bbox)
cropped_result = result.crop(bbox)

# Add 4px transparent padding around
pad = 6
final_im = Image.new('RGBA', (cropped_result.width + pad*2, cropped_result.height + pad*2), (0, 0, 0, 0))
final_im.paste(cropped_result, (pad, pad))

out_path = 'public/assets/images/oyopasal_robot_character.png'
final_im.save(out_path, 'PNG')
final_im.save('src/assets/images/oyopasal_robot_character.png', 'PNG')
print(f"Saved refined character! Size: {final_im.size}")
