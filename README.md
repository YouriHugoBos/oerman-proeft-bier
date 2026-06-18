# 🦣 Caveman Beer Tasting

Mini web-app voor een blinde biertasting met je vriendengroep, in de stijl van *Poetry for Neanderthals*. Volledig client-side, geen server.

## Bestanden
- `index.html` — de app (4 schermen: setup, QR, spelen, score)
- `styles.css` — de oer-stijl (geel/zwart/rood)
- `app.js` — alle logica (config-in-URL, QR, scoring)
- `qrcode.min.js` — QR-generator (lokaal gevendord, niets gaat naar externe diensten)

## Zo werkt het
1. **Jij (spelleider)** opent de app, tikt de biertjes + juiste antwoorden in en drukt op **MAAK QR-STEEN**. De hele config zit gecodeerd in de QR/URL — geen server nodig.
2. **Spelers** scannen de QR met hun telefooncamera, vullen hun oer-naam in en proeven op eigen tempo.
3. **Eindscherm** toont per speler de score + onthulling van de juiste antwoorden. Telefoons op tafel om te vergelijken; pochen kan via de WhatsApp-knop.

Let op: jij kent als spelleider alle antwoorden, dus speel zelf niet mee. Nummer de glazen 1, 2, 3… zodat scherm en glas matchen.

## Puntentelling
| Veld | Punten |
|---|---|
| Soort goed | 2 |
| Hazy goed | 1 |
| Smaakprofiel goed (fris/fruitig/moutig/bitter) | 1 |
| Alcohol% binnen ±0,5% | 2 (±1,0% → 1) |
| Naam goed (soepele match) | 5 |
| Oordeel (1–5 🦴 botten) | niet-scorend (hoogst beoordeelde = groeps-favoriet ⭐) |

## Publiceren op GitHub Pages
Deze bestanden horen in de **root** van het repo `oerman-proeft-bier` te staan (niet in een submap):

1. Push de bestanden naar `git@github.com:YouriHugoBos/oerman-proeft-bier.git` (branch `main`).
2. Ga naar **Settings → Pages**, kies bij *Source* de branch `main` en map `/ (root)`, en sla op.
3. Na ~1 minuut staat de app op `https://yourihugobos.github.io/oerman-proeft-bier/`.

Daarna open je die URL, vul je de biertjes in en laat je iedereen de QR scannen. 🍺
