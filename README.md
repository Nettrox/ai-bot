# AI Project Generator

Bu proje, doğal dil ile uygulama geliştirmek, mevcut projeleri güncellemek ve proje geçmişini session bazlı olarak korumak amacıyla geliştirilmiştir.

Sistem Odysseus üzerinde çalışan session tabanlı bir mimari kullanır.

---

# Temel Özellikler

* Doğal dil ile proje oluşturma
* Mevcut projeleri geliştirme
* Session bazlı proje hafızası
* Otomatik klasör ve dosya oluşturma
* Otomatik dosya güncelleme
* Otomatik dosya silme
* macOS klasör seçme arayüzü
* Session bilgisi olmayan mevcut projeleri içeriğinden analiz ederek devralma

---

# Çalışma Akışı

Uygulama çalıştırılır:

```bash
node index.js
```

macOS klasör seçim penceresi açılır.

Kullanıcı bir klasör seçer.

Sistem seçilen klasörün durumunu kontrol eder.

---

# Senaryo 1 - Yeni Proje

Seçilen klasör:

```text
MyProjects/
```

ve klasör boşsa:

```text
MyProjects/
```

işlem sırası:

1. Yeni session oluşturulur.
2. Kullanıcı isteği modele gönderilir.
3. Model JSON döndürür.
4. Proje oluşturulur.
5. Session ID kaydedilir.

Örnek:

```text
MyProjects/
└── copy-board/
    ├── session_id.txt
    ├── Package.swift
    ├── README.md
    └── Sources/
```

---

# Senaryo 2 - Session Bilgisi Bulunan Proje

Seçilen klasörde:

```text
session_id.txt
```

bulunuyorsa:

```text
ClipboardManager/
├── session_id.txt
├── src/
└── package.json
```

işlem sırası:

1. Session ID okunur.
2. Yeni session oluşturulmaz.
3. oldAskOdysseus() kullanılır.
4. Mevcut proje bağlamı korunur.
5. Sadece gerekli değişiklikler uygulanır.

Örnek istekler:

```text
Dark mode ekle
```

```text
SQLite yerine PostgreSQL kullan
```

```text
Docker desteği ekle
```

---

# Senaryo 3 - Session Bilgisi Olmayan Mevcut Proje

Seçilen klasörde proje dosyaları varsa ancak:

```text
session_id.txt
```

bulunmuyorsa:

```text
OldProject/
├── src/
├── package.json
└── README.md
```

işlem sırası:

1. Klasör taranır.
2. Dosya içerikleri okunur.
3. Yeni session oluşturulur.
4. Mevcut proje bilgileri modele gönderilir.
5. Model projeyi analiz eder.
6. Session ID oluşturulur.
7. session_id.txt dosyası yazılır.
8. Bundan sonraki tüm işlemler aynı session üzerinden devam eder.

Bu sayede daha önce sistem dışında geliştirilmiş projeler de sonradan sisteme dahil edilebilir.

---

# Otomatik Proje Analizi

Session bilgisi olmayan mevcut projelerde sistem:

* Klasör yapısını okur.
* Dosya içeriklerini okur.
* Proje yapısını modele aktarır.
* Mevcut projeyi yeni proje olarak değerlendirmez.
* Kullanıcının isteğini mevcut proje üzerine uygular.

Örnek:

```text
Bu projeye JWT authentication ekle
```

```text
Bu hata oluşuyor:

[npm logu]
```

```text
Admin paneli ekle
```

---

# Session Yönetimi

Her proje kendi hafızasına sahiptir.

Dosya:

```text
session_id.txt
```

Örnek:

```text
6735f057-03b4-42b2-9dbc-72128264a90c
```

Bu dosya sayesinde proje geçmişi korunur.

Örnek yapı:

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

Her proje kendi bağımsız sohbet geçmişine sahiptir.

---

# Model Çıktı Formatı

Model yalnızca JSON döndürür.

Örnek:

```json
{
  "action": "update",
  "project_name": "copy-board",
  "folders": [
    "src/auth"
  ],
  "files": [
    {
      "path": "src/auth/auth.js",
      "content": "..."
    }
  ],
  "delete_files": []
}
```

---

# Desteklenen İşlemler

## Yeni Proje Oluşturma

```text
Macbook için clipboard manager yap
```

```text
Flutter ile görev takip uygulaması geliştir
```

```text
Python ile REST API oluştur
```

---

## Özellik Ekleme

```text
Dark mode ekle
```

```text
Google login ekle
```

```text
Bildirim sistemi ekle
```

---

## Refactor

```text
Projeyi TypeScript'e taşı
```

```text
Kod yapısını modüler hale getir
```

---

## Hata Düzeltme

```text
Bu hata oluşuyor:

[paste edilen log]
```

```text
Uygulama açılırken çöküyor
```

```text
Bu endpoint çalışmıyor
```

---

# Otomatik Dosya Yönetimi

Modelden gelen JSON'a göre:

* Yeni klasörler oluşturulur.
* Yeni dosyalar oluşturulur.
* Mevcut dosyalar güncellenir.
* Gereksiz dosyalar silinir.
* Session bilgisi korunur.
* Var olan projeler analiz edilerek sisteme dahil edilir.

Tüm işlemler kullanıcı müdahalesi olmadan otomatik gerçekleştirilir.

---

# Kullanım

```bash
node index.js
```

İşlem sırası:

1. Klasör seçilir.
2. İstek yazılır.
3. Sistem proje durumunu analiz eder.
4. Gerekirse proje taranır.
5. Model çalıştırılır.
6. Dosyalar oluşturulur veya güncellenir.
7. Session bilgisi korunur.
8. Geliştirme süreci aynı proje hafızası üzerinden devam eder.
