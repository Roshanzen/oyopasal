from PIL import Image
import numpy as np

for name in ['Gemini_Generated_Image_dkhkk3dkhkk3dkhk.jpg', 'Gemini_Generated_Image_bhvjvdbhvjvdbhvj.jpg']:
    path = r'C:/Users/acer/Downloads/' + name
    im = Image.open(path).convert('RGB')
    arr = np.array(im)
    crop = Image.open('public/assets/images/test_robot_cropped.png').convert('RGB')
    carr = np.array(crop)
    # let's find exact or closest match of top 10x10 of robot face
    # face visor center: row 140, col 100 in crop
    needle = carr[135:145, 95:105]
    print(f"Testing {name}...")
    min_diff = 999999
    best_loc = None
    for y in range(0, arr.shape[0] - 10, 10):
        for x in range(1500, arr.shape[1] - 10, 10):
            diff = np.mean(np.abs(arr[y:y+10, x:x+10].astype(float) - needle.astype(float)))
            if diff < min_diff:
                min_diff = diff
                best_loc = (x, y)
    print(f"{name}: best diff {min_diff} at {best_loc}")
