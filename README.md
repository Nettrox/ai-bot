# AI Project Agent

Odysseus API uzerinden calisan yerel bir proje olusturma ve guncelleme CLI araci.

Bu arac bir klasor secer, kullanicidan istek alir, mevcut projeyi modele baglam olarak gonderir ve modelden gelen JSON plana gore dosya olusturur, hedefli patch uygular, siler ve gerekirse kurulum komutlarini calistirir.

## Gereksinimler

- Node.js 18+
- Calisan Odysseus sunucusu

Varsayilan API adresi:

```txt
http://127.0.0.1:7000
```

Ortam degiskenleri:

```bash
ODYSSEUS_BASE_URL=http://127.0.0.1:7000
ODYSSEUS_MODEL=gpt-5.5
ODYSSEUS_ENDPOINT_URL=https://chatgpt.com/backend-api/codex/responses
```

## Kullanım

Etkilesimli kullanim:

```bash
npm start
```

Klasoru ve istegi komut satirindan vermek:

```bash
node index.js --folder /path/to/project --request "Login sayfasina validasyon ekle"
```

On izleme:

```bash
node index.js --dry-run --folder /path/to/project --request "Dashboard tasarimini duzenle"
```

Son dry-run planini uygulama:

```bash
node index.js --apply-dry-run --folder /path/to/project
```

Son backup'a geri donme:

```bash
npm run rollback -- --folder /path/to/project
```

## Proje Yapısı

```txt
.
├── index.js
├── rollback.js
├── package.json
├── prompt/
│   └── project_generator.txt
├── src/
│   ├── cli.js
│   ├── commandRunner.js
│   ├── config.js
│   ├── dryRun.js
│   ├── input.js
│   ├── logger.js
│   ├── odysseusClient.js
│   ├── projectApplier.js
│   ├── projectPlan.js
│   ├── projectScanner.js
│   ├── promptBuilder.js
│   ├── sessionStore.js
│   └── utils.js
```

## Akış

1. Proje klasoru secilir.
2. Klasorde `.session_id.txt` varsa onceki Odysseus session'i kullanilir.
3. Session yoksa yeni session olusturulur.
4. Klasor doluysa proje mevcut kabul edilir ve dosyalar/snapshot modele baglam olarak gonderilir.
5. Modelden yalnizca gecerli JSON beklenir.
6. JSON dogrulanir.
7. Mevcut projede degisiklik yapilacaksa once `.backup` altina yedek alinir.
8. Yeni dosyalar yazilir, mevcut dosyalara `patches` ile hedefli degisiklik uygulanir.
9. `.context/project_snapshot.json` guncellenir.
10. Loglar `.logs` altina yazilir.

## Model JSON Sözleşmesi

Modelin yaniti su formata uymalidir:

```json
{
  "action": "update",
  "project_name": "proje-adi",
  "description": "kisa-aciklama",
  "install_commands": [],
  "run_commands": [],
  "folders": [],
  "files": [
    {
      "path": "src/main.js",
      "content": "console.log('hello');\n"
    }
  ],
  "patches": [
    {
      "path": "src/existing.js",
      "search": "const oldValue = true;\n",
      "replace": "const oldValue = false;\n"
    }
  ],
  "delete_files": []
}
```

Bu sozlesmenin ayrintilari [prompt/project_generator.txt](prompt/project_generator.txt) icindedir.

## Güvenlik Notları

- `.env`, `.session_id.txt`, lock dosyalari, `.git`, `node_modules`, `.backup`, `.logs`, `.context`, `.dry-run`, `dist` ve `build` korunur.
- `sudo`, `rm -rf`, `format`, `shutdown` gibi riskli komutlar engellenir.
- Yine de modelden gelen komutlar shell ile calistirilir. Bu arac guvenilen yerel projelerde kullanilmalidir.
- `rollback.js`, secilen proje klasorunu son backup ile degistirir. Kullanmadan once dogru klasoru sectiginden emin ol.

## Komutlar

```bash
npm run check
npm run dry-run -- --folder /path/to/project --request "..."
npm run apply -- --folder /path/to/project
npm run rollback -- --folder /path/to/project
```
