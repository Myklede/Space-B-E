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

## 4. Trang thiết kế 4 thẻ (2026-11-07, ĐÃ LÀM XONG)

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

### Tiến độ

- 2026-11-07: **Bước 0 xong** (commit `4b14585`, `78ee088`): khung 4 thẻ, `sections.js`, dữ liệu tách theo phần, cụm động cơ, bệ phóng, adapter tự động, động cơ tự khớp nhiên liệu với bồn. Test + `npm run check` qua.
- 2026-11-07: **4 agent thực thi đang chạy** (Mũi 5191, Thân 5192, Đít 5193, Bệ 5194), mỗi agent chỉ sửa `sections/<id>/`. Đề bài chung: scratchpad `brief-common.md`; đề bài kiểm tra: `brief-review.md`. Sau mỗi agent thực thi, một agent kiểm tra soát lại; AI tổng hợp, chạy check, commit, báo người dùng.

- 2026-11-07: người dùng muốn **xem game chạy trong lúc làm**, trang tự tải lại khi có thay đổi. Server dev của người dùng ở `http://localhost:5173` (Vite tự reload khi file đổi). Link mở thẳng bàn thiết kế: `http://localhost:5173/?debug=1&state=HANGAR&station=integration` (tham số `station` mới, commit `72113d6`).

- 2026-11-07: **4 agent thực thi đã xong** (chưa commit, đang chờ kiểm tra):
  - Thân: 11 hình dáng, 15 linh kiện mới.
  - Bệ phóng: 9 bãi phóng, 8 nhóm thiết bị.
  - Đít: 11 hình dáng, 16 linh kiện mới, động cơ vẽ lại.
  - Mũi: 9 hình dáng, 15 linh kiện mới, tháp thoát hiểm, capsule vẽ lại.
  AI đã sửa code chung theo đề nghị của các agent (commit `11c7cee`, `ffdbafb`): bệ vẽ lại theo kích thước tàu, bỏ bảng Range cũ, động cơ vẽ lại khi đổi vòi, booster tính trọng tâm ở giữa, buồng đốt và vòi theo cỡ bơm, vây của preset có `origin: tail`. 4 agent kiểm tra đang chạy (cổng 5195–5198).

- 2026-11-07: **4 agent kiểm tra xong, cả 4 đều "chấp nhận kèm lỗi cần sửa"**, không có lỗi chặn. Đã gửi danh sách lỗi cho 4 agent thực thi sửa. AI sửa code chung (`4bbbfbc`, `b1a2e3f`, `e8c5759`):
  - Hình vẽ biết bộ phận trên/dưới; shape mang sẵn lựa chọn và vật liệu; bỏ ánh xanh.
  - Có bộ lái thì chịu được mất ổn định nhẹ (6 %); bonus cùng nhóm chỉ tính một lần.
  - Shape thay đồ cũ trong các hàng nó lắp (hết trùng chân, dù, ăng-ten).
  - Trọng tâm booster tại +0.25 H; vây Workhorse xoay khỏi góc booster.
- 2026-11-07: **4 agent thực thi sửa xong theo kiểm tra; AI tự soát (test, ảnh chụp) rồi commit từng phần**: Thân `7aff784`, Đít `4dc9bca`, Mũi `b208b7e`, Bệ phóng `cd1d279`. Không chạy lại agent kiểm tra.
  - Thân: kit bồn hydro (mặc định bọc foam), bồn hydro vách chung, một băng intertank giữa hai bồn kề nhau, ống dẫn ET đúng chỗ, bồn thép rẻ, tuỳ chọn tổ ong.
  - Đít: mọi cụm động cơ có gimbal; bộ lái (gimbal, verniers, jet vanes) chung nhóm bonus; Saturn V động cơ góc nằm dưới fairing; booster lỏng đắt hơn. Trên thân Reliable: chỉ One big engine và Soyuz không cảnh báo; các kiểu có solid thiếu 130–510 m/s; Octaweb TWR 1,18; Saturn V và New Glenn quá $5M; Soyuz chỉ dư ~$10k.
  - Mũi: fairing và nắp nhận tháp thoát hiểm ở trên; fairing trùm capsule có váy trong suốt; hệ thoát hiểm chung nhóm bonus; Apollo và Orion vừa $5M (khi thêm bồn + 2 solid + gimbal); ăng-ten vẽ phẳng trên vỏ.
  - Bệ phóng: giá bãi so với chờ ở Cape; Baikonur, Plesetsk miễn phí nhưng dưới 0 °C cả tuần; tháp lùi tránh vây, chân, booster; tay với chạm đúng vỏ; kẹp móc dưới bồn thấp nhất; tuyết khi dưới 0 °C. `pad/art.js` đọc `surfaceRadius` từ `nose/art.js` (cùng Role 1).
- 2026-11-07: **tích hợp**: vẽ lại 320 ảnh thẻ; `autoplace.js` coi fairing là mũi; tổng tiền trên thẻ phần tính đủ cụm động cơ (test mới); `npm run check` qua; cập nhật `README.md`, `README-ARCH.md`, `docs/DECISIONS.md`; SHARE_PROBLEMS: Role 3 thêm ~80 mã linh kiện chưa có hình bay, Role 2 `stats.reliability` không dùng khi bay (severity decision). Chưa push lên dev.

## 4b. Đang bàn: có cảnh báo cho người chơi hay để tai nạn xảy ra? (2026-11-07)

- Người dùng hỏi: nên báo "No spare oxygen", "Not enough Δv…" hay giấu đi để người chơi tự trải nghiệm tai nạn.
- AI đề xuất hướng giữa: (1) trong trang thiết kế chỉ hiện con số (Δv / cần), bỏ câu chỉ cách sửa, thêm "Why?" mở Formula Lens; (2) Go/No-Go vẫn đọc NO-GO kèm lý do, người chơi được OVERRIDE (spec §5.5 và contract đã chốt, các ending dựa vào đây; bài học Challenger/Columbia là cảnh báo có nhưng bị bỏ qua); (3) không cảnh báo những gì phụ thuộc cách lái và độ tin cậy ẩn; (4) màn kết thúc nối lại nguyên nhân (Role 4); (5) tuỳ chọn chế độ "Veteran" trong Settings.
- **Người dùng trả lời (2026-11-07):** đồng ý hướng xác suất "kiểu cầu thủ FIFA": bộ phận càng đắt càng chắc chắn nhưng vẫn có thể hỏng; đồ rẻ đôi khi vẫn thành công; liều khi Δv thiếu một chút đôi khi vẫn tới nơi (kịch tính khi sắp hết tiền). **Không nhắc lộ liễu** trong lúc lắp (chán nếu "cần 5000, lắp đúng 5000, bay thành công"). Khi thất bại thì **hiện phân tích nguyên nhân** để lần sau người chơi tự tính kỹ hơn.
- AI đề xuất cách làm (chờ người dùng chốt chi tiết): tàu thực tế lệch quanh thông số thiết kế lúc xác nhận (đồ đắt lệch ít, đồ rẻ lệch nhiều, hiếm khi có lỗi chế tạo); bỏ con số "cần X m/s" và câu chỉ cách sửa trong trang thiết kế; Go/No-Go nói kiểu điều khiển viên, không số, không cách sửa; TEST FIRE tốn tiền có thể phát hiện lỗi động cơ (spec §5.3); "Hội đồng điều tra tai nạn" trong hangar sau chuyến bay hỏng. Nổ/hỏng giữa chuyến cần Role 2.

## 5. Việc tồn đọng

- Khoảng 58 model NASA không dùng (35 MB) còn trong repo; lệnh xoá hàng loạt từng bị chặn, cần người dùng cho phép.
- Model không còn dùng: `satkit_radio1.glb` (ăng-ten giờ vẽ tay), `shuttle_engines.glb` cho động cơ (vẫn đứng trong hangar).
- Tuỳ chọn: hook `surfaceRadius` cho designScene/hangarScene; thêm shape Super Heavy / N1; bước đường kính M ở Delta/Workhorse.
- Chưa có nút chọn đối xứng, chưa xoay/trượt đồ gắn hông.
- Linh kiện mới hiện hologram trong cảnh bay của Role 3 (đã ghi SHARE_PROBLEMS).
