from PIL import Image
import numpy as np

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im)

for y in [180, 195, 210, 225, 240]:
    row = arr[y, 160:240]
    # find where arm is and where backdrop is
    print(f"\ny={y}:")
    for dx, (r, g, b) in enumerate(row):
        x = 160 + dx
        # print interesting points
        if dx % 4 == 0:
            print(f"  x={x}: ({r},{g},{b})", end="")
