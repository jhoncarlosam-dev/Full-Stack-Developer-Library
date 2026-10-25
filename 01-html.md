# HTML

HTML describe qué hay en la página: títulos, párrafos, enlaces, imágenes, formularios. No pinta el color ni decide qué pasa al pulsar un botón. El color es [02-css-y-tailwind.md](02-css-y-tailwind.md). El botón es [03-javascript.md](03-javascript.md).

## Cuándo usarlo y cuándo no

Úsalo siempre que haya una pantalla. Aunque más adelante uses React, el resultado que ve el navegador sigue siendo HTML.

No lo uses para guardar datos ni para esconder un secreto: cualquiera puede ver el código fuente. Una contraseña escrita en el HTML no está escondida.

## Básico

Una página que se abre con doble clic, sin servidor.

`index.html`

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Notas de Ada</title>
  </head>
  <body>
    <header>
      <h1>Notas de Ada</h1>
      <nav>
        <a href="#lista">Lista</a>
        <a href="#nueva">Nueva</a>
      </nav>
    </header>
    <main>
      <section id="lista">
        <h2>Pendientes</h2>
        <ul>
          <li>Revisar el formulario</li>
          <li>Subir la página a un sitio estático</li>
        </ul>
      </section>
      <section id="nueva">
        <h2>Nueva nota</h2>
        <form action="#lista">
          <label for="titulo">Título</label>
          <input id="titulo" name="titulo" type="text" required maxlength="80">
          <button type="submit">Guardar</button>
        </form>
      </section>
    </main>
  </body>
</html>
```

Qué tiene que estar, aunque la página sea pequeña:

- `<!doctype html>` para que el navegador no entre en modo antiguo.
- `lang="es"` para lectores de pantalla y correctores.
- `charset="utf-8"` para tildes y eñes.
- `viewport` para que el teléfono no la muestre empequeñecida. Sin esta línea, el CSS del móvil "no funciona" y el fallo es el HTML.
- Un solo `h1`. Los `h2` son secciones, no "letras más grandes". El tamaño se cambia con CSS.
- Cada input con su `<label for="id">`. El `name` es lo que viaja al enviar el formulario. El `id` es lo que usa el label.

Comprueba: abre el archivo en el navegador. El título de la pestaña es "Notas de Ada". Pulsar "Lista" salta a la lista.

## Intermedio

Formulario que un servidor puede entender, con los tipos de campo correctos y mensajes del propio navegador.

```html
<form action="/notas" method="post">
  <label for="titulo">Título</label>
  <input id="titulo" name="titulo" type="text" required maxlength="80" autocomplete="off">

  <label for="detalle">Detalle</label>
  <textarea id="detalle" name="detalle" rows="4" maxlength="2000"></textarea>

  <label for="cuando">Fecha</label>
  <input id="cuando" name="cuando" type="date">

  <fieldset>
    <legend>Prioridad</legend>
    <label><input type="radio" name="prioridad" value="baja" checked> Baja</label>
    <label><input type="radio" name="prioridad" value="alta"> Alta</label>
  </fieldset>

  <button type="submit">Guardar</button>
</form>
```

Reglas que evitan bugs de los que luego se culpa a JavaScript:

- `method="post"` cuando creas o cambias datos. `get` mete los campos en la URL y se guarda en el historial.
- `button type="submit"` dentro del formulario. Un `<button>` sin tipo también envía. Un botón que solo abre un diálogo lleva `type="button"`, si no, envía el formulario.
- Radios del mismo grupo comparten `name` y se distinguen por `value`.
- `required` y `maxlength` son la primera barrera. El servidor tiene que repetir la validación: el HTML se puede saltar. Ver [09-api-rest.md](09-api-rest.md).

Lista de verdad, no una tabla para maquetar:

```html
<table>
  <caption>Notas abiertas</caption>
  <thead>
    <tr><th>Título</th><th>Prioridad</th></tr>
  </thead>
  <tbody>
    <tr><td>Revisar el formulario</td><td>Alta</td></tr>
  </tbody>
</table>
```

La tabla es para datos en filas y columnas. Una página de presentación se arma con `header`, `main`, `section` y CSS.

Imágenes y enlaces con ruta relativa al archivo:

```html
<img src="img/portada.jpg" alt="Cuaderno abierto sobre una mesa" width="800" height="450">
<a href="notas/abril.html">Notas de abril</a>
<a href="https://developer.mozilla.org/es/docs/Web/HTML" rel="noreferrer">MDN</a>
```

`alt` describe la imagen para quien no la ve. Si la imagen es decorativa, `alt=""`. `width` y `height` reservan el hueco y la página no salta al cargar.

## Avanzado

Lo que se rompe cuando la página la usa otra persona, un lector de pantalla o un buscador.

Formulario que no depende solo del color y del placeholder:

```html
<label for="correo">Correo</label>
<input
  id="correo"
  name="correo"
  type="email"
  required
  autocomplete="email"
  aria-describedby="correo-ayuda"
>
<p id="correo-ayuda">Lo usamos solo para avisarte de un cambio.</p>
```

- El placeholder no sustituye al label: desaparece al escribir.
- `autocomplete` con el valor estándar (`email`, `current-password`, `new-password`) es lo que permite al gestor de contraseñas rellenar solo.
- No pongas la contraseña en un `<input type="text">`. Usa `type="password"` y, en el servidor, un hash. Ver [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-guardar-password).

Contenido que se inyecta más tarde (cuando llegue JavaScript) necesita un hueco anunciado:

```html
<div id="avisos" role="status" aria-live="polite"></div>
<ul id="lista"></ul>
```

Si metes HTML escrito por el usuario con `innerHTML`, ese usuario puede ejecutar código en la sesión de otra persona. En el nivel avanzado el texto de una nota se inserta como texto, no como HTML. El patrón está en [03-javascript.md](03-javascript.md).

Página estática en internet, sin Node: el checkpoint de abajo. Un bucket S3 con el HTML es el mismo tipo de publicación; el costo y los permisos están en [14-aws-basico.md](14-aws-basico.md).

## Errores frecuentes

<a id="sintoma-pagina-en-blanco"></a>

### La página sale en blanco y la consola está vacía

Causa habitual: el archivo que abres no es el que editaste, o el HTML está tan roto que el navegador no muestra el `body` (un `<head>` sin cerrar y el contenido quedó dentro del head, que no se pinta).

Arreglo: clic derecho, "Ver código fuente". Si no está tu `<h1>`, estás mirando otro archivo. Si está, busca una etiqueta abierta sin su cierre justo antes del contenido que falta. El inspector (F12, pestaña Elementos) muestra el árbol ya interpretado: ahí se ve si tu `main` acabó dentro de `head`.

Si la consola tiene un error rojo, el caso es otro: [03-javascript.md](03-javascript.md#sintoma-pagina-en-blanco-js).

<a id="sintoma-formulario-recarga"></a>

### El formulario recarga la página y pierde lo escrito

Causa habitual: el botón es `type="submit"` y no hay JavaScript que haga `preventDefault`, o sí lo hay pero el script falló antes de registrarse.

Arreglo de diagnóstico: quita el script. Si al enviar se recarga, el HTML está haciendo su trabajo. Para quedarte en la página, el manejador tiene que ejecutarse. Patrón en [03-javascript.md](03-javascript.md). Mientras tanto, pon `method` y `action` reales: si el script falla, el navegador aún puede enviar los datos al servidor.

<a id="sintoma-imagen-rota"></a>

### La imagen sale rota

Causa habitual: la ruta se calculó desde el navegador, no desde el archivo. `src="img/portada.jpg"` es relativo a la URL de la página. Si la página es `/notas/abril.html`, el navegador pide `/notas/img/portada.jpg`.

Arreglo: en la pestaña Red, mira la URL exacta que devolvió 404. Muévela a esa carpeta o cambia el `src` a una ruta desde la raíz del sitio: `src="/img/portada.jpg"`. En un sitio con subcarpetas, la barra inicial evita el error. Comprueba también mayúsculas: `Portada.jpg` y `portada.jpg` son archivos distintos en Linux.

<a id="sintoma-enlace-roto"></a>

### El enlace no lleva a ningún lado o baja un archivo

Causa habitual: `href` vacío, `href="#"` o una ruta a un archivo sin extensión que el servidor ofrece como descarga. Otro caso: usaste `<button>` con un `href`, que no existe; el atributo se ignora.

Arreglo: un enlace de verdad es `<a href="abril.html">`. Un control que no navega es `<button type="button">`. Si al pulsar se descarga, el servidor no está sirviendo ese archivo como página; abre la URL directa y lee el código de estado en la pestaña Red.

## Cómo comprobar

1. Abre `index.html` con doble clic o con un servidor estático (`npx serve`), que es más fiel a una URL real.
2. Recorre la página solo con el teclado: Tab debe entrar a cada enlace y cada campo, en un orden que se entiende.
3. Envía el formulario vacío. El navegador debe señalar el campo `required`.
4. Cambia el ancho de la ventana. Sin CSS todavía se verá simple; no debe haber texto cortado por falta de `viewport`.
5. Desactiva CSS e imágenes en el inspector o lee el HTML en voz alta. Si no se entiende, la estructura no está lista para el checkpoint.

## Si esto no alcanza

Busca en MDN, en español o en inglés:

- `mdn html forms`
- `mdn input types`
- `mdn viewport meta`
- `mdn img alt`
- `mdn content security policy` cuando vayas a publicar

## Checkpoint — página estática (60 a 90 minutos)

Una página tuya, un solo `index.html`, sin framework y sin JavaScript:

- Tu nombre o el de un proyecto, un párrafo y una lista de tres piezas de trabajo o de estudio.
- Un formulario de contacto con label, campo obligatorio y botón. Puede usar `action="mailto:tu@correo"` solo para este ejercicio; en una app real el correo lo manda el servidor, ver [14-aws-basico.md](14-aws-basico.md).
- Una imagen local con `alt` y medidas.
- Un enlace interno a una segunda sección y un enlace externo.

Hecho cuando otra persona abre el archivo y puede leerlo, tabular el formulario y pulsar los dos enlaces sin que tú expliques nada.
