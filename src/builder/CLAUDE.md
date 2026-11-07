# Role 1 (Rocket Builder): sổ tay trao đổi giữa Quoc Thai (Myklede) và AI

File này lưu mọi điều đã thống nhất về phần xây tàu. Claude Code tự đọc nó khi làm việc trong `src/builder/`.
File `CLAUDE.md` ở gốc repo là của cả nhóm (chỉ Role 3 được sửa), nên ghi chú của Role 1 nằm ở đây.
Cập nhật file này sau mỗi lần trao đổi có quyết định mới. Ghi ngày, ghi rõ "đã chốt" hay "đang bàn".

## 1. Bối cảnh cố định

- Người dùng: Quoc Thai Nguyen (Michael, GitHub Myklede), **Role 1: Rocket Builder** của game SpaceB&E (4 người, hackathon). Trao đổi bằng tiếng Việt.
- Nhánh làm việc: `role1-builder`. Đưa lên `dev` chỉ khi người dùng bảo: `git merge origin/dev`, `npm run check`, `git push origin HEAD:dev`. Không bao giờ push `main`, không force-push, không `--no-verify`.
- Chỉ sửa: `src/builder/**`, `src/core/balance.json`, `README.md`, `CREDITS.md`, `docs/DECISIONS.md`, `docs/SHARE_PROBLEMS.md`, `public/assets/**`. Lỗi ở phần người khác thì ghi vào `docs/SHARE_PROBLEMS.md`.
- Không tự đặt tên event, state, ending, task, station mới: tất cả nằm trong `src/core/contract.js`. Thêm trường phụ vào `ShipSpec.stats` / `ShipSpec.launch` thì được (Role 2 bỏ qua trường lạ), nhưng phải ghi vào DECISIONS.
- Luật kiểm tra: chuột/bàn phím chỉ qua `core/input.js` (trong builder chỉ dùng `click`, `wheel`, `drag*`); không `requestAnimationFrame`; không viết số `9.81 / 3.71 / 9.80665`; `localStorage` chỉ qua `save`.
- Máy: Node 26, chạy thẳng `npm run dev` / `npm run check`. Sau `npm install` phải hoàn tác `package-lock.json` (`git checkout origin/dev -- package-lock.json`).
- Mô phỏng bay của Role 2 chỉ có **một tầng**: không tách tầng. Mọi thứ gắn lên tàu bay tới Sao Hỏa.
- Kiểm tra trước khi báo cáo: `node src/builder/tests/builder.test.mjs`, `npm run check`, và chụp ảnh màn hình bằng Playwright để tự xem giao diện.

## 2. Sở thích của người dùng (rút ra qua các lần góp ý)

- Ghét giao diện rườm rà, nhiều nút, nhiều mảnh nhỏ lẻ tẻ; muốn gọn, có tổ chức, thân thiện với người chơi phổ thông.
- Mọi linh kiện phải có hình ảnh; công thức và thông số phải giải thích bằng lời dễ hiểu.
- Muốn sát thực tế: hình dáng, linh kiện, vật liệu lấy từ tàu và tên lửa thật (NASA, SpaceX…), đi sâu tới từng chi tiết (ống xả, ống dẫn nhiên liệu…). Ốc vít nhỏ thì bỏ qua.
- Thích khung 3D xoay được của tàu (đã khen ngày 2026-11-07).
- Muốn người chơi tự do build cả con tàu từ đầu, có nút xoá hết.

## 3. Lịch sử giao diện xây tàu

| Lần | Giao diện | Kết quả |
|---|---|---|
| 1 | Màn phẳng: palette + Formula Lens | Chê đồ hoạ giả |
| 2 | Phòng kỹ thuật tròn đi bộ góc nhìn thứ nhất, mỗi máy một việc | **Giữ** |
| 3 | Hologram kéo thả kiểu Iron Man | **Bỏ**, quá nhiều nút, hình nhỏ |
| 4 | Trang sơ đồ Dawn 2D, thẻ to | Thẻ chiếm chỗ, không xoay được |
| 5 | Studio 3D xoay được + dải thẻ nhỏ + bảng phải + nhãn có đường dẫn (commit `7e17832`) | 3D xoay **tốt**; nhãn và mảnh nhỏ **lộn xộn**, chưa ưng |

## 4. Yêu cầu mới (2026-11-07, ĐANG BÀN, chưa code)

Người dùng muốn làm lại giao diện trang thiết kế:

- Giữ khung 3D tàu xoay được ở giữa.
- Bỏ các nhãn lẻ tẻ có đường dẫn quanh tàu.
- Bên ngoài chỉ có **4 thẻ**: (1) Mũi tàu, (2) Thân tàu, (3) Đít tàu, (4) Bệ phóng.
- Bấm một thẻ → hiện **danh sách dọc** các thành phần và linh kiện của phần đó để chọn tuỳ ý. Áp dụng như nhau cho cả 4 phần.
- Có nút **xoá hết**: bệ trống, không có tàu, chỉ còn 4 thẻ. Người chơi bắt đầu từ phần nào cũng được.
- Trong mỗi phần: chọn **hình dáng trước** (ví dụ đáy rộng / đáy hẹp, nhiều lựa chọn lấy từ tàu thật), rồi **đi sâu** vào từng bộ phận, từng thiết bị (ống xả, ống dẫn nhiên liệu…) như linh kiện thật.
- Làm bằng **đội sub-agent**: mỗi agent thực thi phụ trách một phần, mỗi agent kiểm tra soát một agent thực thi, kết quả báo lại cho người dùng.

### Đề xuất của AI (chờ người dùng chốt)

- Bố cục: thanh trên tối giản; 3D ở giữa; cột 4 thẻ một bên. Bấm thẻ thì thẻ mở thành danh sách dọc (bước 1 hình dáng → bước 2 thành phần → bước 3 bên trong). Tàu 3D tô sáng phần đang chọn, camera bay tới phần đó, các phần khác mờ đi.
- Chia linh kiện hiện có (dự kiến):
  - Mũi: fairing/mũi, capsule, tấm chắn nhiệt, payload adapter, dù, ăng-ten, thiết bị phi hành đoàn.
  - Thân: bồn, vòng điện tử, truss, interstage, centerbody, wiring tunnel, bình helium/nitơ, đồ gắn trên bồn (khoa học, điện, O₂, che chắn).
  - Đít: động cơ, khung đỡ lực đẩy, gimbal, vây, chân đáp, động cơ rắn gắn hông.
  - Bệ phóng: cửa sổ phóng và thời tiết, thiết bị bệ (kẹp giữ, tháp, máng lửa, phun nước), thử động cơ.
- Hệ quả kỹ thuật cần thống nhất:
  - "Hình dáng đít" từ tàu thật (Falcon 9 có 9 động cơ, Saturn V có 5…) cần cụm nhiều động cơ: thêm phần "khung đỡ lực đẩy" có N vị trí gắn động cơ.
  - Thân rộng/hẹp khác nhau cần bộ chuyển đường kính.
  - Bệ phóng là nhóm mới, chỉ ảnh hưởng giá, độ tin cậy, thời tiết. Cảnh phóng thật thuộc Role 3/2, không đổi được.
- Đội agent: AI dựng khung chung trước (dữ liệu "phần", khung thẻ, 3D tô sáng), sau đó 4 agent thực thi chạy song song, mỗi agent một file riêng; 4 agent kiểm tra đọc code, chạy test, chụp ảnh, báo lỗi; AI tổng hợp và báo lại người dùng.

### ĐÃ CHỐT (2026-11-07, người dùng chọn cả 4 đề xuất)

1. **Bệ phóng** = thiết bị bệ (loại bệ, tháp, kẹp giữ, máng lửa, phun nước giảm âm, chống sét…) + địa điểm và cửa sổ phóng, thời tiết. Ảnh hưởng phí, độ tin cậy, nhiệt độ lúc phóng (kết cục Challenger). Bệ hiện trong khung 3D dưới tàu.
2. **Thiết bị theo vị trí thật**: Mũi = khoang lái + đồ phi hành đoàn (dù, ăng-ten, O₂, chắn bức xạ, RCS…); Thân = bồn + đồ gắn trên bồn (khoa học, điện, bảo vệ, bình áp…); Đít = động cơ, khung đỡ lực đẩy, vây, chân đáp, động cơ rắn gắn hông.
3. **Cụm nhiều động cơ theo mẫu tàu thật**: hình dáng đít (khung đỡ lực đẩy) quyết định số vị trí động cơ; người chơi chọn loại động cơ cho cả cụm; lực đẩy, khối lượng, giá nhân theo số động cơ.
4. **Đội agent 4 thực thi + 4 kiểm tra**: Mũi, Thân, Đít, Bệ phóng. AI dựng khung chung trước, rồi mới chạy agent.

### Kiến trúc khung chung (AI làm ở Bước 0)

- Mỗi phần có thư mục riêng `src/builder/sections/<nose|body|tail|pad>/`: `section.json` (hình dáng + danh sách dòng thành phần), `parts.json` (linh kiện của phần đó), `internals.json` (chi tiết bên trong), `art.js` (hình 3D). Mỗi agent thực thi chỉ sửa thư mục của mình.
- Mỗi linh kiện có trường `section`. Linh kiện xếp chồng theo thứ tự Mũi → Thân → Đít. Chọn một hình dáng thì thay phần đó, giữ nguyên các phần khác; thiết bị của phần khác được chuyển sang chỗ gắn mới.
- Khung đỡ lực đẩy có `mounts` (số động cơ, vị trí, tỉ lệ); động cơ ngay dưới nó được nhân theo số vị trí.
- Bệ phóng không phải linh kiện của tàu: lưu trong `assembly.launch` (địa điểm, cửa sổ, thiết bị), cộng vào phí phóng và độ tin cậy.
- Giao diện: không còn nhãn quanh tàu; cột phải có 4 thẻ dạng accordion, mở ra danh sách dọc (hình dáng → thành phần → lựa chọn → bên trong); tàu 3D tô sáng phần đang mở.

## 5. Việc tồn đọng

- Khoảng 58 model NASA không dùng (35 MB) còn trong repo; lệnh xoá hàng loạt từng bị chặn, cần người dùng cho phép.
- Menu MORE chưa có Presets (hiện chỉ chọn mẫu khi bệ trống).
- Chưa có nút chọn đối xứng, chưa xoay/trượt đồ gắn hông.
- Linh kiện mới hiện hologram trong cảnh bay của Role 3 (đã ghi SHARE_PROBLEMS).
