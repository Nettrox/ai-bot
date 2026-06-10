# Telegram Bot Kurulumu

## Gereksinimler

* Node.js (18 veya üzeri önerilir)
* npm
* Telegram Bot Token (BotFather üzerinden alınabilir)

## Proje Oluşturma

Yeni bir Node.js projesi oluşturmak için:

```bash
npm init -y
```

Bu komut proje için gerekli olan `package.json` dosyasını oluşturur.

## Gerekli Paketlerin Kurulumu

Telegram Bot API ve ortam değişkenleri desteği için:

```bash
npm install node-telegram-bot-api dotenv
```

### Kurulan Paketler

| Paket                 | Açıklama                                                    |
| --------------------- | ----------------------------------------------------------- |
| node-telegram-bot-api | Telegram Bot API ile iletişim kurmak için kullanılır.       |
| dotenv                | `.env` dosyasındaki ortam değişkenlerini uygulamaya yükler. |

## .env Dosyası Oluşturma

Proje dizininde `.env` dosyası oluşturun:

```env
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
```

Bot tokenınızı Telegram'daki BotFather üzerinden alabilirsiniz.

## Kullanım

Uygulamayı çalıştırmak için:

```bash
node index.js
```

Başarılı şekilde çalıştığında terminalde aşağıdaki benzeri bir çıktı göreceksiniz:

```text
Bot çalışıyor...
```

Bot artık Telegram üzerinden gelen mesajları dinlemeye hazırdır.
