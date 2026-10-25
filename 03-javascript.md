# JavaScript

JavaScript es lo que hace cambiar la página sin pedir otro HTML completo: leer un campo, añadir una fila, pedir datos a una API. En el navegador trabaja con el DOM (el árbol de etiquetas ya construido). En el servidor, el mismo lenguaje se usa con Node; eso es [07-nodejs.md](07-nodejs.md). Aquí es solo el navegador.

## Cuándo usarlo y cuándo no

Úsalo cuando el HTML y el CSS ya muestran la pantalla y falta comportamiento. No lo uses para lo que HTML ya hace solo: saltar a una sección, marcar un campo obligatorio, enviar un formulario a una URL.

Si copias un ejemplo y no sabes qué línea corresponde a tu botón, no lo pegues entero. Localiza el id y el evento, y adapta solo eso.

## Básico

El script va al final del `body` para que el HTML ya exista, o en el `head` con `defer`:

```html
<script src="app.js" defer></script>
```

`app.js`, una lista en memoria que se pinta al pulsar:

```js
const form = document.querySelector("#nueva");
const lista = document.querySelector("#lista");
const titulo = document.querySelector("#titulo");
const notas = [];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const texto = titulo.value.trim();
  if (!texto) return;

  notas.push({ id: crypto.randomUUID(), texto });
  titulo.value = "";
  pintar();
});

function pintar() {
  lista.replaceChildren();
  for (const nota of notas) {
    const li = document.createElement("li");
    li.textContent = nota.texto;

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.textContent = "Borrar";
    borrar.addEventListener("click", () => {
      const i = notas.findIndex((n) => n.id === nota.id);
      notas.splice(i, 1);
      pintar();
    });

    li.append(borrar);
    lista.append(li);
  }
}
```

Por qué está escrito así:

- `preventDefault` evita la recarga del síntoma del formulario.
- `textContent` mete texto. `innerHTML` mete HTML y, con texto de un usuario, es un agujero. No lo uses para notas, nombres o comentarios.
- `crypto.randomUUID()` da un id sin instalar nada. El índice del array cambia al borrar; el id no.
- Un solo sitio pinta (`pintar`). Si añades y borras tocando el DOM a mano en dos funciones, se desincronizan.

Comprueba: añadir dos notas, borrar la primera, recargar. Al recargar desaparecen. Eso es correcto en este nivel: viven en la variable `notas`. La persistencia es el nivel intermedio.

## Intermedio

Guardar en el navegador, y pedir datos sin congelar la página.

```js
const CLAVE = "notas";

function leer() {
  const crudo = localStorage.getItem(CLAVE);
  if (!crudo) return [];
  try {
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function guardar(notas) {
  localStorage.setItem(CLAVE, JSON.stringify(notas));
}
```

`localStorage` solo guarda strings, solo en ese navegador, y el usuario puede borrarlo. No guardes ahí un token de sesión ni una contraseña. Para datos de varias personas hace falta el servidor y PostgreSQL.

Pedir JSON a una API y mostrar el fallo:

```js
async function cargarNotas() {
  const aviso = document.querySelector("#avisos");
  aviso.textContent = "Cargando…";
  try {
    const respuesta = await fetch("/api/notas");
    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }
    const notas = await respuesta.json();
    aviso.textContent = "";
    return notas;
  } catch (error) {
    aviso.textContent = "No se pudieron cargar las notas.";
    console.error(error);
    return [];
  }
}
```

`fetch` no lanza un error cuando el servidor responde 404 o 500. Hay que mirar `respuesta.ok`. El `catch` cubre red caída, CORS que bloquea la lectura y un JSON inválido. El usuario ve una frase; el detalle queda en la consola.

Manda JSON al crear:

```js
await fetch("/api/notas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ titulo: texto }),
});
```

Sin el header `Content-Type`, el servidor puede no interpretar el cuerpo. Ese síntoma está en [09-api-rest.md](09-api-rest.md#sintoma-body-vacio).

## Avanzado

Lo que se rompe con varios clics y con datos que no controlas.

Un envío doble crea dos notas. Desactiva el botón mientras dura la petición:

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await crearNota(titulo.value.trim());
    titulo.value = "";
    await pintarDesdeServidor();
  } finally {
    boton.disabled = false;
  }
});
```

`finally` corre aunque haya error. Si el `disabled = false` estuviera solo al final del `try`, un fallo dejaría el botón muerto.

No construyas HTML con los datos:

```js
// Mal: si texto es '<img src=x onerror=alert(1)>', se ejecuta.
lista.innerHTML = notas.map((n) => `<li>${n.texto}</li>`).join("");
```

El patrón de `createElement` y `textContent` del básico aguanta ese texto. Si alguna vez necesitas HTML de una plantilla, los datos van por texto aparte, nunca concatenados.

`localStorage` se llena (sobre 5 MB) y además es síncrono: un JSON enorme traba la página. Ahí los datos ya no son "borrador local"; son del servidor.

Módulo en el navegador, cuando el archivo crece:

```html
<script type="module" src="app.js"></script>
```

```js
import { pintar } from "./pintar.js";
```

Los módulos se cargan en diferido y las variables no quedan globales. Hay que servir la página por HTTP (`npx serve`); abrir el archivo con doble clic suele bloquear el `import`.

## Errores frecuentes

<a id="sintoma-pagina-en-blanco-js"></a>

### La página sale en blanco y la consola tiene un error rojo

Causa habitual: una excepción en el script antes de pintar, o un React que se desmonta (ese caso, en [06-react.md](06-react.md#sintoma-pantalla-en-blanco)). En JS puro, un error en la primera línea del script detiene el resto. La página se ve vacía si el contenido lo iba a crear el script.

Arreglo: lee la primera línea de la consola. Abre el archivo y la línea que indica. Un error típico es llamar a `pintar()` antes de definirla de una forma que aún no existe, o un `import` que 404. Arregla esa línea, recarga y mira si aparece el siguiente error. Uno por vez, como en [00-metodo-sin-ia.md](00-metodo-sin-ia.md).

<a id="sintoma-null"></a>

### `Cannot read properties of null` o de `undefined`

Causa habitual: `querySelector` no encontró el elemento y el código hace `form.addEventListener`. El selector no coincide con el id, o el script corrió antes de que existiera el HTML (falta `defer` y el script está en el `head`).

Arreglo: en la consola, ejecuta la misma cadena del `querySelector`. Si devuelve `null`, el id del HTML y el del JS no son el mismo, mayúsculas incluidas. Añade una guarda mientras depuras: `if (!form) throw new Error("falta #nueva");`. El mensaje nuevo es más claro que `null`.

<a id="sintoma-not-a-function"></a>

### `is not a function`

Causa habitual: el nombre no es el que crees. `notas.push` falla si `notas` es un objeto, no un array. `respuesta.json()` falla si llamaste `json` sobre otra cosa. También pasa al escribir `addEventListener` mal o al sombrear una función con una variable del mismo nombre.

Arreglo: justo antes de la línea, `console.log(typeof notas, notas)`. `typeof` de una función es `"function"`. Si es `"object"` o `"string"`, el valor se transformó antes: un `JSON.parse` de un objeto, o un campo del formulario en vez del array.

<a id="sintoma-boton-muerto"></a>

### El botón no hace nada

Causa habitual, en orden:

1. El script no se cargó (404 en la pestaña Red).
2. Hay un error anterior y esta línea no se llegó a ejecutar.
3. El botón es `type="submit"` y estás escuchando `click` en el botón mientras el `submit` del formulario recarga la página antes de que veas el efecto.
4. Escuchas `#guardar` y el id real es `#guardar-nota`.

Arreglo: consola limpia, recarga, mira si hay rojo. Pon el escuchador en el `submit` del formulario, con `preventDefault`, como en el básico. En la pestaña Elementos, el botón seleccionado muestra sus escuchadores (Events / Listeners).

<a id="sintoma-fetch-callado"></a>

### `fetch` no entra al `.then` ni muestra error

Causa habitual: falta el `return` delante de `respuesta.json()`, o la función es `async` y nadie hace `await` ni `.catch`. La promesa queda rechazada sin receptor. En Chrome eso aparece como "Uncaught (in promise)", fácil de no ver si la consola está filtrada a Warnings.

Arreglo: usa el `try/catch` del nivel intermedio alrededor de cada `await fetch`. Mira la pestaña Red: si la petición ni siquiera sale, la función no se llamó (vuelve al botón muerto). Si sale en rojo por CORS, el arreglo no es del `fetch`; es del servidor, en [09-api-rest.md](09-api-rest.md#sintoma-cors).

## Cómo comprobar

1. Consola sin errores al cargar, al añadir y al borrar.
2. Texto `<b>hola</b>` se ve como caracteres, no en negrita. Eso confirma que no hay `innerHTML`.
3. Dos clics rápidos en Guardar no crean dos notas (nivel avanzado) o, en el básico, al menos no recargan la página.
4. Con la red en "offline" en el inspector, la carga muestra el aviso y no una pantalla muda.
5. Recargar conserva las notas solo si ya usas `localStorage` o el servidor. Si desaparecen y aún estás en el básico, es lo esperado.

## Si esto no alcanza

En MDN: `mdn querySelector`, `mdn addEventListener`, `mdn fetch`, `mdn async await`, `mdn localStorage`, `mdn textContent`.

## Checkpoint — interactividad (60 a 90 minutos)

Sobre tu página estática, en un `app.js` sin frameworks:

- Añadir un elemento a una lista desde un formulario, sin recargar.
- Borrar un elemento concreto, no siempre el último.
- Un aviso visible si el campo va vacío.
- El texto se inserta con `textContent`.

Hecho cuando recargas y entiendes por qué se borra (aún no hay persistencia) y cuando un texto con `<` y `>` no altera la página.

Persistir en `localStorage` es el extra del nivel intermedio, no la condición para pasar.
