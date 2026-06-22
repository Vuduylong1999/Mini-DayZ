# Mini DAYZ (Web)

Phiên bản web của game **Mini DAYZ** (Bohemia Interactive), trích xuất từ APK Android.
Game được build bằng [Construct 2](https://www.construct.net/) (HTML5 runtime `c2runtime.js`) và đóng gói qua Cordova/Crosswalk để chạy trên Android. Repo này cho phép chạy lại nội dung web đó trực tiếp trong trình duyệt.

> Phiên bản: 1.4.1 — package gốc `com.bistudio.minidayz`

## Yêu cầu

- [Node.js](https://nodejs.org/) (đã test trên v24)
- Trình duyệt hiện đại (Chrome/Edge/Firefox)

## Chạy game

```bash
node serve-web.js
```

Sau đó mở trình duyệt tại:

- **http://localhost:8080/play-web.html** — bản web canvas (khuyến nghị)
- http://localhost:8080/play-gl.html — bản WebGL (thử nếu bản trên chạy giật)
- http://localhost:8080/ — tự chuyển hướng về `play-web.html`

Dừng server: nhấn `Ctrl+C` trong terminal.

### Đổi cổng

Sửa biến `PORT` trong [serve-web.js](serve-web.js#L8) (mặc định `8080`).

## Cấu trúc thư mục

| Đường dẫn | Mô tả |
|-----------|-------|
| [serve-web.js](serve-web.js) | Web server tĩnh tối giản (Node `http`), phục vụ thư mục `assets/www` |
| [assets/www/](assets/www/) | Toàn bộ nội dung game HTML5 (Construct 2) |
| `assets/www/c2runtime.js` | Runtime/engine Construct 2 — logic chính của game |
| `assets/www/data.js` | Dữ liệu game |
| `assets/www/images/` | Tài nguyên hình ảnh (spritesheet) |
| `assets/www/l_*.xml` | File ngôn ngữ (eng, de, es, fr, it, pt, cz...) |
| `assets/www/keyboard-controls.js` | Điều khiển bàn phím cho bản web |
| `AndroidManifest.xml`, `classes.dex`, `lib/`, `res/` | Phần còn lại của APK Android gốc (không dùng cho bản web) |

## Ghi chú

- Server có chống path traversal cơ bản và set header `no-cache`.
- File `*.bak` (`c2runtime.js.bak`, `data.js.bak`) là bản gốc trước khi chỉnh sửa cho web — giữ lại để tham chiếu.
- Đây là nội dung trích xuất từ một game thương mại; chỉ dùng cho mục đích cá nhân/học tập.
