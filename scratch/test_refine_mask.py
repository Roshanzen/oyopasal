from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im, dtype=float)
h, w, _ = arr.shape
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# Let's create an initial mask of non-background
# 1. Background colors:
# Pale mint background:
is_mint = (r > 150) & (g > 190) & (b > 180)
# Top-left white card:
is_card = (r > 185) & (g > 185) & (b > 185)
# Card stripe boundary:
is_stripe = (x_grid := np.tile(np.arange(w), (h, 1))) < 75
is_card_left = is_stripe & (r > 170) & (g > 180)

# Outside background:
is_bg = is_mint | is_card | is_card_left

# Background flood-fill from edges:
# Seed points: corners
bg_seeds = np.zeros((h, w), dtype=bool)
bg_seeds[0, :] = True
bg_seeds[-1, :70] = True # bottom left
bg_seeds[:, 0] = True
bg_seeds[:60, -1] = True # top right
# and inside the handle loop:
bg_seeds[85:98, 120:135] = True

# Also the card graphic on bottom right:
# The robot's right arm ends around y=225, x=215.
# Behind the right arm and right of the legs (x > 180, y > 225) is the background circle
is_dark_bg_circle = (x_grid > 175) & (np.repeat(np.arange(h)[:, None], w, axis=1) > 225)
# And between right arm and right leg:
# right leg is x ~ 140..170, y ~ 235..275.
# space to the right of right leg:
is_right_of_leg = (x_grid > 175) & (np.repeat(np.arange(h)[:, None], w, axis=1) > 220)

robot_mask = ~(is_bg | is_dark_bg_circle | is_right_of_leg)

# Let's inspect the right arm:
# The right arm is between x=170..215 and y=160..225.
# Let's ensure right arm is preserved:
# Right arm has green body / gold band:
is_right_arm = (x_grid >= 170) & (x_grid <= 218) & (np.repeat(np.arange(h)[:, None], w, axis=1) >= 160) & (np.repeat(np.arange(h)[:, None], w, axis=1) <= 226) & (g > r + 15) & (r < 120)
robot_mask[is_right_arm] = True

# Fill holes inside robot body and visor
robot_mask = ndimage.binary_fill_holes(robot_mask)
# Handle loop: ensure the hole inside handle is hollow
# handle center: x=122..135, y=82..102
robot_mask[80:102, 116:140] = False

# Morphological smoothing
robot_mask = ndimage.binary_opening(robot_mask, structure=np.ones((2,2)))
robot_mask = ndimage.binary_closing(robot_mask, structure=np.ones((3,3)))

# Keep main connected component
labeled, num_features = ndimage.label(robot_mask)
sizes = ndimage.sum(robot_mask, labeled, range(1, num_features + 1))
largest_label = np.argmax(sizes) + 1
robot_mask = (labeled == largest_label)
robot_mask = ndimage.binary_fill_holes(robot_mask)
robot_mask[80:102, 116:140] = False # reopen handle hole

# Gaussian filter for anti-aliased edge
smooth = ndimage.gaussian_filter(robot_mask.astype(float), sigma=0.65)
alpha = np.clip(smooth * 255 * 1.15, 0, 255).astype(np.uint8)

# Bounding box crop
rgba = np.dstack((arr.astype(np.uint8), alpha))
result = Image.fromarray(rgba, 'RGBA')
bbox = result.getbbox()
cropped = result.crop(bbox)

# Add 4px margin
pad = 6
final_im = Image.new('RGBA', (cropped.width + pad*2, cropped.height + pad*2), (0, 0, 0, 0))
final_im.paste(cropped, (pad, pad))

final_im.save('scratch/test_refined.png')
print("Saved scratch/test_refined.png, size:", final_im.size)
