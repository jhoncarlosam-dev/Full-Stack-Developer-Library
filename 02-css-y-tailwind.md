# CSS y Tailwind

CSS decide cómo se ve el HTML: tamaño, color, espacio y si cabe en el teléfono. Tailwind es un conjunto de clases ya definidas (`flex`, `p-4`, `text-lg`) para no escribir un archivo CSS enorme en cada pantalla. El mapa deja Tailwind para junto a React, y se puede retomar después del backend. El CSS de esta página hace falta antes: sin él la página estática del checkpoint se lee, pero no se usa.

## Cuándo usarlo y cuándo no

Usa CSS en cuanto haya más de un bloque en la página. Usa Tailwind cuando el proyecto ya tiene Node y un empaquetador (Vite, en la ficha de React). No hace falta Tailwind para el checkpoint de la página estática.

No uses una tabla, ni `position: absolute` en todo, para "colocar cosas". Eso se rompe en cuanto cambia el texto o el ancho.

## Básico

En el `<head>` del HTML:

```html
<link rel="stylesheet" href="estilos.css">
```

`estilos.css`, al lado de `index.html`:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1c1917;
  background: #fafaf9;
}

main {
  max-width: 40rem;
  margin-inline: auto;
  padding: 1.5rem;
}

label, button { display: block; }
input, textarea, button { width: 100%; max-width: 24rem; }

.nota {
  border: 1px solid #d6d3d1;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-block: 0.75rem;
}
```

Tres decisiones que evitan la mitad de los bugs de maquetación:

- `box-sizing: border-box` hace que `width` incluya el relleno y el borde. Sin esto, un bloque de 100% más un padding se sale del padre.
- `max-width` y `margin-inline: auto` centran la columna sin posiciones absolutas.
- `system-ui` usa la letra del sistema. No dependes de una fuente descargada para que el texto se lea.

Clases para lo que se repite (`.nota`). El estilo suelto en `style=""` solo para una prueba que vas a borrar.

Comprueba: el texto no toca los bordes de la ventana y los campos no se salen de la columna.

## Intermedio

Layout que aguanta un título largo y un ancho estrecho. Primero en CSS. El equivalente Tailwind está debajo, para cuando llegues a Vite.

```css
.barra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

@media (max-width: 40rem) {
  .barra { flex-direction: column; align-items: stretch; }
}
```

`auto-fit` y `minmax` hacen la rejilla sin una media query por cada ancho. La media query queda para el caso que de verdad cambia de estructura, como una barra que pasa a columna.

Tailwind, cuando el proyecto ya es el de [06-react.md](06-react.md). Instalación mínima con Vite:

```bash
npm install tailwindcss @tailwindcss/vite
```

`vite.config.js`

```js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

En el CSS de entrada, una sola línea: `@import "tailwindcss";`

El mismo layout, en clases:

```html
<header class="flex flex-wrap items-center justify-between gap-3">
  <h1 class="text-xl font-semibold">Notas</h1>
  <nav class="flex gap-3">
    <a class="underline" href="#lista">Lista</a>
  </nav>
</header>
<main class="mx-auto grid max-w-xl gap-4 p-6 sm:grid-cols-2">
  <article class="rounded-lg border border-stone-300 p-4">Una nota</article>
</main>
```

Traducción que conviene tener a mano: `p-4` es 1rem de padding, `gap-3` es 0.75rem, `max-w-xl` limita el ancho, `sm:` aplica desde 640px hacia arriba. Tailwind es mobile-first: la clase sin prefijo es el teléfono; `sm:` y `md:` amplían.

No mezcles un CSS propio enorme con Tailwind "por si acaso". Elige uno por proyecto. En esta biblioteca, la página estática va en CSS y la app React va en Tailwind.

## Avanzado

Lo que se rompe en producción no es el color: es el contraste, el foco y el contenido que crece.

```css
:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}

body { font-size: 1rem; }
h1 { font-size: clamp(1.5rem, 2vw + 1rem, 2.25rem); }
```

- No quites el outline del foco sin poner otro. Quien usa teclado deja de ver dónde está.
- Texto sobre fondo: si dudas, fondo claro y texto casi negro. El gris claro sobre blanco falla en un móvil al sol.
- `clamp` evita un título gigante en el escritorio y diminuto en el teléfono, sin cortar palabras con un alto fijo.
- No fijes alturas en tarjetas (`height: 120px`) si el título puede ocupar dos líneas. Usa `min-height` o deja que crezcan.
- Una animación no es obligatoria. Si la usas, respeta `prefers-reduced-motion` para quien pidió al sistema menos movimiento.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none; transition: none; }
}
```

En Tailwind el foco visible ya viene en los controles nativos. Si dibujas un `div` que actúa de botón, le faltan tab, Enter y el anillo de foco: usa `<button>`.

## Errores frecuentes

<a id="sintoma-encimados"></a>

### Los elementos se enciman o se salen de la pantalla

Causa habitual: un ancho en píxeles mayor que la ventana, un `position: absolute` sin padre relativo, o un flex hijo con `min-width: auto` que no quiere encogerse (pasa mucho con una palabra larga o un `<pre>`).

Arreglo: en el inspector, mira la caja del elemento que se sale. Si el ancho es fijo, cámbialo a `max-width: 100%`. En una fila flex, al hijo que empuja ponle `min-width: 0` (en Tailwind, `min-w-0`). Quita el `absolute` y vuelve al flujo: `flex` o `grid` con `gap`.

<a id="sintoma-movil"></a>

### En el teléfono se ve roto y en el escritorio no

Causa habitual: falta `<meta name="viewport" content="width=device-width, initial-scale=1">`, o escribiste las media queries al revés (estilos de escritorio como base y el móvil no los pisa).

Arreglo: confirma el viewport en [01-html.md](01-html.md). En Tailwind, diseña primero sin prefijo (el ancho estrecho) y añade `sm:` solo donde el escritorio cambia. En CSS propio, prueba el ancho en el inspector (modo dispositivo) a 360px antes de dar el layout por bueno.

<a id="sintoma-tailwind-no-aplica"></a>

### Las clases de Tailwind no se aplican

Causa habitual, en este orden:

1. No importaste Tailwind en el CSS de entrada, o ese CSS no está importado desde `main.jsx`.
2. El plugin no está en `vite.config.js` y tampoco hay un `tailwind.config.js` si usas la versión antigua (v3). La v4 usa `@tailwindcss/vite` y `@import "tailwindcss"`. No mezcles las instrucciones de las dos versiones.
3. El nombre de la clase está armado a trozos en una cadena: `` className={`text-${color}-600`} ``. Tailwind no lo ve al construir y no genera la clase.

Arreglo: deja la clase completa escrita en el archivo (`text-red-600`) o guárdala entera en un mapa. Reinicia `npm run dev` después de tocar la config. En el inspector, si la clase está en el HTML pero no hay regla CSS, el generador no la incluyó.

## Cómo comprobar

1. A 360px, 768px y ancho completo no hay scroll horizontal. El inspector lo marca si existe.
2. Tab muestra dónde está el foco en enlaces y botones.
3. Un título de 80 caracteres no tapa el botón de al lado: la fila salta de línea.
4. Si usas Tailwind, borra una clase y recarga: el cambio se ve. Si no se ve, no está conectado, aunque el archivo "esté bien".

## Si esto no alcanza

En MDN: `mdn flexbox`, `mdn grid auto-fit`, `mdn box-sizing`, `mdn focus-visible`.

En la documentación de Tailwind: `tailwind installation vite`, y el nombre exacto de la clase (`tailwind min-w-0`, `tailwind responsive sm`).

## Checkpoint — página estática presentable (45 a 60 minutos)

Sobre la página de [01-html.md](01-html.md), con CSS propio, sin Tailwind:

- Columna centrada, texto que no toca el borde.
- Lista o tarjetas con espacio uniforme (`gap` o `margin`).
- Formulario apilado en estrecho y legible en ancho.
- Foco visible con teclado.

Hecho cuando, a 360px y en ancho de escritorio, no hay que desplazar en horizontal para leer o pulsar.

El checkpoint de Tailwind va con la app de React, en [06-react.md](06-react.md): la misma pantalla, hecha con clases, dentro de Vite.
