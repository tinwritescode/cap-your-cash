## Chỉnh theme Giáng sinh

1. **Màu đỏ dịu hơn — đỏ rượu vang trầm**: hạ độ sáng và độ rực của màu Noel (từ 0.64/0.20 xuống khoảng 0.50/0.14, sắc hơi ngả vang ~15). Nút, nút "Ghi giao dịch", biểu đồ đều đổi theo. Gradient bóng của nút trong theme Noel giảm độ sáng điểm nhấn để không loá. Vẫn kiểm tra tương phản chữ ≥ 4.5:1 cả sáng/tối.
2. **Nón Noel ngay ngắn**: vẽ lại nón cân đối hơn (vành trắng nằm ngang ôm sát mép trên logo, chóp đỏ rượu vang đổ nhẹ sang phải, quả bông tròn), bỏ xoay nghiêng; căn lại vị trí ở logo thanh bên và màn đăng nhập.
3. **Thay dây kim tuyến bằng dải đèn nhỏ tối giản**: bỏ ảnh dây kim tuyến, thay bằng một sợi dây mảnh võng nhẹ với 9–12 bóng đèn tròn nhỏ (đỏ vang, xanh thông, vàng ấm, trắng) nhấp nháy rất chậm; tắt nhấp nháy khi máy bật giảm chuyển động. Giữ tuyết rơi.

### Kỹ thuật
- `src/lib/themes.ts`: palette noel `{l≈0.5, c≈0.14, h≈15}`; chạy themes.test.
- `src/styles.css`: dịu highlight nút trong `.noel`; keyframes `bulb-twinkle` + reduced-motion.
- `src/components/noel-decor.tsx`: `StringLights` SVG thay `<img garland>`, `SantaHat` path mới không rotate; cập nhật className trong `shell.tsx`/`FestiveLogo`; xoá `src/assets/noel-garland.png`.
- Kiểm tra bằng ảnh chụp màn hình sáng/tối; chạy lint:architecture.
