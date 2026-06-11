# AI Bot REST API

Odysseus tabanlı sohbet sistemine HTTP üzerinden erişim sağlayan basit bir REST API.

## Özellikler

- HTTP üzerinden soru gönderme
- Yeni sohbet oluşturma
- Mevcut sohbeti kullanma
- JSON response desteği
- Postman ile kolay test edebilme
- Node.js + Express altyapısı

---

## Kurulum

### Gereksinimler

- Node.js 18+
- Çalışan bir Odysseus sunucusu

Bağımlılıkları yükleyin:

```bash
npm install
```

veya

```bash
npm install express
```

---

## API'yi Başlatma

```bash
node restAPI.js
```

Başarılı şekilde çalıştığında:

```text
Server running on http://localhost:3000
```

---

## Base URL

```text
http://localhost:3000
```

---

## Endpoints

### GET /

API'nin çalışıp çalışmadığını kontrol eder.

#### Request

```http
GET /
```

#### Response

```json
{
  "status": "OK"
}
```

---

### POST /ask

Odysseus'a soru gönderir.

#### Request Body

| Alan | Tip | Açıklama |
|--------|------|----------|
| mode | string | `new` veya `old` |
| question | string | Sorulacak soru |

---

### Yeni Sohbet Oluşturma

#### Request

```json
{
  "mode": "new",
  "question": "Merhaba"
}
```

#### Response

```json
{
  "answer": "Merhaba! Size nasıl yardımcı olabilirim?"
}
```

---

### Son Sohbeti Kullanma

#### Request

```json
{
  "mode": "old",
  "question": "Bir önceki konuyu devam ettir"
}
```

#### Response

```json
{
  "answer": "Önceki konuşmamıza devam edelim..."
}
```

---

## Postman Kullanımı

### Method

```text
POST
```

### URL

```text
http://localhost:3000/ask
```

### Headers

```text
Content-Type: application/json
```

### Body

```json
{
  "mode": "old",
  "question": "Merhaba"
}
```

---

## cURL Örneği

### Yeni Sohbet

```bash
curl -X POST http://localhost:3000/ask \
-H "Content-Type: application/json" \
-d "{\"mode\":\"new\",\"question\":\"Merhaba\"}"
```

### Mevcut Sohbet

```bash
curl -X POST http://localhost:3000/ask \
-H "Content-Type: application/json" \
-d "{\"mode\":\"old\",\"question\":\"Nasılsın?\"}"
```

---

## Response Format

Başarılı isteklerde:

```json
{
  "answer": "..."
}
```

Hatalı isteklerde:

```json
{
  "error": "..."
}
```

---

## Kullanım Senaryoları

- Web uygulamaları
- Discord botları
- Telegram botları
- Mobil uygulamalar
- Otomasyon sistemleri
- AI Agent projeleri

---

## Teknolojiler

- Node.js
- Express
- Fetch API
- Odysseus API

---
