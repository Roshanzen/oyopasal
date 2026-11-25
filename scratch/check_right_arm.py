from PIL import Image
import numpy as np

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im)

for y in [180, 195, 210, 220, 230]:
    print(f"\ny={y}:")
    for x in range(180, 226, 2):
        print(f"  x={x}: {arr[y, x]}", end="")
