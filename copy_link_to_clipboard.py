import sys

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QMimeData


class Error(Exception): pass


def copy_link_to_clipboard(name: str, url: str):
    app = QApplication([])  # 这个变量必须保留，不然后面无法查询
    if not (clipboard := app.clipboard()):
        raise Error("获取剪贴板失败")

    html = f"""<meta charset='utf-8'><html><head></head><body><a href="{url}">{name}</a></body></html>"""
    mimedata = QMimeData()
    mimedata.setText(url)
    mimedata.setHtml(html)
    clipboard.setMimeData(mimedata)
    print("链接已写入剪贴板")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        name, url = sys.argv[1:3]
    else:
        name, url = input("name:"), input("url:")
    copy_link_to_clipboard(name=name, url=url)
