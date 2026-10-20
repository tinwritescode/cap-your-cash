# Ghi giao dịch bằng giọng nói

Thêm chế độ "Giọng nói" vào màn ghi giao dịch, giống ảnh mẫu: nói "tiền nhà ba củ", "hai xị", "cà phê ba chục" → app hiểu số tiền, danh mục, ví rồi điền sẵn form để bạn kiểm tra và bấm Lưu.

## Trải nghiệm
- Thanh dưới màn ghi có 3 lựa chọn: **Nhập tay · Giọng nói · Hình ảnh** (Hình ảnh = camera hiện tại).
- Chế độ Giọng nói: vòng tròn vạch lớn với chấm đỏ ở giữa; bấm để bắt đầu nói, bấm lại để dừng. Vòng vạch nhảy theo âm lượng khi nói.
- Câu nói hiện chữ ngay dưới vòng tròn sau khi nhận diện.
- Hiểu cách nói đời thường: củ/triệu, xị/trăm nghìn, chai/triệu, lít/trăm nghìn, chục/chục nghìn, "rưỡi", "k", "tr".
- Tự chọn Chi tiêu/Thu nhập theo câu nói (vẫn đổi tay được). Có thể nhắc tên ví ("ví tiền mặt").
- Luôn mở form đã điền sẵn để xác nhận — không tự lưu.
- Báo lỗi tiếng Việt nếu chưa cấp quyền micro, không nghe rõ, hoặc hết credit AI.

## Chi phí
Mỗi lần nói tốn một ít credit AI của workspace (chuyển giọng nói thành chữ + đọc hiểu), giống bot Telegram.

## Technical details
- `src/components/voice-capture.tsx`: MediaRecorder (webm/mp4 tùy trình duyệt) + AnalyserNode cho vòng vạch; giới hạn 30 giây.
- Server route `src/routes/api/public/voice/parse.ts` (multipart; xác minh bearer token người dùng trong handler): chuyển giọng nói `openai/gpt-transcribe` → đọc hiểu tái dùng `understand()` trong `src/lib/telegram/ai.server.ts`, bổ sung từ lóng tiền Việt vào prompt; trả `{ text, type, amount, categoryId, walletId, note }`. Không lưu âm thanh.
- `composer.tsx`: stage `camera | voice | manual | form`; thanh chọn chế độ dùng component riêng; kết quả giọng nói prefill form, ghi vẫn qua RPC hiện có.
- Hàm chuẩn hoá tiền lóng (fallback khi AI trả chữ) + test: "ba củ"=3.000.000, "hai xị"=200.000, "hai chai rưỡi"=2.500.000, "ba chục"=30.000, "35k"=35.000.
- Chạy tsgo, lint:architecture, duplication:check, vitest.
