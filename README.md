# VoiceAI Frontend (React + Vite)

Giao diện này cung cấp trang builder/workflow, trang đăng nhập và trang thử nghiệm Voice AI realtime.
Tài liệu dưới đây giúp bạn cài đặt, cấu hình và chạy cục bộ nhanh chóng.

## 1. Yêu cầu hệ thống
- Node.js **18.x** hoặc mới hơn (đã thử với 18.20 / 20.17).
- npm đi kèm Node (hoặc pnpm/yarn nếu bạn quen dùng, ví dụ pnpm 9+).
- Backend đang chạy ở `http://localhost:8000` (có thể đổi qua biến môi trường).

## 2. Cài đặt phụ thuộc
```powershell
cd Frontend
npm install
```
Lệnh trên kéo toàn bộ dependencies (React, Vite, Tailwind, react-icons, Zustand, v.v.).
Nếu bạn dùng pnpm:
```powershell
pnpm install
```

## 3. Biến môi trường
Sao chép mẫu `cp .env.local.example .env.local` rồi điền các giá trị thực tế. Ví dụ nội dung:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VOICE_WS_URL=ws://localhost:8000/ws/call/audio
VITE_WS_LOGS_URL=ws://localhost:8000/ws/logs
```
- `VITE_API_BASE_URL` → URL REST backend.
- `VITE_VOICE_WS_URL` → WebSocket xử lý realtime voice.
- `VITE_WS_LOGS_URL` → WebSocket đọc log nếu bạn bật tính năng đó.
- Các biến khác (Supabase, OAuth) bổ sung nếu tính năng tương ứng được bật trên backend.

## 4. Scripts thường dùng
| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Khởi động Vite dev server (mặc định http://localhost:5173). |
| `npm run build` | Build production ra thư mục `dist/`. |
| `npm run preview` | Chạy thử bản build. |
| `npm run lint` (nếu có) | Kiểm tra lint. |

> Nếu `package.json` của bạn chưa có script `dev`, thêm dòng sau vào phần `scripts`:
> ```json
> "dev": "vite"
> ```

## 5. Chạy ứng dụng
```powershell
# 1. Chuẩn bị .env.local như ở trên
# 2. Khởi động backend (uvicorn) trước
cd Frontend
npm run dev
```
Sau đó mở trình duyệt tại `http://localhost:5173`. Nếu cần custom port, dùng `npm run dev -- --port 4173`.

## 6. Build & deploy tĩnh
```powershell
npm run build
npm run preview  # kiểm tra dist trước khi deploy
```
Copy thư mục `dist/` lên CDN / bucket / hosting tuỳ môi trường. Nhớ cập nhật biến môi trường runtime (VD: Vercel, Netlify) để khớp backend.

## 7. Troubleshooting
- **`npm run dev` báo Missing script** → kiểm tra lại mục Scripts trong `package.json` (đảm bảo có `"dev": "vite"`).
- **Cannot GET /api ...** → kiểm tra `VITE_API_BASE_URL` và xem backend có bật CORS cho origin của frontend hay chưa.
- **WebSocket không kết nối** → xác minh `VITE_WS_URL`, backend có expose `/ws/call/audio` hoặc endpoint cần dùng.
- **Tailwind class không áp dụng** → đảm bảo file `src/global.css` được import trong `src/main.tsx`.
- **Không resolve module sau khi refactor** → chạy `npm run build` để xem chi tiết error, kiểm tra lại alias trong `tsconfig.app.json` nếu bạn di chuyển folder.

## 8. Liên kết hữu ích
- [Vite Docs](https://vitejs.dev/guide/)
- [React Router](https://reactrouter.com/)
- [TailwindCSS](https://tailwindcss.com/docs/installation)
- [Supabase JS](https://supabase.com/docs/guides/client-libraries/javascript)

Các ghi chú bổ sung (biểu tượng, UI voice_ai.html, vv.) nên được cập nhật trong repo nếu bạn thay đổi tính năng. Thắc mắc thêm → mở issue hoặc liên hệ nhóm dự án.
