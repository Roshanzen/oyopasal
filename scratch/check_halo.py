from PIL import Image
import numpy as np

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im)

print("Near right of handle (y=90):")
for x in range(140, 175, 4):
    print(f"  x={x}: {arr[90, x]}", end="")

print("\n\nNear right ear (y=150):")
for x in range(195, 230, 4):
    print(f"  x={x}: {arr[150, x]}", end="")

print("\n\nRight arm tip (y=210):")
for x in range(185, 225, 4):
    print(f"  x={x}: {arr[210, x]}", end="")
