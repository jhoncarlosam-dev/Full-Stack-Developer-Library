# API REST

Una API REST es un acuerdo sobre HTTP: cada URL es un recurso, el método dice qué quieres hacerle y el código de estado dice qué pasó. El navegador de [06-react.md](06-react.md) y un `curl` tienen que poder usar el mismo acuerdo. Si solo funciona desde la pantalla, no es una API: es un efecto secundario de React.

El servidor de esta ficha es Express sobre Node. Viene de [07-nodejs.md](07-nodejs.md) y habla con [08-postgresql.md](08-postgresql.md).

```bash
npm install express
```

## Cuándo usarlo y cuándo no

Úsalo cuando otro programa (el frontend, un script, mañana un móvil) necesite los datos. No hace falta una API para la página estática ni para el script de terminal.

GraphQL cubre el mismo hueco con otro contrato. El mapa pide REST. No mantengas los dos "por aprender".

## Básico

Recursos en plural, métodos con un significado fijo:

| Quiero | Método y ruta | Código si sale bien |
| --- | --- | --- |
| Listar | `GET /api/notas` | 200 |
| Crear | `POST /api/notas` | 201 |
| Ver una | `GET /api/notas/15` | 200 |
| Cambiar | `PATCH /api/notas/15` | 200 |
| Borrar | `DELETE /api/notas/15` | 204 |

204 no lleva cuerpo. 201 lleva la nota creada, para que el cliente no tenga que adivinar el id.

`src/server.js`:

```js
import express from "express";
import { pool } from "./db.js";

const app = express();
app.use(express.json({ limit: "32kb" }));

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get("/api/salud", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/notas", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, text, created_at FROM notes ORDER BY id LIMIT 20",
  );
  res.json(rows);
}));

app.post("/api/notas", asyncRoute(async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 2000) {
    res.status(400).json({ error: "text debe tener entre 1 y 2000 caracteres" });
    return;
  }
  const { rows } = await pool.query(
    "INSERT INTO notes (text) VALUES ($1) RETURNING id, text, created_at",
    [text],
  );
  res.status(201).json(rows[0]);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Error interno" });
});

const puerto = Number(process.env.PORT) || 3000;
app.listen(puerto, () => console.log(`http://localhost:${puerto}`));
```

`express.json()` es el que rellena `req.body`. Sin él, el cuerpo llega y `req.body` queda `undefined`. El límite de 32 KB corta un POST enorme antes de que lo cargues en memoria.

Comprueba con curl, no con la pantalla:

```bash
curl http://localhost:3000/api/salud
curl -i -X POST http://localhost:3000/api/notas -H "Content-Type: application/json" -d "{\"text\":\"Primera\"}"
curl http://localhost:3000/api/notas
```

En PowerShell, `curl` a veces es `Invoke-WebRequest`. Usa `curl.exe` para que los ejemplos valgan tal cual.

El `-i` muestra el código. Tienes que ver `HTTP/1.1 201` en el alta. Un 200 en un alta "también funciona" y le miente al cliente que distingue crear de listar.

## Intermedio

Errores que el cliente puede tratar, y una ruta que no existe separada de una nota que no existe.

```js
app.get("/api/notas/:id", asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "id no válido" });
    return;
  }
  const { rows } = await pool.query(
    "SELECT id, text, created_at FROM notes WHERE id = $1",
    [id],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Nota no encontrada" });
    return;
  }
  res.json(rows[0]);
}));

app.patch("/api/notas/:id", asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!Number.isInteger(id) || id < 1 || !text || text.length > 2000) {
    res.status(400).json({ error: "Datos no válidos" });
    return;
  }
  const { rows } = await pool.query(
    "UPDATE notes SET text = $1 WHERE id = $2 RETURNING id, text, created_at",
    [text, id],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Nota no encontrada" });
    return;
  }
  res.json(rows[0]);
}));

app.delete("/api/notas/:id", asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM notes WHERE id = $1", [id]);
  if (!rowCount) {
    res.status(404).json({ error: "Nota no encontrada" });
    return;
  }
  res.status(204).end();
}));
```

Códigos que sí vas a usar, y no otros inventados:

| Código | Cuándo |
| --- | --- |
| 400 | El cliente mandó algo que no pasa la validación |
| 401 | No está identificado |
| 403 | Está identificado y no le está permitido |
| 404 | Esa URL o esa fila no existe |
| 409 | Choca con un dato único, como el correo repetido |
| 500 | Falló el servidor; el cliente no puede corregirlo reenviando lo mismo sin más |

El 401 y el 403 se aplican cuando exista [10-jwt.md](10-jwt.md). Devolver 500 para un correo duplicado obliga al frontend a mostrar "error interno" cuando el arreglo es "elige otro correo".

Paginación simple, para no devolver la tabla entera el día que crezca:

```js
const limit = 20;
const cursor = Number(req.query.cursor) || 0;
const { rows } = await pool.query(
  `SELECT id, text, created_at FROM notes
   WHERE id > $1 ORDER BY id LIMIT $2`,
  [cursor, limit],
);
const siguiente = rows.length === limit ? rows.at(-1).id : null;
res.json({ notas: rows, siguiente });
```

El cliente pide la próxima página con `?cursor=` igual a `siguiente`. Offset (`?page=50`) se vuelve lento en tablas grandes; el cursor por id creciente no. Cuando el orden sea por fecha y haya empates, el cursor pasa a ser la fecha más el id, no solo uno de los dos.

CORS, cuando el frontend de Vite (`localhost:5173`) llama al API (`localhost:3000`) y todavía no hay proxy. En producción, si Nginx sirve los dos bajo el mismo dominio, no hace falta CORS. Ver [15-despliegue.md](15-despliegue.md).

```bash
npm install cors
```

```js
import cors from "cors";

app.use(cors({ origin: "http://localhost:5173" }));
```

`origin: "*"` junto con cookies de sesión no funciona como la gente espera, y además deja la API usable desde cualquier página. En el básico sin cookies puedes abrir el origen solo a tu frontend. No dejes `*` puesto "porque en local iba bien".

El manejador de error del básico ya evita filtrar el mensaje de PostgreSQL al cliente. Ese mensaje a veces incluye nombres de tabla y fragmentos de la consulta. En el log sí va el error completo; en el JSON, la frase fija.

## Avanzado

Lo que se rompe con clientes reales, reintentos y listas que crecen.

Idempotencia de un alta. Un cliente que no recibió la respuesta (se cayó la red) reintenta el POST y crea dos notas. Un `Idempotency-Key` guardado un rato corta el duplicado:

```js
app.post("/api/notas", asyncRoute(async (req, res) => {
  const clave = req.get("Idempotency-Key");
  if (!clave || clave.length > 80) {
    res.status(400).json({ error: "Falta Idempotency-Key" });
    return;
  }
  const previa = await pool.query(
    "SELECT note_id FROM idempotency_keys WHERE key = $1",
    [clave],
  );
  if (previa.rows[0]) {
    const nota = await pool.query(
      "SELECT id, text, created_at FROM notes WHERE id = $1",
      [previa.rows[0].note_id],
    );
    res.status(200).json(nota.rows[0]);
    return;
  }
  // INSERT de la nota y de la clave, en la misma transacción del archivo de PostgreSQL.
}));
```

La tabla es `(key text primary key, note_id bigint not null, created_at timestamptz default now())`. Sin la transacción única, puedes guardar la nota y no la clave. Es el mismo patrón de `BEGIN` de [08-postgresql.md](08-postgresql.md). Para el checkpoint no es obligatorio. Sí lo es no devolver 500 cuando el segundo POST choca: o devuelves la nota ya creada, o un 409 claro.

Validación en el servidor aunque React ya la haya hecho. El HTML y el `disabled` del botón se saltan con curl. La fuente de la verdad es esta ficha, no el formulario.

Rutas fijas antes que rutas con parámetro si alguna vez se parecen (`/api/notas/resumen` tiene que declararse antes de `/api/notas/:id`, o `resumen` se interpreta como id).

Límite de tamaño y de ritmo. `express.json({ limit: "32kb" })` cubre el cuerpo. Un límite de cuántas peticiones por minuto aceptas por IP evita que un bucle de un bug te tumbe Postgres. En una app pequeña puedes contarlo en memoria; cuando haya más de un proceso Node, el contador vive en Redis, en [11-redis.md](11-redis.md). No hace falta un paquete para entender el mecanismo: una clave `rl:ip`, `INCR`, y `EXPIRE` la primera vez.

Versión de la API en la ruta (`/api/...` ya es tu versión 1). El día que un cambio rompa a los clientes viejos, publicas `/api/v2` y dejas la anterior hasta que no queden llamadas en el log. No cambies el significado de un campo en silencio.

## Errores frecuentes

<a id="sintoma-cors"></a>

### CORS, `No 'Access-Control-Allow-Origin'`

Causa habitual: la página está en un origen (esquema + host + puerto) y la API en otro. `http://localhost:5173` y `http://localhost:3000` son orígenes distintos. El navegador hace la petición, ve que la respuesta no autoriza al origen de la página y esconde el cuerpo. `curl` no aplica CORS: si curl ve la respuesta y el navegador no, es este síntoma, no un 500.

Arreglo: o el proxy de Vite de [06-react.md](06-react.md), que hace que el navegador llame a su mismo origen, o `cors({ origin: "http://localhost:5173" })` en la API. Tiene que aparecer también en la respuesta al preflight `OPTIONS`. Si solo lo pones en `GET`, el `POST` con `Content-Type: application/json` sigue fallando porque el navegador pregunta antes con `OPTIONS`. El paquete `cors` contesta ese `OPTIONS`. No uses `origin: "*"` si la petición lleva cookies o cabecera `Authorization` que quieras limitar.

<a id="sintoma-404"></a>

### 404 en una ruta que sí existe

Causa habitual:

1. El método no coincide: el cliente hace `GET` y la ruta es `POST`.
2. Falta o sobra una barra, o el prefijo `/api`.
3. Una ruta `/:id` se declaró antes y se comió el nombre fijo.
4. Hay dos procesos y estás pegándole al viejo, que no tiene la ruta. El del puerto nuevo sí.

Arreglo: copia del código la ruta y el método y pégalos en `curl -i -X POST http://localhost:3000/api/notas`. Si curl da 404, el proceso que escucha no es el código que estás leyendo (reinicia, mira el log de arranque, confirma el puerto). Si curl da 201 y el navegador da 404, compara la URL de la pestaña Red carácter por carácter.

<a id="sintoma-400"></a>

### 400 con un cuerpo que tú crees válido

Causa habitual: el JSON manda `titulo` y el servidor lee `text`. O el string trae espacios y al recortar queda vacío. O `express.json()` no corrió y estás validando `undefined`.

Arreglo: en el manejador, durante el diagnóstico, `console.log(req.body)` y mira la terminal de Node, no la del navegador. Ajusta el nombre del campo a uno solo (en esta biblioteca, `text` y `email`). Responde el 400 con el motivo concreto (`"text debe tener entre 1 y 2000 caracteres"`), no con `"datos inválidos"` para todos los casos, o no podrás distinguirlos desde la pantalla.

<a id="sintoma-500"></a>

### 500 y la pantalla no dice la causa

Causa habitual: una excepción en la ruta. El JSON solo dice "Error interno" a propósito. La causa está en la terminal donde corre Node, en la línea que imprimió `console.error(error)`.

Arreglo: lee esa línea. Las más comunes aquí son `relation "notes" does not exist` ([08-postgresql.md](08-postgresql.md#sintoma-relation)) y `ECONNREFUSED` a Postgres o a Redis. No envíes `error.message` al cliente para "verlo en la pantalla": vuelve a filtrar datos de la base. Si estás solo en local, míralo en el log.

<a id="sintoma-body-vacio"></a>

### El cuerpo de la petición llega vacío

Causa habitual: falta la cabecera `Content-Type: application/json`, y Express no parsea el cuerpo. O el cliente mandó un objeto de JavaScript sin `JSON.stringify`. O un `GET` con cuerpo: muchos servidores lo ignoran; los filtros van en la query (`?cursor=`).

Arreglo: en la pestaña Red, la petición debe mostrar el cuerpo como JSON y la cabecera correcta. El `fetch` de [03-javascript.md](03-javascript.md) ya la pone. Con curl, sin `-H "Content-Type: application/json"`, `req.body` sale `{}` y la validación responde 400. Ese 400 es la pista, no un fallo de PostgreSQL.

## Cómo comprobar

1. Los cinco métodos de la tabla, con curl, devuelven el código de la tabla.
2. Un POST sin `text` devuelve 400 y no crea fila. Compruébalo con un `SELECT count(*)`.
3. Un GET de un id que no existe devuelve 404, no 500 ni `null`.
4. Con Postgres parado, el GET devuelve 500 y el log tiene `ECONNREFUSED`, y el JSON no incluye la cadena de conexión.
5. Desde el origen del frontend, el POST no muestra el error de CORS. Desde curl, el mismo POST sigue funcionando.

## Si esto no alcanza

MDN: `mdn http response status`, `mdn fetch`, `mdn cors`.

Express: `express routing`, `express json middleware`, `express error handling`.

## Checkpoint — API del CRUD (60 a 90 minutos)

La misma tabla de notas, ahora por HTTP:

- `GET`, `POST`, `PATCH` y `DELETE` con los códigos de esta ficha.
- Validación de texto vacío y de texto largo en el servidor.
- 404 cuando el id no está.
- Una colección de peticiones (un archivo de notas, o la colección de curl) que puedes repetir.

Hecho cuando apagas React, si ya lo tenías, y con solo curl puedes crear una nota y volver a verla. La pantalla que las consume es el checkpoint de React, no este.
