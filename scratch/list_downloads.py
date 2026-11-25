import os
import glob
from PIL import Image

files = glob.glob(r'C:/Users/acer/Downloads/*.jpg') + glob.glob(r'C:/Users/acer/Downloads/*.png')
for f in files:
    try:
        im = Image.open(f)
        print(os.path.basename(f), im.size)
    except Exception as e:
        pass
