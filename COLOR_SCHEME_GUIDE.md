# Color Scheme Guide — AI Email Manager

Tài liệu này tổng hợp toàn bộ thay đổi màu sắc theo hai theme đã chọn:
- **Dark:** Midnight Navy (nền xanh đen navy, accent indigo)
- **Light:** Warm White (nền kem trắng, accent indigo giữ nguyên)

---

## 1. `frontend/app/globals.css`

Thay toàn bộ phần `:root`, `html.light`, `html.dark` bằng đoạn sau:

```css
:root {
  --bg-primary: #070c18;
  --bg-secondary: #0f172a;
  --bg-card: #1e293b;
  --bg-elevated: #273348;
  --border: rgba(99, 102, 241, 0.15);
  --border-hover: rgba(99, 102, 241, 0.5);
  --text-primary: #e2e8f0;
  --text-secondary: rgba(226, 232, 240, 0.70);
  --text-muted: rgba(226, 232, 240, 0.40);
  --accent: #6366f1;
  --accent-glow: rgba(99, 102, 241, 0.12);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;

  --bg-sidebar: #0f172a;
  --text-sidebar-logo: #e2e8f0;
  --text-sidebar-user: #e2e8f0;
  --theme-gradient: linear-gradient(135deg, #6366f1, #4f46e5);
  --bg-glass: rgba(15, 23, 42, 0.75);

  /* Icon colors */
  --icon-default: rgba(148, 163, 184, 1);    /* slate-400 — icon mặc định */
  --icon-active: #6366f1;                    /* indigo — icon đang active */
  --icon-muted: rgba(100, 116, 139, 1);      /* slate-500 — icon phụ / placeholder */
  --icon-accent: #6366f1;                    /* dùng cho stat card icons */
}

html.light {
  --bg-primary: #f8f7f4;
  --bg-secondary: #f1f0ec;
  --bg-card: #ffffff;
  --bg-elevated: #e8e6e0;
  --border: rgba(30, 41, 59, 0.10);
  --border-hover: rgba(99, 102, 241, 0.40);
  --text-primary: #1e293b;
  --text-secondary: rgba(30, 41, 59, 0.65);
  --text-muted: rgba(30, 41, 59, 0.40);
  --accent: #6366f1;
  --accent-glow: rgba(99, 102, 241, 0.08);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;

  --bg-sidebar: #f1f0ec;
  --text-sidebar-logo: #1e293b;
  --text-sidebar-user: #1e293b;
  --theme-gradient: linear-gradient(135deg, #6366f1, #4f46e5);
  --bg-glass: rgba(255, 255, 255, 0.72);

  /* Icon colors */
  --icon-default: rgba(71, 85, 105, 1);      /* slate-600 — icon mặc định */
  --icon-active: #4f46e5;                    /* indigo-600 — icon đang active */
  --icon-muted: rgba(148, 163, 184, 1);      /* slate-400 — icon phụ / placeholder */
  --icon-accent: #4f46e5;
}

html.dark {
  --bg-primary: #070c18;
  --bg-secondary: #0f172a;
  --bg-card: #1e293b;
  --bg-elevated: #273348;
  --border: rgba(99, 102, 241, 0.15);
  --border-hover: rgba(99, 102, 241, 0.5);
  --text-primary: #e2e8f0;
  --text-secondary: rgba(226, 232, 240, 0.70);
  --text-muted: rgba(226, 232, 240, 0.40);
  --accent: #6366f1;
  --accent-glow: rgba(99, 102, 241, 0.12);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;

  --bg-sidebar: #0f172a;
  --text-sidebar-logo: #e2e8f0;
  --text-sidebar-user: #e2e8f0;
  --theme-gradient: linear-gradient(135deg, #6366f1, #4f46e5);
  --bg-glass: rgba(15, 23, 42, 0.75);

  /* Icon colors */
  --icon-default: rgba(148, 163, 184, 1);
  --icon-active: #6366f1;
  --icon-muted: rgba(100, 116, 139, 1);
  --icon-accent: #6366f1;
}
```

### Các class badge — giữ nguyên, chỉ đổi màu `badge-ads` → `badge-promotion` (đã đúng):

```css
/* Không cần thay đổi gì ở phần badge-* và priority-* */
```

---

## 2. `frontend/components/ui/index.tsx`

### Spinner — đổi từ blue hardcode sang accent:

```tsx
// TRƯỚC
<div style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: '#60a5fa' }} />

// SAU
<div style={{ borderColor: 'var(--accent-glow)', borderTopColor: 'var(--accent)' }} />
```

### EmptyState — đổi icon container và text từ hardcode sang CSS var:

```tsx
// TRƯỚC
<div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
  <span style={{ color: '#60a5fa' }}>{icon}</span>
</div>
<h3 style={{ color: '#e2e8f0' }}>{title}</h3>
<p style={{ color: '#64748b' }}>{description}</p>

// SAU
<div style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-hover)' }}>
  <span style={{ color: 'var(--icon-accent)' }}>{icon}</span>
</div>
<h3 style={{ color: 'var(--text-primary)' }}>{title}</h3>
<p style={{ color: 'var(--text-muted)' }}>{description}</p>
```

### Input — đổi icon placeholder và label từ hardcode:

```tsx
// TRƯỚC
<label style={{ color: '#94a3b8' }}>
<span style={{ color: '#475569' }}>{icon}</span>  // icon trong input

// SAU
<label style={{ color: 'var(--text-secondary)' }}>
<span style={{ color: 'var(--icon-muted)' }}>{icon}</span>
```

---

## 3. `frontend/components/sidebar/Sidebar.tsx`

### Theme toggle button — đổi hardcode Tailwind class sang style:

```tsx
// TRƯỚC — active Sun button
className={`p-1 rounded-md transition-all duration-200 ${
  theme === 'light' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
}`}

// SAU
style={theme === 'light'
  ? { background: 'var(--accent)', color: 'white' }
  : { color: 'var(--icon-muted)' }
}

// TRƯỚC — active Moon button
className={`p-1 rounded-md transition-all duration-200 ${
  theme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
}`}

// SAU
style={theme === 'dark'
  ? { background: 'var(--accent)', color: 'white' }
  : { color: 'var(--icon-muted)' }
}
```

### Nav icon — hiện tại kế thừa màu từ `.sidebar-item` nên tự động đúng.
Không cần sửa gì thêm ở phần `<item.icon>` vì class `sidebar-item` đã handle qua CSS var.

---

## 4. `frontend/app/(dashboard)/dashboard/page.tsx`

### StatCard icon container — đổi hardcode hex sang CSS var:

Hiện tại `StatCard` nhận prop `color` là hex string rồi dùng `${color}20` và `${color}40`.
Cách đơn giản nhất là đổi các chỗ gọi `StatCard` sang dùng indigo:

```tsx
// Tất cả các <StatCard> trong file, đổi prop color:

// TRƯỚC
color="#6366f1"   // hoặc bất kỳ hex nào đang dùng

// SAU — thống nhất dùng accent
color="var(--accent)"  // nếu muốn đồng bộ tất cả

// HOẶC giữ màu riêng cho từng stat (khuyến nghị để phân biệt):
// Total emails  → color="#6366f1"  (indigo)
// Unread        → color="#f59e0b"  (amber/warning)
// Starred       → color="#10b981"  (green/success)
// High priority → color="#ef4444"  (red/danger)
```

---

## 5. `frontend/tailwind.config.js`

Thêm các màu navy vào config để dùng được với Tailwind class (tùy chọn, không bắt buộc):

```js
theme: {
  extend: {
    colors: {
      navy: {
        950: '#070c18',
        900: '#0f172a',
        800: '#1e293b',
        700: '#273348',
      },
      // Xóa bỏ hoặc giữ nguyên phần blue, border, muted cũ
    },
  },
},
```

---

## Tóm tắt màu theo vai trò

| Vai trò | Dark (Midnight Navy) | Light (Warm White) |
|---|---|---|
| Nền trang | `#070c18` | `#f8f7f4` |
| Nền sidebar | `#0f172a` | `#f1f0ec` |
| Nền card | `#1e293b` | `#ffffff` |
| Text chính | `#e2e8f0` | `#1e293b` |
| Text phụ | 70% opacity text chính | 65% opacity text chính |
| Accent / Active | `#6366f1` indigo | `#6366f1` indigo |
| Icon mặc định | `#94a3b8` slate-400 | `#475569` slate-600 |
| Icon active | `#6366f1` | `#4f46e5` |
| Icon placeholder/muted | `#64748b` slate-500 | `#94a3b8` slate-400 |
| Success | `#10b981` emerald | `#10b981` emerald |
| Warning | `#f59e0b` amber | `#f59e0b` amber |
| Danger | `#ef4444` red | `#ef4444` red |
| Border | indigo 15% opacity | slate 10% opacity |
| Border hover | indigo 50% opacity | indigo 40% opacity |
