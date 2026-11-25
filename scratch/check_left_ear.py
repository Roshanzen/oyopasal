from PIL import Image
import numpy as np

im = Image.open('scratch/robot_source_crop.png').convert('RGB')
arr = np.array(im)

print("Near left ear (y=150):")
for x in range(30, 60, 2):
    print(f"  x={x}: {arr[150, x]}", end="")
