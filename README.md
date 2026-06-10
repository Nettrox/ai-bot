# Chatgbt

Odysseus API ile sohbet oturumları oluşturmak, mevcut oturumları kaydetmek ve önceki oturumlarla konuşmaya devam etmek için hazırlanmış basit bir Node.js uygulaması.

## Özellikler

- Yeni sohbet oturumu oluşturma
- Son kullanılan oturumu bulma
- Yeni veya mevcut oturuma mesaj gönderme
- Streaming (anlık) cevap alma
- Oturumları JSON dosyasında saklama
- Sohbet başlıklarını otomatik kaydetme

---

## Gereksinimler

- Node.js 18+
- Çalışan bir Odysseus sunucusu

Varsayılan API adresi:

```txt
http://127.0.0.1:7000
```

Odysseus çalışmıyorsa istekler başarısız olacaktır.
https://github.com/pewdiepie-archdaemon/odysseus
---

## Kurulum

Projeyi klonlayın:

```bash
git clone <repo-url>
cd Chatgbt
```

Bağımlılıkları yükleyin:

```bash
npm install
```

package.json içerisinde aşağıdaki ayarın bulunduğundan emin olun:

```json
{
  "type": "module"
}
```

---

## Proje Yapısı

```txt
Chatgbt/
│
├── index.js
│
├── session_ids.json
│
└── func/
    ├── createNewSession.js
    ├── getInput.js
    ├── getLatestSessionId.js
    ├── newAskOdysseus.js
    ├── oldAskOdysseus.js
    └── saveCurrentSession.js
```

---

## Fonksiyonlar

### createNewSession()

Yeni bir sohbet oturumu oluşturur.

```js
const sessionId = await createNewSession();
```

Dönen değer:

```txt
d32d83a2-dbc5-4044-8397-d20349e3187e
```

---

### getLatestSessionId()

`session_ids.json` dosyasındaki en son kayıtlı oturumu döndürür.

```js
const sessionId = await getLatestSessionId();
```

---

### newAskOdysseus()

Yeni oluşturulan oturuma mesaj gönderir.

```js
await newAskOdysseus(sessionId, "Merhaba");
```

Cevaplar stream olarak terminale yazdırılır.

---

### oldAskOdysseus()

Mevcut bir oturumla konuşmaya devam eder.

```js
await oldAskOdysseus(sessionId, "Devam edelim");
```

---

### saveCurrentSession()

Oturum bilgisini ve sohbet başlığını kaydeder.

```js
await saveCurrentSession(sessionId);
```

Kayıt örneği:

```json
[
  {
    "index": 1,
    "session_id": "d32d83a2-dbc5-4044-8397-d20349e3187e",
    "title": "Starting a Conversation"
  }
]
```

---

### getInput()

Terminalden kullanıcı girişi almak için kullanılır.

```js
const question = await getInput("Soru: ");
```

---

## Kullanım Örneği

```js
import { getInput } from "./func/getInput.js";
import { createNewSession } from "./func/createNewSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";

const question = await getInput("Soru: ");

const sessionId = await createNewSession();

await newAskOdysseus(sessionId, question);

await saveCurrentSession(sessionId);
```

Çalıştırmak için:

```bash
node index.js
```

---

## session_ids.json

Uygulama kullanılan sohbetleri bu dosyada saklar.

Örnek:

```json
[
  {
    "index": 1,
    "session_id": "12345678-abcd-1234-abcd-1234567890ab",
    "title": "How to use Docker"
  },
  {
    "index": 2,
    "session_id": "87654321-dcba-4321-dcba-0987654321ba",
    "title": "Node.js Session Management"
  }
]
```

---

## API Endpointleri

Uygulama aşağıdaki Odysseus endpointlerini kullanır:

### Yeni Session

```http
POST /api/session
```

### Session Listesi

```http
GET /api/sessions
```

### Chat Stream

```http
POST /api/chat_stream
```

---

## Lisans

MIT
