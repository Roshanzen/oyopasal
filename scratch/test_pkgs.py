import sys

for pkg in ['rembg', 'cv2', 'scipy', 'sklearn', 'PIL', 'numpy']:
    try:
        __import__(pkg)
        print(f"{pkg}: available")
    except ImportError:
        print(f"{pkg}: NOT available")
