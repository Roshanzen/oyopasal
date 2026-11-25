import os
from PIL import Image
import numpy as np

src_jpg = r'C:/Users/acer/Downloads/Gemini_Generated_Image_dkhkk3dkhkk3dkhk.jpg'
if os.path.exists(src_jpg):
    src_im = Image.open(src_jpg)
    print("Source image size:", src_im.size)
else:
    print("Source image not found at Downloads")
