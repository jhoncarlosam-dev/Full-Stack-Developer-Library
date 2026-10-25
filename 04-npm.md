# npm

npm instala librerías y guarda los comandos del proyecto en `package.json`. Viene con Node. Si `node -v` y `npm -v` no imprimen un número, instala Node LTS desde nodejs.org y abre una terminal nueva.

El checkpoint del mapa es usar un paquete externo de verdad, no escribir tu propio validador de correos.

## Cuándo usarlo y cuándo no

Úsalo cuando el proyecto tenga más de un archivo de código o necesites una librería. Un `index.html` con un `app.js` del checkpoint de interactividad puede seguir sin npm.

No instales un paquete para una función de tres líneas que el lenguaje ya trae (`crypto.randomUUID`, `fetch`, `URL`). Cada dependencia es código ajeno que hay que actualizar.

## Básico

En una carpeta vacía del proyecto:

```bash
npm init -y
npm install validator
```

Quedan `package.json`, `package-lock.json` y `node_modules`. `node_modules` no se sube a Git. El lock sí. Ver [05-git-y-github.md](05-git-y-github.md).

`package.json`, la parte que importa:

```json
{
  "name": "notas",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node src/cli.js"
  },
  "dependencies": {
    "validator": "^13.15.0"
  }
}
```

`"private": true` evita publicar el proyecto en el registro de npm por accidente. `"type": "module"` permite `import` en Node. El número de `validator` será el que npm haya resuelto; no copies el de esta página si el tuyo es más nuevo.

Uso mínimo, `src/cli.js`:

```js
import validator from "validator";

const correo = process.argv[2] ?? "";
if (!validator.isEmail(correo)) {
  console.error("Correo no válido");
  process.exitCode = 1;
} else {
  console.log("Correo válido");
}
```

```bash
npm run dev -- ada@example.com
npm run dev -- no-es-un-correo
```

El `--` separa los argumentos de npm de los de tu script. Sin él, npm se queda el argumento.

`npm install` sin nombre, en un proyecto ya creado por otra persona, instala exactamente lo que dice el lock.

## Intermedio

Separa lo que corre en producción de lo que solo usas al desarrollar.

```bash
npm install express
npm install --save-dev vitest
```

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest run"
  }
}
```

- `dependencies`: hace falta para que la app arranque (express, pg, validator).
- `devDependencies`: hace falta para escribirla (vitest, vite). En el servidor de producción se instala con `npm ci --omit=dev`.
- `npm run dev` con `node --watch` reinicia al guardar. No hace falta nodemon para ese caso.
- `npm ci` borra `node_modules` e instala el lock tal cual. Úsalo en CI y en el servidor. `npm install` puede mover versiones dentro del rango `^` y cambiar el lock.

Versiones: `^13.15.0` acepta `13.x` nuevos y no acepta `14.0.0`. Para una app tuya, el lock fija el resto. No pongas `"*"` ni borres el lock "para que instale lo último": eso es cómo un lunes el proyecto deja de arrancar.

Un paquete que solo existe en el navegador se importa desde el frontend (Vite lo empaqueta). Un paquete de Node (`pg`, `express`) no se importa en un componente React: fallará en el navegador con `fs` o `net` inexistentes.

`.gitignore` mínimo junto al `package.json`:

```gitignore
node_modules/
.env
dist/
```

## Avanzado

Lo que se rompe cuando el proyecto vive más de una semana o lo instala otra máquina.

`npm ci` en el servidor y en GitHub Actions, nunca `npm install`. El install reescribe el lock si las ramas divergieron; el `ci` aborta si `package.json` y el lock no coinciden, que es lo que quieres.

Revisa qué entró:

```bash
npm ls --depth=0
npm audit
```

`npm audit` lista avisos conocidos. No ejecutes `npm audit fix --force` a ciegas: puede saltar una versión mayor y romper el proyecto. Lee el aviso. Si el paquete vulnerable es solo de desarrollo y no corre en producción, el riesgo es distinto a si es `express`.

Actualizar un paquete, de uno en uno:

```bash
npm outdated
npm install validator@13
npm test
```

Si los tests pasan, commiteas `package.json` y `package-lock.json` juntos. Nunca uno sin el otro.

El registro de npm puede estar caído o bloqueado. Un install reproducible no depende de "lo que hubiera ese día" gracias al lock. Guardar una copia del lock en Git es la contingencia; no hace falta un espejo propio en este nivel.

Paquetes que piden permisos de compilación nativa (`bcrypt` compilado, no `bcryptjs`) necesitan herramientas de C++ en la máquina. En un servidor mínimo eso falla con un error de `node-gyp`. Para contraseñas, `bcryptjs` es JavaScript puro y evita ese fallo. La comparación está en [20-seguridad-minima.md](20-seguridad-minima.md).

## Errores frecuentes

<a id="sintoma-cannot-find-module"></a>

### `Cannot find module`

Causa habitual:

1. No corriste `npm install` en esa carpeta.
2. El nombre del import no es el del paquete (`import express from "Express"` falla: en Linux el nombre es sensible a mayúsculas).
3. Importas un archivo tuyo sin `./`. `import { x } from "utilidades"` busca un paquete, no `./utilidades.js`.
4. Estás en otro directorio: el `package.json` no es el de arriba.

Arreglo: `npm ls nombre-del-paquete`. Si dice `empty` o `invalid`, instálalo. Si el import es tuyo, añade `./` y la extensión `.js` cuando uses `"type": "module"`. Node no adivina la extensión en ESM.

<a id="sintoma-eresolve"></a>

### `ERESOLVE`, el install no termina

Causa habitual: dos paquetes piden versiones incompatibles del mismo dependiente. npm 7+ se niega a instalar un árbol que no cuadra, en vez de callar.

Arreglo: lee el bloque `While resolving` del error. Identifica qué paquete pediste tú (el de arriba) y cuál choca. Opciones, en orden: subir o bajar ese paquete a una versión que declare rangos compatibles; quitar el que no necesitas. `--legacy-peer-deps` es un último recurso temporal, no la solución que se commitea sin saber qué conflicto ignoraste. Después de resolver, `npm ls` no debe mostrar `invalid`.

<a id="sintoma-lock"></a>

### Conflicto en `package-lock.json`

Causa habitual: dos ramas instalaron paquetes distintos y Git no puede unir el JSON del lock.

Arreglo: no edites el lock a mano. Quédate con una de las dos versiones del archivo (`git checkout --ours package-lock.json` o `--theirs`), abre `package.json` y deja a mano las dependencias que de verdad quieres de las dos ramas, y corre `npm install` para regenerar el lock. Luego `npm test`. Detalle de conflictos de Git en [05-git-y-github.md](05-git-y-github.md#sintoma-conflicto).

<a id="sintoma-script"></a>

### `Missing script`

Causa habitual: `npm start` y en `package.json` el script se llama `dev`, o estás en una subcarpeta sin `package.json`.

Arreglo: `npm run` sin nombre lista los scripts que existen. Desde la raíz del proyecto (donde está el `package.json`), `npm run dev`. `npm start` y `npm test` son atajos de scripts con ese nombre exacto; el resto exige `npm run`.

## Cómo comprobar

1. Borra `node_modules` y corre `npm ci`. El proyecto vuelve a instalarse sin tocar el lock.
2. `npm run` muestra `dev` y `test`.
3. Una máquina nueva, o tu misma tras clonar, no necesita copiar `node_modules`. Con el lock basta.
4. El paquete del checkpoint se usa en una ruta real del programa (validar un correo, formatear una fecha), no solo está instalado.

## Si esto no alcanza

Documentación de npm: `npm ci`, `npm install save-dev`, `package.json scripts`, `package-lock.json`.

El error de `ERESOLVE` se busca con la primera línea literal, más el nombre de los dos paquetes que chocan.

## Checkpoint — paquetes externos (30 a 45 minutos)

En el proyecto de la lista de notas, o en el script de [07-nodejs.md](07-nodejs.md) si ya llegaste allí:

- `npm init`, un `package.json` con `"private": true` y al menos un script.
- Un paquete externo usado para una decisión real (por ejemplo `validator` para el correo, o `date-fns` para mostrar una fecha legible).
- `node_modules` ignorado y el lock incluido en Git cuando des el paso de [05-git-y-github.md](05-git-y-github.md).

Hecho cuando `npm ci` en una carpeta recién clonada (o tras borrar `node_modules`) deja el comando `npm run dev` funcionando.
