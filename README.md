# Lịch thi đấu LMHT — MSI & LCK

Trang web hiển thị lịch thi đấu, kết quả, và trận đang live của MSI và LCK, dùng Cloudflare Workers + D1.

## Cách nhanh nhất: bấm 1 nút

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<your-github-username>/<your-repo-name>)

Bấm nút trên sẽ tự động:
- Fork/clone repo này vào GitHub của bạn
- **Tự tạo D1 database mới** trên tài khoản Cloudflare của bạn và tự điền vào `wrangler.toml`
- Tự chạy migration tạo bảng (`migrations/0001_init.sql`)
- Deploy Worker luôn, không cần cài Wrangler hay gõ lệnh gì

Sau đó bạn chỉ cần làm 2 việc thủ công: đổi `SYNC_TOKEN` trong Cloudflare dashboard (Settings → Variables), và gọi `/api/sync` một lần để có dữ liệu ngay (xem bước 5 bên dưới).

> Nhớ thay `<your-github-username>/<your-repo-name>` ở link trên thành repo thật của bạn sau khi push lên GitHub.

## Cách thủ công (nếu không dùng nút)



```
worker/
  index.js
  schema.sql           Tham khảo / chạy tay nếu muốn
  migrations/
    0001_init.sql        Dùng bởi `wrangler d1 migrations apply` (và Deploy button)
  package.json
  wrangler.toml
frontend/
  App.jsx
```

## Yêu cầu

- Tài khoản Cloudflare (Workers + D1)
- [Node.js](https://nodejs.org/) và `npm install -g wrangler`

## Cài đặt

### 1. Tạo D1 database

```bash
cd worker
wrangler d1 create lol-schedule-db
```

Copy `database_id` được trả về, dán vào `wrangler.toml` (thay vào chỗ `database_id = ""`).

### 2. Tạo bảng

```bash
wrangler d1 migrations apply DB --remote
```

### 3. Đổi token bí mật

Trong `wrangler.toml`, đổi `SYNC_TOKEN` thành một chuỗi ngẫu nhiên của riêng bạn (dùng để gọi sync thủ công, tránh để mặc định).

### 4. Deploy Worker

```bash
npm run deploy
```

Cron Trigger sẽ tự chạy mỗi phút (tự bỏ qua nếu không có trận live, xem comment trong `index.js`).

### 5. Sync dữ liệu lần đầu (không cần đợi cron)

```bash
curl -X POST "https://<worker-url>/api/sync?token=<SYNC_TOKEN-của-bạn>"
```

### 6. Cấu hình frontend

Trong `frontend/App.jsx`, sửa dòng:

```js
const API_BASE = "https://lol-schedule-worker.YOUR-SUBDOMAIN.workers.dev";
```

thành URL Worker thật của bạn.

### 7. Deploy frontend lên Cloudflare Pages

Đưa `frontend/App.jsx` vào project React/Vite của bạn (hoặc dùng nguyên trong Claude Artifact để xem trước), rồi deploy như một Pages project bình thường.

## Ghi chú

- Nguồn dữ liệu: [Leaguepedia Cargo API](https://lol.fandom.com/wiki/Special:CargoTables) — miễn phí, không cần key.
- Badge đội hiện dùng màu + chữ viết tắt thay vì logo ảnh thật (tránh lỗi hotlink/CORS). Muốn dùng logo thật: tự tải ảnh, lưu vào Cloudflare R2 hoặc thư mục `public/` của Pages, rồi map tên đội → URL ảnh trong `TEAM_STYLE` (file `App.jsx`).
- Muốn theo dõi thêm giải khác: thêm vào object `TOURNAMENTS` trong `worker/index.js` với tên giải đúng như trên Leaguepedia.

## License

Tự do dùng, sửa, fork.
