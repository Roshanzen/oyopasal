import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im, dtype=float)
h, w, _ = arr.shape
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# Let's inspect the right arm:
# The right arm has a metallic gold wristband and green tip.
# Right arm boundary:
# Let's inspect lines at y = 140..220 and x = 180..245
print(f"Image shape: {h}x{w}")
