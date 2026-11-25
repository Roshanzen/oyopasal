import os
from PIL import Image, ImageFilter
import numpy as np

img_path = r'public/assets/images/oyopasal_robot_character.png'
im = Image.open(img_path).convert('RGBA')
w, h = im.size
print(f"Original size: {w}x{h}")

data = np.array(im)
r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Let's inspect where alpha > 0
# Notice the top-left vertical white edge:
# Let's find columns where x < 30 and y < 80 with high brightness / white
# Also the right-side shadow/halo: notice the halo has light teal/green colors (e.g. g > 150, r > 100, b > 150) that are outside the main robot body
# Let's write an inspection script to analyze the pixels and produce a clean mask.

# Let's save a copy and print some stats
print("Non-zero alpha count:", np.sum(a > 0))
