# Node.js

Node ejecuta JavaScript fuera del navegador. En esta biblioteca hace dos trabajos: programas de terminal (el checkpoint CLI) y el servidor HTTP de la API. El lenguaje es el de [03-javascript.md](03-javascript.md); cambian las herramientas (`fs`, `process`, red) y desaparece el `document`.

Comprueba la instalación:

```bash
node -v
npm -v
```

Hace falta la versión LTS (20 o 22). Si el número no sale, instálala desde nodejs.org y abre otra terminal.

## Cuándo usarlo y cuándo no

Úsalo para scripts (renombrar archivos, transformar un CSV) y para la API. El roadmap recomienda Node porque ya sabes JavaScript. Python, Java, PHP o C# cubren el mismo hueco; no hay un segundo tutorial aquí.

No uses Node para servir la página estática del primer checkpoint: con abrir el HTML basta. Tampoco lo uses para cálculos pesados de horas si un SQL bien escrito lo resuelve en [08-postgresql.md](08-postgresql.md).

## Básico

Un script que lee un CSV y escribe un resumen. `src/cli.js`:

```js
import { readFile } from "node:fs/promises";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node src/cli.js notas.csv");
  process.exitCode = 1;
  process.exit();
}

const texto = await readFile(ruta, "utf8");
const lineas = texto.split(/\r?\n/).filter(Boolean);
const cabecera = lineas.shift();
if (cabecera?.trim() !== "titulo") {
  console.error("La primera línea tiene que ser: titulo");
  process.exitCode = 1;
  process.exit();
}

let vacias = 0;
for (const linea of lineas) {
  if (linea.trim() === "") vacias += 1;
}
console.log(`Filas: ${lineas.length}`);
console.log(`Vacías: ${vacias}`);
```

`package.json` necesita `"type": "module"` para poder usar `import`. Si no está, Node dice que `import` no es válido fuera de un módulo: es el síntoma ESM de abajo, no un fallo del CSV.

```bash
node src/cli.js notas.csv
```

`process.argv[0]` es `node`, `[1]` es el archivo, `[2]` es tu primer argumento. `process.exitCode = 1` marca fallo sin cortar a medias los `console.log` pendientes; `process.exit()` sí corta, y aquí hace falta porque si no el script seguiría.

En Windows el CSV puede venir con `\r\n`. El `split(/\r?\n/)` cubre los dos. Si partes solo por `\n`, la cabecera queda como `"titulo\r"` y la comparación falla.

Servidor mínimo, solo para ver un puerto vivo. La API de verdad está en [09-api-rest.md](09-api-rest.md); aquí basta saber que Node escucha.

```js
import { createServer } from "node:http";

const puerto = Number(process.env.PORT) || 3000;
const servidor = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("ok");
});
servidor.listen(puerto, () => {
  console.log(`http://localhost:${puerto}`);
});
```

```bash
node src/server.js
```

Déjalo corriendo y, en otra terminal, `curl http://localhost:3000`. Tiene que imprimir `ok`. Para parar: Ctrl+C en la terminal del servidor.

## Intermedio

Variables de entorno y un proceso que no mezcla configuración con código.

Archivo `.env` en la raíz, nunca en Git:

```text
PORT=3000
DATABASE_URL=postgres://notas:notas@localhost:5432/notas
```

Node 20.6+ y 22 leen ese archivo sin paquete:

```bash
node --env-file=.env src/server.js
```

En el código solo se lee `process.env`. No hay valores de producción escritos en el archivo `.js`.

```js
const puerto = Number(process.env.PORT);
if (!puerto) {
  console.error("Falta PORT en el entorno");
  process.exit(1);
}
```

Si `PORT` no está, prefiere abortar a escuchar en un puerto sorpresa. El `|| 3000` del básico es cómodo en un ejercicio y peligroso en un servidor, porque esconde una configuración ausente.

Script de `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.js",
    "start": "node --env-file=.env src/server.js",
    "cli": "node --env-file=.env src/cli.js"
  }
}
```

`--watch` reinicia al guardar. Es el modo de trabajo. `start` es el que usará systemd en [15-despliegue.md](15-despliegue.md), sin watch.

Errores que no se tragan:

```js
process.on("unhandledRejection", (error) => {
  console.error(error);
  process.exit(1);
});
```

Un `await` olvidado dentro de un `setTimeout`, o una promesa sin `catch`, puede tumbar el proceso más tarde con un mensaje pobre. Este escuchador imprime la causa y sale. Quien debe volver a levantarlo es Monit o systemd, no un `catch` vacío. Ver [16-monitoreo.md](16-monitoreo.md).

Estructura que aguanta el resto de la biblioteca:

```text
src/cli.js        scripts de terminal
src/server.js     arranque HTTP
src/db.js         conexión a PostgreSQL
.env              secretos locales, en .gitignore
```

Un archivo por tema. Cuando `server.js` pase de ~150 líneas, se parte por rutas (`src/notas.js`), no por "capas" con nombres vacíos.

## Avanzado

Lo que se rompe cuando el proceso vive en un servidor y hay más de una petición a la vez.

Node hace una sola cosa a la vez en el hilo de JavaScript. Una función síncrona pesada (`readFileSync` de un archivo grande, un `JSON.parse` enorme, un bucle de millones) congela todas las peticiones, también las que "ya habían llegado". Lectura de archivos de usuario: `fs/promises`. CPU de verdad (imagen, zip, informe): otro proceso, o un trabajo en cola. No lo resuelvas poniendo más `async` alrededor de un bucle síncrono: `async` no mueve ese trabajo a otro hilo.

Cierre ordenado, para que un reinicio no corte una respuesta a medias:

```js
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
```

systemd manda `SIGTERM` al parar el servicio. Sin este bloque, las peticiones en curso se cortan. El temporizador evita quedarse colgado si alguna conexión no termina.

No loguees el cuerpo completo de un login ni el valor de `Authorization`. Loguea método, ruta, código y milisegundos:

```js
servidor.on("request", (req, res) => {
  const inicio = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - inicio}ms`);
  });
});
```

Eso, redirigido a journald en [13-linux.md](13-linux.md), es el log que vas a leer a las once de la noche.

El proceso de producción se arranca con `node src/server.js`, no con `npm run dev` ni con `--watch`. El usuario del servicio no es root. Esas dos decisiones están aplicadas en el despliegue, pero se deciden aquí: si el código solo funciona corriendo como administrador o vigilando archivos, no está listo.

## Errores frecuentes

<a id="sintoma-puerto"></a>

### `EADDRINUSE`, el puerto está ocupado

Causa habitual: ya hay un Node con ese puerto, a menudo un `--watch` que no mataste, o dos proyectos en el 3000.

Arreglo en Windows (PowerShell):

```powershell
netstat -ano | findstr :3000
taskkill /PID EL_NUMERO /F
```

El número de la última columna es el PID. Mata ese PID, no el primero que veas en la lista si hay varias líneas: busca el que está en `LISTENING`.

En Linux:

```bash
ss -ltnp | grep :3000
kill EL_PID
```

Si el proceso es el servicio systemd, no lo mates a mano: `sudo systemctl restart notas`. Ver [13-linux.md](13-linux.md#sintoma-servicio).

<a id="sintoma-esm"></a>

### `require is not defined`, o el `import` falla

Causa habitual: el archivo usa `import` y `package.json` no tiene `"type": "module"`. Al revés: un ejemplo viejo con `require` dentro de un proyecto que sí es módulo.

Arreglo: elige uno. En esta biblioteca todo es ESM.

```json
{ "type": "module" }
```

```js
import express from "express";
```

Los imports de archivos tuyos llevan extensión: `import { pool } from "./db.js";`. Node no rellena `.js` como a veces hace el navegador empaquetado por Vite. Un directorio importado tiene que tener `index.js` y tú igual escribes la ruta completa si no es un paquete.

`__dirname` no existe en ESM. La ruta del archivo actual es:

```js
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const env = join(aqui, "..", ".env");
```

<a id="sintoma-env"></a>

### `process.env.ALGO` es `undefined`

Causa habitual, en este orden:

1. Arrancaste con `node src/server.js` y olvidaste `--env-file=.env`.
2. El `.env` está en otra carpeta. `--env-file` es relativo al directorio desde el que lanzas el comando, no al archivo `.js`.
3. El nombre no coincide: `DATABASE_URL` en el archivo y `process.env.DATABASE` en el código. Sobran espacios: `PORT = 3000` a veces se lee mal; escribe `PORT=3000`.
4. En el servidor el `.env` no existe y las variables viven en systemd. Estás mirando el archivo local. Ver [15-despliegue.md](15-despliegue.md#sintoma-env-servidor).

Arreglo: imprime solo los nombres, nunca los valores si pueden ser secretos.

```js
console.log("PORT definido:", Boolean(process.env.PORT));
```

Si es `false`, el proceso no vio el entorno. Corrige el comando de arranque antes de tocar el código.

<a id="sintoma-muere-sin-log"></a>

### El proceso muere y no queda log

Causa habitual: se cerró la terminal, o el error fue a un `console.error` que nadie redirige, o un `unhandledRejection` en una versión que solo avisa. También pasa si el servicio de systemd tiene `StandardOutput=null` o estás mirando el archivo de log equivocado.

Arreglo en local: arranca en primer plano (`npm run dev`) y reproduce el fallo. El mensaje aparece en esa terminal. Si solo muere "en el servidor", el log es `journalctl -u notas -n 100 --no-pager`, no tu terminal de SSH de ayer. Deja puesto el escuchador de `unhandledRejection` del nivel intermedio para que la razón quede escrita antes de salir.

## Cómo comprobar

1. `node src/cli.js notas.csv` imprime el recuento y, si le pasas un archivo sin la cabecera, el código de salida no es 0 (`echo $LASTEXITCODE` en PowerShell, `echo $?` en bash justo después).
2. `curl http://localhost:3000` imprime `ok` mientras el proceso está en primer plano, y deja de conectar cuando haces Ctrl+C.
3. Renombra temporalmente `.env`. El proceso tiene que negarse a arrancar si falta `PORT`, no escuchar en silencio.
4. `git status` no lista `.env`.

## Si esto no alcanza

Documentación de Node: `nodejs fs promises`, `nodejs process argv`, `nodejs http server`, `nodejs --env-file`, `nodejs esm import`.

El texto de `EADDRINUSE` se busca literal si el mensaje incluye otra causa (permiso, puerto por debajo de 1024).

## Checkpoint — app de terminal (45 a 60 minutos)

Un script propio, con `npm run cli`, que:

- Recibe la ruta de un archivo por argumento y sale con código 1 si falta.
- Lee el archivo como texto UTF-8.
- Escribe por stdout un resumen (cuántas líneas, cuántas vacías, o la línea más larga).
- No usa el navegador.

Hecho cuando cambias el archivo de entrada y el resumen cambia, y cuando un argumento ausente no imprime un resumen falso de cero filas sin avisar.
