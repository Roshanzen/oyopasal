from PIL import Image

src = Image.open(r'C:/Users/acer/Downloads/Gemini_Generated_Image_dkhkk3dkhkk3dkhk.jpg')
# crop around (2920-100, 1190-140) to (2920+150, 1190+150)
box = (2800, 1050, 3050, 1340)
cropped = src.crop(box)
cropped.save('scratch/robot_source_crop.png')
print("Saved robot_source_crop.png, size:", cropped.size)
