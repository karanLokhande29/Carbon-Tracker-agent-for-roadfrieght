import traceback
from app.services.tft_service import TFTService

try:
    t = TFTService('models/tft_best-82-0.1107.ckpt', 'data/')
    print("TFT instantiation succeeded.")
except Exception as e:
    traceback.print_exc()
