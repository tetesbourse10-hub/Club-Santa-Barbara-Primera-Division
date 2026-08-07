# Fuentes para las imágenes de preview de jugador

`scripts/generate-og.js` necesita estos dos archivos acá (no están incluidos
en el repo — no tuve forma de descargarlos desde este entorno):

- `Inter-Regular.ttf` (peso 400)
- `Inter-Bold.ttf` (peso 700 u 800)

Se pueden bajar gratis desde Google Fonts:
https://fonts.google.com/specimen/Inter

Sin estos archivos, `npm run build` va a fallar con un mensaje claro
indicando qué falta — el sitio en sí (`index.html`) no depende de ellos
para nada, solo el paso de generación de imágenes de preview.
