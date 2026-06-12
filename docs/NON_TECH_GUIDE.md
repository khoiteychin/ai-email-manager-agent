# Hướng Dẫn Hiểu Hệ Thống — AI Email Manager
### Dành cho người không có nền tảng kỹ thuật

---

> **Mục tiêu của tài liệu này**: Sau khi đọc xong, bạn — dù chưa từng học lập trình — sẽ hiểu được **toàn bộ hệ thống AI Email Manager đang hoạt động như thế nào**, tại sao nó được xây dựng như vậy, và mỗi phần trong đó đóng vai trò gì.

---

## Phần 1: Hệ thống này làm gì?

Hãy tưởng tượng bạn là một **Giám đốc bận rộn** nhận 200 email mỗi ngày. Bạn không có thời gian đọc từng cái. Bạn cần một **trợ lý thông minh** có thể:

1. Đọc hết 200 cái email đó thay bạn.
2. Nói với bạn: *"Có 3 email quan trọng từ khách hàng, 5 hóa đơn cần xử lý, còn lại là quảng cáo."*
3. Khi bạn cần trả lời, trợ lý đó soạn sẵn thư trả lời phù hợp để bạn chỉ cần đọc lại và bấm gửi.
4. Nếu có email khẩn, trợ lý nhắn ngay vào Discord hoặc Telegram của bạn.

**AI Email Manager chính là trợ lý đó**, chạy 24/7 trên máy tính.

---

## Phần 2: Sơ đồ hệ thống đơn giản

Hãy hình dung hệ thống như một **văn phòng có 4 khu vực**:

```
┌──────────────────────────────────────────────────────────────────┐
│                          VĂN PHÒNG                               │
│                                                                  │
│  ┌───────────────┐   ┌────────────────┐   ┌──────────────────┐  │
│  │  QUẦY TIẾP TÂN │──▶│  BỘ PHẬN XỬ LÝ │──▶│   TỦ HỒ SƠ       │  │
│  │  (Frontend)   │   │  (Backend)     │   │  (Database)      │  │
│  │               │   │                │   │                  │  │
│  │ Giao diện web │   │ Logic xử lý    │   │ Lưu trữ dữ liệu  │  │
│  │ người dùng    │   │ nghiệp vụ      │   │ (PostgreSQL)     │  │
│  └───────────────┘   └───────┬────────┘   └──────────────────┘  │
│                              │                                   │
│                    ┌─────────▼─────────┐                         │
│                    │  CỘNG TÁC VIÊN    │                         │
│                    │  (Dịch vụ bên     │                         │
│                    │   ngoài)          │                         │
│                    │  • Gmail của bạn  │                         │
│                    │  • AI của OpenAI  │                         │
│                    │  • Discord/Tele   │                         │
│                    └───────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phần 3: Bốn khu vực trong văn phòng

### 🏢 Quầy Tiếp Tân — Frontend (Next.js)

**Frontend giống như quầy lễ tân của một khách sạn 5 sao.**

- Đây là phần duy nhất bạn nhìn thấy và chạm vào: các trang web, nút bấm, danh sách email, khung chat.
- Nó **không tự xử lý** nghiệp vụ, chỉ hiển thị thông tin và chuyển yêu cầu của bạn sang bộ phận xử lý.
- Khi bạn bấm nút "Tạo thư trả lời", quầy lễ tân ghi yêu cầu lại rồi chuyển cho nhân viên xử lý.

**Nếu xóa đi**: Bạn sẽ không còn giao diện để tương tác với hệ thống. Giống như khách sạn không có lễ tân — khách không biết đến phòng nào.

---

### 👨‍💼 Bộ Phận Xử Lý — Backend (FastAPI)

**Backend giống như đội ngũ nhân viên xử lý nghiệp vụ bên trong văn phòng.**

- Họ nhận yêu cầu từ lễ tân, kiểm tra xem người yêu cầu có quyền không, rồi mới thực hiện công việc.
- Họ là người duy nhất được phép mở tủ hồ sơ, liên hệ với Gmail, hay gọi cho AI.
- Sau khi xử lý xong, họ gửi kết quả về cho lễ tân để hiển thị cho bạn.

**Ví dụ cụ thể**: Khi bạn bấm "Tạo thư trả lời":
1. Lễ tân hỏi nhân viên: *"Khách muốn AI viết thư trả lời email này."*
2. Nhân viên tra cứu nội dung email trong tủ hồ sơ.
3. Nhân viên gọi điện cho AI (OpenAI) và đọc nội dung email cho AI nghe.
4. AI soạn thảo thư trả lời và đọc lại cho nhân viên.
5. Nhân viên tạo bản nháp trên Gmail của bạn, rồi báo cho lễ tân.
6. Lễ tân hiển thị bản nháp lên màn hình của bạn.

**Nếu xóa đi**: Toàn bộ logic nghiệp vụ biến mất. Giống như văn phòng có lễ tân nhưng không có nhân viên xử lý — không ai làm được gì cả.

---

### 🗂️ Tủ Hồ Sơ — Database (PostgreSQL + pgvector)

**Database giống như một tủ hồ sơ điện tử siêu cấp**, được sắp xếp ngăn nắp theo từng ngăn kéo (bảng dữ liệu):

| Ngăn kéo | Chứa gì? | Ví dụ |
| :--- | :--- | :--- |
| **users** | Danh sách tài khoản đăng ký | Khanh Do — khanh@gmail.com |
| **gmail_accounts** | "Chìa khóa" truy cập Gmail của từng người | Access Token của Khanh |
| **emails** | Bản sao email đã đồng bộ + phân tích AI | Email từ sếp, ngày 12/6, Ưu tiên: Cao |
| **email_embeddings** | Tọa độ không gian toán học của email | Dùng để chatbot tìm kiếm thông minh |
| **labels** | Các nhãn phân loại | Work, Personal, Invoice... |
| **ai_chat_sessions** | Lịch sử cuộc trò chuyện với chatbot | "Phiên chat ngày 12/6 lúc 8h sáng" |
| **ai_chat_messages** | Từng tin nhắn trong cuộc trò chuyện | Bạn: "Email nào cần trả lời gấp?" |

**Tại sao cần pgvector (tìm kiếm vector)?**

Đây là phần đặc biệt nhất. Mỗi email được chuyển đổi thành một **tọa độ trong không gian nhiều chiều** (giống GPS nhưng có 1536 tọa độ thay vì 2). Khi bạn hỏi chatbot câu hỏi, câu hỏi đó cũng được chuyển thành tọa độ, rồi hệ thống tìm các email có tọa độ gần nhất — đây chính là cách chatbot "hiểu" ngữ cảnh thay vì chỉ tìm theo từ khóa.

**Ví dụ**: Bạn hỏi *"Email nào về thanh toán?"* — dù email đó có thể dùng từ "invoice", "payment", "chuyển khoản", chatbot vẫn tìm được vì tọa độ vector của các từ đó gần nhau.

**Nếu xóa đi**: Mọi dữ liệu biến mất. Giống như đốt toàn bộ tủ hồ sơ.

---

### 🤝 Cộng Tác Viên — Dịch vụ bên ngoài

Hệ thống thuê "cộng tác viên" bên ngoài cho các việc chuyên biệt:

**Gmail API (Google)**
> *Giống như bưu điện*: Nhận và gửi thư thay mặt bạn. Mỗi khi có email mới, Gmail "gõ cửa" thông báo ngay cho hệ thống (thay vì hệ thống phải liên tục kiểm tra như một nhân viên cứ 2 phút lại ra hỏi bưu điện có thư chưa).

**OpenAI API**
> *Giống như chuyên gia AI*: Đọc email, phân tích nội dung, viết thư trả lời, trả lời câu hỏi của chatbot. Cần trả phí theo số lần sử dụng.

**Discord / Telegram Bot**
> *Giống như người đưa tin*: Khi có email quan trọng, người đưa tin lập tức nhắn vào Discord hoặc Telegram của bạn.

---

## Phần 4: Cách hệ thống biết bạn là ai — Xác thực (Authentication)

**Xác thực giống như bảo vệ cửa vào văn phòng.**

Hệ thống dùng **Firebase Authentication** của Google — một dịch vụ bảo mật chuyên nghiệp để xác minh danh tính.

### Quá trình đăng nhập:

```
Bạn                   Trang web              Firebase          Hệ thống
  │                       │                     │                   │
  │── Nhập email/pass ──▶│                     │                   │
  │                       │── Xác minh ───────▶│                   │
  │                       │                     │── OK, đây là ──▶ │
  │                       │◀── Cấp "Thẻ ra vào" ─┘   thẻ của bạn  │
  │◀── Đăng nhập thành ──│                     │                   │
  │    công               │                     │                   │
  │                       │                     │                   │
  │── Xem email ─────────▶│── Kèm "Thẻ ra vào" ────────────────▶ │
  │                       │                     │                   │── Kiểm tra thẻ
  │                       │                     │                   │── Hợp lệ → Trả dữ liệu
  │◀── Danh sách email ──│◀──────────────────────────────────────┘
```

**"Thẻ ra vào"** ở đây là **JWT Token** — một chuỗi ký tự mã hóa phức tạp, tự hết hạn sau 1 tiếng, không thể làm giả. Mỗi lần trang web gọi API backend, nó đều đính kèm thẻ này để backend kiểm tra.

> **Hệ quả quan trọng**: Nếu ai đó lấy được thẻ của bạn, họ có thể dùng trong vòng tối đa 1 tiếng. Sau đó thẻ hết hạn và họ phải xác thực lại.

---

## Phần 5: Luồng xử lý một yêu cầu — "Câu chuyện của một cái email"

### Kịch bản: Sếp bạn vừa gửi email khẩn

**1. Gmail nhận được email** → Ngay lập tức, Google kích hoạt "chuông báo" (Pub/Sub Notification) thông báo cho hệ thống có thư mới.

**2. Hệ thống lấy email về** → Backend gọi Gmail API, tải nội dung email về server. Đây là bản sao — email thật vẫn nằm trên Gmail của bạn.

**3. AI phân tích email** → Backend gửi nội dung email cho OpenAI GPT-4o với yêu cầu:
- Phân loại: Đây là email về Công việc hay gì?
- Mức ưu tiên: Thấp, Trung bình hay Cao?
- Tóm tắt: Viết 2-3 câu tóm tắt nội dung chính.

**4. Lưu kết quả vào tủ hồ sơ** → Backend lưu bản sao email + kết quả phân tích AI vào bảng `emails` trong PostgreSQL.

**5. Tạo "bản đồ không gian"** → Backend chuyển nội dung email thành vector toán học (1536 con số) và lưu vào bảng `email_embeddings` — phục vụ tìm kiếm chatbot sau này.

**6. Gửi thông báo ngay lập tức** → Nếu bạn đã kết nối Discord hoặc Telegram, Discord Bot/Telegram Bot ngay lập tức gửi tin nhắn:
> *"📧 Email mới từ: Sếp (sep@company.com)*
> *Chủ đề: Họp khẩn chiều nay*
> *Phân loại: Công việc | Ưu tiên: Cao*
> *Tóm tắt: Yêu cầu họp báo cáo quý 2 lúc 3h chiều nay..."*

**7. Bạn mở app và thấy email** → Trên trang Emails, email từ sếp hiện đầu tiên với nhãn "Ưu tiên: Cao".

**8. Bạn bấm "Tạo thư trả lời"** → AI đọc email gốc, nhận ra đây là tiếng Việt, soạn thảo thư trả lời bằng tiếng Việt chuyên nghiệp và tạo bản nháp trực tiếp trên Gmail của bạn.

**9. Bạn đọc lại, điều chỉnh nếu cần, bấm Gửi** → Hệ thống gọi Gmail API gửi thư đi, email đến hộp thư của sếp.

---

## Phần 6: Chatbot AI — "Trợ lý có trí nhớ"

**Chatbot giống như một trợ lý đã đọc hết toàn bộ email của bạn và có trí nhớ hoàn hảo.**

Khi bạn hỏi: *"Tháng này tôi có bao nhiêu hóa đơn cần thanh toán?"*

```
Bạn đặt câu hỏi
        │
        ▼
Câu hỏi được chuyển thành "tọa độ toán học"
        │
        ▼
Hệ thống tìm 5 email có tọa độ gần nhất trong tủ hồ sơ
(ví dụ: email hóa đơn điện, nước, internet, thuê nhà)
        │
        ▼
5 email đó được đưa cho AI làm "tài liệu tham khảo"
        │
        ▼
AI đọc tài liệu và trả lời câu hỏi của bạn
dựa trên thông tin thực tế từ email
        │
        ▼
"Bạn có 4 hóa đơn tháng này: điện (450k), nước (180k),
 internet (299k), và thuê nhà (5 triệu). Tổng: 5.929.000đ"
```

Cách này (gọi là **RAG — Retrieval-Augmented Generation**) giúp AI trả lời chính xác dựa trên dữ liệu thực tế của bạn, thay vì bịa ra câu trả lời chung chung.

---

## Phần 7: Cách hệ thống được triển khai — "Văn phòng đặt ở đâu?"

**Triển khai giống như việc thuê và cài đặt văn phòng ở một tòa nhà.**

### Môi trường thực tế (Production):
```
Internet
    │
    ▼
┌──────────────────────────────────────────────┐
│  Máy chủ GCP (Google Cloud Platform)          │
│  Ubuntu Linux                                 │
│                                               │
│  ┌─────────┐   Điều phối    ┌──────────────┐  │
│  │  Nginx  │──────────────▶│  Next.js App  │  │
│  │  (Bảo   │               │  Port: 3000   │  │
│  │  vệ SSL)│──────────────▶│  FastAPI App  │  │
│  └─────────┘               │  Port: 3001   │  │
│                            └──────┬───────┘  │
│                                   │           │
│                            ┌──────▼───────┐   │
│                            │  PostgreSQL  │   │
│                            │  Port: 5432  │   │
│                            └──────────────┘   │
└──────────────────────────────────────────────┘
```

**PM2** là người quản lý bảo đảm các ứng dụng luôn chạy — khi nào sập, tự động khởi động lại.
**Nginx** là bảo vệ cửa: đảm bảo kết nối được mã hóa (HTTPS), điều hướng người dùng vào đúng phòng.

---

## Phần 8: Vòng đời dữ liệu — "Email đi đâu?"

```
Gmail của bạn
      │
      │ (Tự động mỗi khi có email mới)
      ▼
Backend (FastAPI)
      │
      ├──▶ OpenAI (Phân loại + Tóm tắt)
      │
      ├──▶ PostgreSQL (Lưu trữ lâu dài)
      │         ├── Bảng emails
      │         └── Bảng email_embeddings
      │
      ├──▶ Discord Bot (Thông báo ngay)
      │
      └──▶ Telegram Bot (Thông báo ngay)

Khi bạn mở ứng dụng:
      │
      ▼
Frontend (Next.js) ──▶ Backend ──▶ PostgreSQL
                                        │
                              Lấy dữ liệu đã lưu
                                        │
                              ◀── Trả về danh sách email
```

---

## Phần 9: Các khái niệm kỹ thuật được giải thích đơn giản

| Thuật ngữ kỹ thuật | Giải thích bằng ngôn ngữ thường |
| :--- | :--- |
| **API** | Cách hai phần mềm "nói chuyện" với nhau — như giao thức ngôn ngữ chung |
| **JWT Token** | Thẻ thông hành điện tử có chữ ký, tự hết hạn sau 1 tiếng |
| **Database / PostgreSQL** | Tủ hồ sơ điện tử được sắp xếp khoa học |
| **Frontend** | Phần giao diện bạn nhìn thấy và tương tác |
| **Backend** | Bộ phận xử lý nghiệp vụ bên trong, bạn không nhìn thấy |
| **Docker** | "Thùng container" đóng gói ứng dụng, chạy được ở bất kỳ máy nào |
| **Vector Embedding** | Chuyển đổi văn bản thành tọa độ toán học để so sánh độ tương đồng |
| **OAuth2** | Cơ chế cho phép ứng dụng dùng tài khoản Google của bạn mà không cần biết mật khẩu |
| **HTTPS/SSL** | Mã hóa dữ liệu trên đường truyền — như gửi thư trong phong bì niêm phong |
| **PM2** | Người quản lý tiến trình — đảm bảo app luôn chạy, tự khởi động lại khi sự cố |
| **Nginx** | Bảo vệ cửa và điều phối viên — nhận yêu cầu và phân luồng đến đúng dịch vụ |

---

## Phần 10: Những điều hệ thống làm TỐT và CHƯA TỐT

### ✅ Làm tốt:
- Giao diện đẹp, hỗ trợ Dark/Light mode
- Phân loại email tự động chính xác nhờ AI
- Chatbot hiểu ngữ cảnh nhờ Vector Search
- Thông báo Discord/Telegram tức thì
- Phản hồi email đúng ngôn ngữ (Việt/Anh)

### ⚠️ Cần cải thiện:
- **Chưa có giới hạn số lần gọi API**: Nếu có người cố tình spam hệ thống, chi phí OpenAI có thể tăng đột biến.
- **Chưa có kiểm thử tự động**: Mỗi khi sửa code, cần kiểm tra tay — tốn thời gian và dễ bỏ sót lỗi.
- **Quy trình cập nhật thủ công**: Mỗi lần có code mới, cần SSH vào server và chạy lệnh tay thay vì tự động.

---

## Tóm tắt cuối cùng

**AI Email Manager = Trợ lý thư ký thông minh 24/7**

```
Bạn ──▶ Gmail ──▶ [Hệ thống tự động]
                        │
                   Phân loại bằng AI
                   Tóm tắt bằng AI
                   Lưu vào Database
                        │
                   Thông báo ngay lên Discord/Telegram
                        │
                   Bạn mở app → Thấy email đã được xử lý
                        │
                   Bấm nút → AI soạn thư trả lời
                        │
                   Duyệt → Gửi đi
```

Thay vì bạn mất 2 tiếng mỗi ngày đọc và phân loại email, hệ thống làm điều đó trong **vài giây**, giúp bạn chỉ tập trung vào những email **thực sự quan trọng**.
