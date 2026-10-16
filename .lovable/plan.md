# Đăng nhập bằng Passkey (Face ID / vân tay)

## Người dùng sẽ thấy
- Trang Cá nhân: thẻ mới "Passkey" — nút "Thêm passkey" (Face ID, Touch ID, vân tay, Windows Hello), danh sách passkey đã thêm (tên thiết bị, ngày thêm, lần dùng gần nhất), nút xoá. Tối đa 10 passkey mỗi tài khoản.
- Màn đăng nhập: nút "Đăng nhập bằng passkey" dưới nút Google. Bấm → điện thoại hỏi Face ID/vân tay → vào app luôn, không cần gõ email.
- Trình duyệt hỗ trợ thì ô email còn gợi ý passkey tự động (autofill).
- Passkey chỉ thêm được sau khi đã đăng nhập (liên kết vào tài khoản có sẵn), giống cách làm với Telegram.

## Cách hoạt động
```text
Thêm:  Cá nhân -> máy chủ tạo thử thách -> thiết bị ký -> máy chủ kiểm tra, lưu khoá công khai
Vào:   Đăng nhập -> máy chủ tạo thử thách -> thiết bị ký bằng Face ID -> máy chủ kiểm tra -> tạo phiên đăng nhập
```

## Technical details
- Package `@simplewebauthn/server` + `@simplewebauthn/browser` (chạy được trên Worker, dùng WebCrypto).
- Migration `0010_passkeys`:
  - `passkeys` (id, user_id, credential_id unique, public_key bytea, counter, transports, device_name, created_at, last_used_at); RLS: chủ sở hữu chỉ SELECT; xoá qua RPC `passkey_delete(p_id)` SECURITY DEFINER.
  - `passkey_challenges` (id, user_id null, challenge, purpose register|login, expires_at 5 phút, used_at); chỉ service_role ghi. Dọn rác trong job cleanup hàng ngày.
- `src/lib/passkey.functions.ts` (createServerFn):
  - `startPasskeyRegister` / `finishPasskeyRegister` — `requireSupabaseAuth`; RP ID theo host yêu cầu (money.tyvn.online, cap-money.lovable.app, preview), origin kiểm tra danh sách cho phép.
  - `startPasskeyLogin` / `finishPasskeyLogin` — công khai; kiểm tra chữ ký + counter, challenge dùng một lần; thành công thì tạo phiên giống luồng Telegram (admin `generateLink` magiclink → trả token_hash → client `verifyOtp`). Tài khoản không có email không dùng được (như Telegram).
- Components: `src/components/passkey/passkey-login.tsx` (nút trên /auth), `src/components/passkey/passkey-manager.tsx` (thẻ trong profile) — dùng Button/Card có sẵn; route chỉ gắn component.
- Báo lỗi tiếng Việt: trình duyệt không hỗ trợ, người dùng huỷ, passkey không thuộc tài khoản nào.
- Lưu ý: passkey gắn với tên miền — tạo trên money.tyvn.online chỉ dùng được ở đó, không dùng ở bản xem trước.
- Kiểm tra: test đơn vị cho kiểm tra origin/RP ID và challenge hết hạn/dùng lại; chạy lint:architecture, duplication:check, vitest; AGENTS.md thêm rule passkey dùng chung đường tạo phiên với Telegram.
