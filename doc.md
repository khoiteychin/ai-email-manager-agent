Bạn là một senior software engineer. Nhiệm vụ của bạn là đọc TOÀN BỘ 
codebase trong project này và tạo ra một file tài liệu kỹ thuật đầy đủ.

## Bước thực hiện
1. Dùng tool để list toàn bộ file source (bỏ qua node_modules, .next, 
   __pycache__, .git)
2. Đọc TỪNG FILE một — không được bỏ qua bất kỳ file nào
3. Xác định tất cả các luồng xử lý chính trong project
4. Với mỗi luồng, trace toàn bộ execution path qua các file

## Yêu cầu giải thích code
- Giải thích TỪNG DÒNG code — không được gộp hay bỏ qua
- Khi gặp một function call, phải tìm và giải thích implementation của 
  function đó luôn (không được viết "hàm này gọi X" mà không giải thích X)
- Giải thích cả error handling, không chỉ happy path
- Ghi rõ file path và số dòng cho mỗi đoạn code

## Format output cho mỗi luồng
### Tên luồng — [file entry point]
**Mục đích:** ...
**Trigger:** ...

#### Bước 1: [tên bước]
[code block]
- Dòng X: [giải thích]
- Dòng X+1: [giải thích]
...

## Quy tắc bắt buộc
- KHÔNG được dùng "tương tự như trên", "v.v.", "..." để bỏ qua code
- KHÔNG được tóm tắt nhóm dòng — mỗi dòng logic phải được giải thích riêng
- Nếu hết context, dừng lại và báo chính xác đang dừng ở đâu

## Output
Xuất ra file .docx hoặc .md tổng hợp toàn bộ tài liệu.

Bắt đầu bằng cách list toàn bộ file trong project.