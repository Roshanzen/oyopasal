import os
from PIL import Image

src_jpg = r'C:/Users/acer/Downloads/Gemini_Generated_Image_dkhkk3dkhkk3dkhk.jpg'
src_im = Image.open(src_jpg)
w, h = src_im.size

# In the previous session, the robot was found in the rightmost card.
# Let's inspect the rightmost portion of the image, e.g. x between 2200 and 3078, y between 300 and 1200
# Let's save a thumbnail or find the exact box
print(f"Image dimensions: {w}x{h}")

# Let's check test_robot_cropped.png if it exists
if os.path.exists('public/assets/images/test_robot_cropped.png'):
    crop_im = Image.open('public/assets/images/test_robot_cropped.png')
    print("test_robot_cropped.png size:", crop_im.size)
