---
title: "Prompt Engineering 2026: Không còn là mẹo, mà là thiết kế hệ thống"
description: "Prompt đã tiến hóa thành system design: context, tools, memory và eval. Bài này hệ thống hóa 4 lớp prompt bền vững cho sản phẩm AI thực chiến."
publishDate: 2026-08-20
author:
  name: "Luu Van"
  role: "AI Engineer"
category: "AI"
tags: ["Prompt", "LLM", "SystemDesign"]
cover:
  src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80"
  alt: "Màn hình code với sơ đồ hệ thống AI"
  width: 1200
  height: 630
readingTime: 5
excerpt: "Prompt 2026 không phải câu thần chú, mà là kiến trúc 4 lớp: System, Context, Tools, Eval. Làm đúng thì AI ổn định, làm sai thì hallucination triền miên."
sources:
  - title: "Anthropic — Prompt engineering guide 2026"
    url: "https://docs.anthropic.com/prompting"
    publisher: "Anthropic"
faq:
  - question: "Có cần học prompt nữa khi model ngày càng thông minh?"
    answer: "Càng thông minh càng cần thiết kế rõ. Model mạnh tha hồ sáng tạo — nếu không ràng buộc bằng system + eval, nó sẽ sáng tạo quá đà."
---

## Từ mẹo vặt đến kỹ thuật

Năm 2023, prompt là “thủ thuật”. Năm 2026, nó là **thiết kế hệ thống**. Một prompt tốt gồm 4 lớp:

### 1. System — vai trò & ranh giới
Định nghĩa AI là ai, được làm gì, không được làm gì. Ví dụ: “Bạn là trợ lý vận hành, chỉ trả lời từ dữ liệu nội bộ, nếu không biết thì nói không biết.”

### 2. Context — dữ liệu liên quan
Đưa đúng tài liệu, đúng lúc. Dùng RAG nhưng **chỉ top 3-5 chunk** liên quan nhất, kèm nguồn.

### 3. Tools — hành động
Cho AI gọi tool (search, DB, API) thay vì đoán. Mỗi tool có schema chặt.

### 4. Eval — kiểm thử
Mỗi prompt phải có 10-20 test case. Đo bằng LLM-as-judge + người duyệt mẫu.

## Mẫu khung

```
SYSTEM: Bạn là ...
CONTEXT: {retrieved_docs}
TASK: {user_request}
CONSTRAINTS: - Trích nguồn - Không bịa
TOOLS: [search, db_query]
```

Làm đủ 4 lớp, hallucination giảm 60-80% theo đo nội bộ.
