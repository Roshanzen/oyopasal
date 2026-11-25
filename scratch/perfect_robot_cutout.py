from PIL import Image
import numpy as np
from scipy import ndimage

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im, dtype=float)
h, w, _ = arr.shape
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# Let's inspect the background colors:
# Outer background:
# Top/left/right background has high lightness:
gray = 0.299*r + 0.587*g + 0.114*b

# Pale mint/white background is very bright (gray > 185)
is_bright_bg = (gray > 180)

# Inside the handle hole:
# Seed at (y=92, x=125)
handle_hole_mask = np.zeros((h, w), dtype=bool)
# Expand from seed while gray > 175 and within the handle region (y: 75..110, x: 95..155)
queue = [(92, 125)]
visited = set(queue)
while queue:
    cy, cx = queue.pop(0)
    handle_hole_mask[cy, cx] = True
    for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
        ny, nx = cy + dy, cx + dx
        if 75 <= ny <= 110 and 100 <= nx <= 150 and (ny, nx) not in visited:
            visited.add((ny, nx))
            # The mint color inside handle hole has gray > 175
            if gray[ny, nx] > 170:
                queue.append((ny, nx))

# Now outside the robot:
# Flood fill from the four corners and border pixels
outer_bg_mask = np.zeros((h, w), dtype=bool)
outer_queue = []
for x in range(w):
    outer_queue.append((0, x))
    outer_queue.append((h-1, x))
for y in range(h):
    outer_queue.append((y, 0))
    outer_queue.append((y, w-1))

visited_outer = set(outer_queue)
# Also add top-left card elements
while outer_queue:
    cy, cx = outer_queue.pop(0)
    outer_bg_mask[cy, cx] = True
    for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < h and 0 <= nx < w and (ny, nx) not in visited_outer:
            visited_outer.add((ny, nx))
            # Flood into bright pixels (mint background or white card)
            if gray[ny, nx] > 170:
                outer_queue.append((ny, nx))

# Now let's address the card graphic on the bottom right (outside the robot):
# Let's see: the robot's right arm:
# The right arm extends down to y ~ 222, and hand ends around x ~ 214.
# Any dark green background to the right of the right arm (x > 215, y > 180) or below the right arm (y > 222 and x > 170) is card background!
# Let's smooth-contour the underside of the right arm and right side of legs:
is_card_bg_circle = np.zeros((h, w), dtype=bool)
for y in range(h):
    for x in range(w):
        # Below right arm and to the right of legs:
        # Legs are between x=70 and x=165, y up to 275
        if y > 222 and x > 165:
            is_card_bg_circle[y, x] = True
        # Below feet:
        if y > 275:
            is_card_bg_circle[y, x] = True
        # Right of right arm:
        if x > 220 and y > 180:
            is_card_bg_circle[y, x] = True
        # Far right edge:
        if x > 230:
            is_card_bg_circle[y, x] = True
        # Far left edge:
        if x < 25:
            is_card_bg_circle[y, x] = True

# Also ensure smooth curve under the right arm:
# Let's check arm underside between x=175 and x=215, y between 195 and 224:
# If y > 195 and it's outside the arm contour:
# Notice arm has a distinct gold/metallic band at y ~ 210, x ~ 195..210:
# Let's inspect the arm pixels

raw_robot = ~(outer_bg_mask | handle_hole_mask | is_card_bg_circle)

# Morphological clean up
raw_robot = ndimage.binary_fill_holes(raw_robot)
# Remove the handle hole again cleanly
raw_robot[handle_hole_mask] = False

# Label and keep only main robot body
labeled, num_features = ndimage.label(raw_robot)
sizes = ndimage.sum(raw_robot, labeled, range(1, num_features + 1))
largest_label = np.argmax(sizes) + 1
robot_mask = (labeled == largest_label)
robot_mask = ndimage.binary_fill_holes(robot_mask)
robot_mask[handle_hole_mask] = False

# Antialiasing:
smooth = ndimage.gaussian_filter(robot_mask.astype(float), sigma=0.6)
alpha = np.clip(smooth * 255 * 1.15, 0, 255).astype(np.uint8)

# Combine
rgba = np.dstack((arr.astype(np.uint8), alpha))
im_rgba = Image.fromarray(rgba, 'RGBA')
bbox = im_rgba.getbbox()
cropped = im_rgba.crop(bbox)

# Add margin
margin = 6
final_im = Image.new('RGBA', (cropped.width + margin*2, cropped.height + margin*2), (0, 0, 0, 0))
final_im.paste(cropped, (margin, margin))

final_im.save('public/assets/images/oyopasal_robot_character.png', 'PNG')
final_im.save('src/assets/images/oyopasal_robot_character.png', 'PNG')
print(f"Generated clean robot character: {final_im.size}")
