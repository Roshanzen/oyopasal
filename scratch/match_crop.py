import numpy as np
from PIL import Image

src_im = Image.open(r'C:/Users/acer/Downloads/Gemini_Generated_Image_dkhkk3dkhkk3dkhk.jpg')
arr = np.array(src_im)
H, W, _ = arr.shape

# Let's search where test_robot_cropped comes from in arr
crop_im = Image.open('public/assets/images/test_robot_cropped.png').convert('RGB')
crop_arr = np.array(crop_im)
ch, cw, _ = crop_arr.shape

# Let's match a small 20x20 patch from the robot's smiling face
# face screen center
patch = crop_arr[130:150, 90:110]
diffs = []
# search in the right half of the image
for y in range(200, 1000, 5):
    for x in range(1800, W - cw, 5):
        sub = arr[y:y+20, x:x+20]
        err = np.mean(np.abs(sub.astype(float) - patch.astype(float)))
        if err < 5:
            diffs.append((err, x - 90, y - 130))

diffs.sort()
print("Top matches (err, x, y):", diffs[:5])
