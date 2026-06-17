# AI Project Generator

Bu proje, doğal dil ile uygulama fikri vererek otomatik olarak proje oluşturmak ve mevcut projeleri geliştirmek amacıyla geliştirilmiştir.

## Temel Mantık

Sistem Odysseus üzerinden çalışan session tabanlı bir yapı kullanır.

### Yeni Proje

Eğer seçilen klasörde `session_id.txt` bulunmuyorsa:

1. Yeni session oluşturulur.
2. Kullanıcının isteği prompt ile birleştirilir.
3. `newAskOdysseus()` çağrılır.
4. Modelden dönen JSON parse edilir.
5. Proje dosyaları ve klasörleri oluşturulur.
6. Session ID proje klasörüne kaydedilir.

Oluşturulan yapı:

```text
proje-klasoru/
├── session_id.txt
├── src/
├── ...
```

---

### Mevcut Proje Güncelleme

Eğer seçilen klasörde `session_id.txt` bulunuyorsa:

1. Dosya içerisindeki session ID okunur.
2. Yeni session oluşturulmaz.
3. `oldAskOdysseus()` çağrılır.
4. Önceki sohbet bağlamı korunur.
5. Kullanıcının yeni isteği mevcut proje üzerinde uygulanır.

Örnek:

```text
Dark mode ekle
```

```text
PostgreSQL desteği ekle
```

```text
Bu hata neden oluşuyor?

[paste edilen hata logu]
```

Model önceki konuşmaları bildiği için mevcut proje üzerinden devam eder.

---

## Klasör Seçimi

Uygulama çalıştırıldığında kullanıcıdan terminal üzerinden yol yazması istenmez.

macOS klasör seçim penceresi açılır.

Kullanıcı:

1. Yeni proje oluşturmak istiyorsa boş bir klasör seçebilir.
2. Var olan projeyi güncellemek istiyorsa proje klasörünü seçebilir.

---

## Session Yönetimi

Her proje kendi session bilgisine sahiptir.

Dosya:

```text
session_id.txt
```

Örnek içerik:

```text
6735f057-03b4-42b2-9dbc-72128264a90c
```

Bu sayede farklı projeler birbirinden bağımsız olarak geliştirilebilir.

Örnek:

```text
Projects/
├── ClipboardManager/
│   └── session_id.txt
│
├── ExpenseTracker/
│   └── session_id.txt
│
└── TelegramBot/
    └── session_id.txt
```

Her proje kendi sohbet geçmişine sahip olur.

---

## Model Çıktısı

Model yalnızca JSON döndürür.

Örnek:

```json
{
  "action": "create",
  "project_name": "copy-board",
  "folders": [
    "src"
  ],
  "files": [
    {
      "path": "src/index.js",
      "content": "..."
    }
  ]
}
```

---

## Desteklenen İşlemler

### Yeni Proje Oluşturma

```text
Macbook için clipboard manager yap
```

```text
Flutter ile yapılacak bir görev takip uygulaması geliştir
```

```text
Python ile REST API oluştur
```

---

### Mevcut Projeyi Güncelleme

```text
Dark mode ekle
```

```text
SQLite yerine PostgreSQL kullan
```

```text
Docker desteği ekle
```

```text
Bu hata oluşuyor:

[log]
```

---

## Otomatik Dosya Yönetimi

Modelden gelen JSON'a göre:

* Yeni klasörler oluşturulur.
* Yeni dosyalar oluşturulur.
* Mevcut dosyalar güncellenir.
* Silinmesi gereken dosyalar kaldırılır.
* Session bilgisi korunur.

Tüm işlemler kullanıcı müdahalesi olmadan otomatik gerçekleştirilir.

---

## Kullanım

```bash
node index.js
```

Çalıştırıldıktan sonra:

1. Klasör seçilir.
2. İstek yazılır.
3. Model cevap verir.
4. Dosyalar otomatik oluşturulur veya güncellenir.
5. Session bilgisi korunarak geliştirme süreci devam eder.
