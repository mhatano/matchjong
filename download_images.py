import os
import urllib.request
import time

# 麻雀牌画像の保存先ディレクトリ
TARGET_DIR = "images"
# 画像のソースURL (karc/mj-tile-images を使用)
BASE_URL = "https://github.com/FluffyStuff/riichi-mahjong-tiles/blob/master/Export/Regular/"

# ファイル名のマッピング定義
# リモートのファイル名 -> ローカルのファイル名 (game.jsが期待する形式)
FILES_MAPPING = {}

# 萬子 (Manzu): man1.png -> m1.png
for i in range(1, 10):
    FILES_MAPPING[f"Man{i}.png?raw=true"] = f"m{i}.png"

# 筒子 (Pinzu): pin1.png -> p1.png
for i in range(1, 10):
    FILES_MAPPING[f"Pin{i}.png?raw=true"] = f"p{i}.png"
# 索子 (Souzu): sou1.png -> s1.png
for i in range(1, 10):
    FILES_MAPPING[f"Sou{i}.png?raw=true"] = f"s{i}.png"

# 字牌 (Jihai): ji1.png -> z1.png ... ji7.png -> z7.png
FILES_MAPPING[f"Ton.png?raw=true"] = f"z1.png"
FILES_MAPPING[f"Nan.png?raw=true"] = f"z2.png"
FILES_MAPPING[f"Shaa.png?raw=true"] = f"z3.png"
FILES_MAPPING[f"Pei.png?raw=true"] = f"z4.png"
FILES_MAPPING[f"Haku.png?raw=true"] = f"z5.png"
FILES_MAPPING[f"Hatsu.png?raw=true"] = f"z6.png"
FILES_MAPPING[f"Chun.png?raw=true"] = f"z7.png"
def main():
    # ディレクトリが存在しない場合は作成
    if not os.path.exists(TARGET_DIR):
        try:
            os.makedirs(TARGET_DIR)
            print(f"ディレクトリを作成しました: {TARGET_DIR}")
        except OSError as e:
            print(f"ディレクトリの作成に失敗しました: {e}")
            return

    print(f"画像をダウンロードしています... (保存先: {TARGET_DIR}/)")
    print(f"取得元: {BASE_URL}")
    
    success_count = 0
    for remote_name, local_name in FILES_MAPPING.items():
        url = BASE_URL + remote_name
        save_path = os.path.join(TARGET_DIR, local_name)
        
        try:
            print(f"ダウンロード中: {remote_name} -> {local_name} ...", end="")
            urllib.request.urlretrieve(url, save_path)
            print(" 完了")
            success_count += 1
            # サーバーへの負荷軽減のため少し待機
            time.sleep(0.1)
        except Exception as e:
            print(f" 失敗: {e}")

    print(f"\n処理が完了しました。 {len(FILES_MAPPING)} 個中 {success_count} 個の画像をダウンロードしました。")

if __name__ == "__main__":
    main()