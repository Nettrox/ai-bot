# AI Mail Bot Kurulumu

## Gereksinimler

* Node.js (18 veya üzeri önerilir)
* npm
* Gmail hesabı
* Gmail App Password
* `.env` dosyası

## Proje Oluşturma

Yeni bir Node.js projesi oluşturmak için:

```bash
npm init -y
```

Bu komut proje için gerekli olan `package.json` dosyasını oluşturur.

## Gerekli Paketlerin Kurulumu

Mail gönderimi, ortam değişkenleri ve web araması için:

```bash
npm install axios cheerio dotenv duck-duck-scrape nodemailer
```

### Kurulan Paketler

| Paket             | Açıklama                                             |
| ----------------- | ---------------------------------------------------- |
| axios             | Web sayfalarına HTTP isteği atmak için kullanılır.   |
| cheerio           | HTML içerisinden veri ayıklamak için kullanılır.     |
| dotenv            | `.env` dosyasındaki değişkenleri uygulamaya yükler.  |
| duck-duck-scrape  | DuckDuckGo üzerinden arama yapmak için kullanılır.   |
| nodemailer        | Gmail üzerinden e-posta göndermek için kullanılır.   |

## package.json Ayarı

Proje ES module yapısıyla çalıştığı için `package.json` dosyasına aşağıdaki alan eklenmelidir:

```json
{
  "type": "module"
}
```

## .env Dosyası Oluşturma

Proje dizininde `.env` dosyası oluşturun:

```env
MY_EMAIL=YOUR_GMAIL_ADDRESS
MAIL_PASS=YOUR_GMAIL_APP_PASSWORD
```

`MY_EMAIL` alanına mail gönderecek Gmail adresi yazılır.

`MAIL_PASS` alanına Gmail hesabı için oluşturulan App Password yazılır.

## Prompt Dosyası

AI promptları `prompt.json` dosyasında tutulur.

Dosya içerisinde iki ana alan vardır:

```json
{
  "top_ai": {},
  "mail_ai": {}
}
```

| Alan      | Açıklama                                                         |
| --------- | ---------------------------------------------------------------- |
| top_ai    | Kullanıcının mail isteğini analiz eder ve gönderim inputu üretir. |
| mail_ai   | Hazırlanan inputtan gönderilecek nihai maili oluşturur.           |

## Kişi ve Session Kayıtları

Kişi, mail adresi ve session bilgileri `top_ai.json` dosyasında tutulur.

Örnek yapı:

```json
{
  "records": [
    {
      "session_id": "",
      "person_name": "",
      "mail_adresi": ""
    }
  ]
}
```

Bu dosyada yalnızca gerekli bilgiler tutulur. Detaylı AI cevapları veya gereksiz log verileri burada saklanmaz.

## Log Dosyası

Detaylı çalışma çıktıları `mail_ai.log` dosyasına yazılır.

Bu dosyada şunlar tutulabilir:

* Top AI cevapları
* Mail AI cevapları
* Web arama sonuçları
* Gönderilen mail bilgileri
* Geçersiz session durumları

## Gönderim Modları

Uygulama üç farklı gönderim şeklini destekler.

| Mod      | Açıklama                                         |
| -------- | ------------------------------------------------ |
| single   | Tek kişiye mail gönderir.                        |
| separate | Birden fazla kişiye ayrı ayrı mail gönderir.     |
| together | Birden fazla kişiye tek mail olarak gönderir.    |

Örnek komutlar:

```text
irfana mail at aksam ne yicek
```

```text
irfana ve aleynaya ayrı ayrı mail at akşam ne yiyeceklerini sor
```

```text
irfana ve aleynaya birlikte mail at akşam ne yiyeceklerini sor
```

Eğer birden fazla kişi belirtilir ama gönderim şekli belirtilmezse uygulama kullanıcıya birlikte mi ayrı ayrı mı gönderileceğini sorar.

## Kullanım

Uygulamayı çalıştırmak için:

```bash
node index.js
```

Çalıştığında terminalde aşağıdaki giriş alanı görünür:

```text
Mail komutu:
```

Örnek kullanım:

```text
Mail komutu: irfana mail at aksam ne yicek
```

Uygulama isteği analiz eder, gerekli mail içeriğini oluşturur ve Gmail üzerinden gönderir.

## Proje Dosyaları

| Dosya                  | Açıklama                                      |
| ---------------------- | --------------------------------------------- |
| index.js               | Ana uygulama dosyasıdır.                      |
| prompt.json            | AI promptlarını tutar.                        |
| top_ai.json            | Kişi, mail adresi ve session kayıtlarını tutar. |
| mail_ai.log            | Detaylı çalışma loglarını tutar.              |
| func/sendMail.js       | Mail gönderme işlemini yapar.                 |
| func/createNewSession.js | Yeni session oluşturma işlemini yapar.       |
| func/saveTopAiLog.js   | Kişi ve session kayıtlarını günceller.        |
| func/saveMailAiLog.js  | Detaylı logları dosyaya yazar.                |

## Notlar

* `session_ids.json` kullanılmamaktadır.
* `top_ai_search.json` kullanılmamaktadır.
* Web araması sonucu bulunan kişiler doğrudan `top_ai.json` içine eklenir.
* Detaylı loglar JSON dosyalarını kirletmemesi için `mail_ai.log` içinde tutulur.
* `.env` dosyası paylaşılmamalı ve Git'e eklenmemelidir.
