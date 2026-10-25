# PostgreSQL

PostgreSQL guarda las filas y las sigue teniendo cuando el proceso de Node se apaga. Esta ficha cubre el checkpoint de CRUD: crear, leer, actualizar y borrar. La forma HTTP de ese CRUD está en [09-api-rest.md](09-api-rest.md). Aquí se comprueba con `psql` y con un script, para no mezclar un fallo de SQL con un fallo de rutas.

También se puede usar MySQL o SQLite para lo mismo. El mapa pide PostgreSQL; los ejemplos son de PostgreSQL.

## Cuándo usarlo y cuándo no

Úsalo cuando el dato tenga que estar mañana, o cuando lo vea otra persona. Para un borrador de una sola pestaña basta `localStorage`, y ya sabes su límite desde [03-javascript.md](03-javascript.md).

No guardes archivos grandes (fotos, PDF) dentro de una fila. La fila guarda la ruta; el archivo va a disco o a S3, en [14-aws-basico.md](14-aws-basico.md).

## Básico

Instalación local, la que vas a usar para practicar:

- Windows: instalador de postgresql.org. Durante el asistente anota la contraseña del usuario `postgres` y el puerto `5432`. Al terminar existe "SQL Shell (psql)".
- Linux (servidor o WSL): `sudo apt update && sudo apt install postgresql` y luego el bloque de usuario de abajo.

Crea un usuario y una base solo para esta app. No uses el usuario `postgres` desde Node.

En Linux, como el usuario del sistema `postgres`:

```bash
sudo -u postgres psql
```

En Windows, abre psql con el usuario `postgres` y la contraseña del instalador. El SQL es el mismo:

```sql
CREATE USER notas WITH PASSWORD 'notas';
CREATE DATABASE notas OWNER notas;
\q
```

Conéctate a esa base:

```bash
psql "postgres://notas:notas@localhost:5432/notas"
```

Si la contraseña tiene caracteres como `@` o `#`, hay que codificarlos en la URL (`@` pasa a `%40`). Por eso, en local, una contraseña simple de práctica evita un rato de confusión. En producción la contraseña es larga y va en un archivo de entorno, no en el comando que queda en el historial: usa la variable `PGPASSWORD` solo en la sesión, o un archivo `.pgpass`.

Tabla mínima:

```sql
CREATE TABLE notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

CRUD desde psql, para ver que la base cumple antes de escribir Node:

```sql
INSERT INTO notes (text) VALUES ('Revisar el formulario') RETURNING id, text;
SELECT id, text, created_at FROM notes ORDER BY id;
UPDATE notes SET text = 'Revisar el formulario HTML' WHERE id = 1 RETURNING id, text;
DELETE FROM notes WHERE id = 1 RETURNING id;
```

`RETURNING` te devuelve la fila afectada. Sin `WHERE`, un `UPDATE` o un `DELETE` tocan toda la tabla. Antes de ejecutarlos, escribe el `SELECT` con el mismo `WHERE` y mira cuántas filas salen.

Desde Node, paquete `pg`:

```bash
npm install pg
```

`src/db.js`:

```js
import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
```

`src/notas-cli.js`, aún sin HTTP:

```js
import { pool } from "./db.js";

const comando = process.argv[2];
const texto = process.argv.slice(3).join(" ");

if (comando === "add") {
  const { rows } = await pool.query(
    "INSERT INTO notes (text) VALUES ($1) RETURNING id, text",
    [texto],
  );
  console.log(rows[0]);
} else if (comando === "list") {
  const { rows } = await pool.query(
    "SELECT id, text, created_at FROM notes ORDER BY id",
  );
  console.log(rows);
} else {
  console.error("Uso: add TEXTO | list");
  process.exitCode = 1;
}

await pool.end();
```

```bash
node --env-file=.env src/notas-cli.js add "Primera nota"
node --env-file=.env src/notas-cli.js list
```

`$1` es un parámetro. El texto va en el array, nunca concatenado dentro de la cadena SQL. Quien pega `'hola'); DROP TABLE notes;--` en un concatenado borra la tabla. Con `$1` es solo texto.

## Intermedio

El dato ya no es una nota suelta: tiene dueño, y el esquema cambia con archivos, no a mano en producción.

`db/001_init.sql`:

```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users (id),
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_user_created_idx ON notes (user_id, created_at DESC);
```

Si ya creaste `notes` en el básico, no ejecutes este archivo encima: los nombres chocan. En local puedes `DROP TABLE notes;` y empezar. En una base con datos que importan, escribes `002_....sql` que altera, no un init nuevo.

`db/002_note_status.sql`:

```sql
ALTER TABLE notes ADD COLUMN status text NOT NULL DEFAULT 'abierta'
  CHECK (status IN ('abierta', 'cerrada'));
```

Una tabla de control evita aplicar dos veces la misma migración:

```sql
CREATE TABLE schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
```

`src/migrate.js` aplica, en orden alfabético, los `.sql` que aún no están en esa tabla. Cada archivo va en una transacción: o entra entero, o no entra.

```js
import { readdir, readFile } from "node:fs/promises";
import { pool } from "./db.js";

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const archivos = (await readdir("db")).filter((n) => n.endsWith(".sql")).sort();
for (const filename of archivos) {
  const ya = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE filename = $1",
    [filename],
  );
  if (ya.rowCount) continue;

  const sql = await readFile(new URL(`../db/${filename}`, import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [filename],
    );
    await client.query("COMMIT");
    console.log("aplicada", filename);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("falló", filename);
    console.error(error.message);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}
await pool.end();
```

La ruta del `readFile` asume que el comando se lanza en la raíz del proyecto (`node --env-file=.env src/migrate.js`). `readdir("db")` es relativo a esa raíz.

Consulta de la app, siempre con el dueño:

```sql
SELECT id, text, status, created_at
FROM notes
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

Sin `user_id = $1`, un usuario lee las notas de los demás en cuanto adivina un id. El id predecible (`1`, `2`, `3`) no es un secreto. El filtro por dueño sí es la autorización, junto con [10-jwt.md](10-jwt.md).

Transacción cuando dos escrituras tienen que ir juntas (crear usuario y su primera nota, o descontar y apuntar el movimiento):

```js
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [email, hash]);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

`pool.query` suelta la conexión después de cada llamada. Dos `pool.query` seguidos pueden caer en conexiones distintas y el `BEGIN` no cubre al segundo. Por eso la transacción usa un `client` reservado.

## Avanzado

Lo que se rompe con datos de verdad.

Índice para la consulta que ya tienes, no para todas las columnas. El de `(user_id, created_at DESC)` sirve al listado del intermedio. Un índice de más ralentiza cada `INSERT`. Comprueba con:

```sql
EXPLAIN ANALYZE
SELECT id, text FROM notes WHERE user_id = 1 ORDER BY created_at DESC LIMIT 20;
```

Quieres ver `Index Scan` o `Bitmap` sobre ese índice cuando hay muchas filas. Con 10 filas, Postgres puede preferir un `Seq Scan` y estar en lo cierto: leer la tabla entera es más barato. No añadas índices para ganar un `EXPLAIN` de un ejemplo diminuto.

`NULL` no es "vacío". `WHERE email = NULL` no devuelve nada. Se escribe `WHERE email IS NULL`. Una columna `NOT NULL` te ahorra esa rama.

Borrado: `DELETE` físico en una nota que el usuario tira a la papelera. Un `status = 'borrada'` si necesitas deshacer. Elige uno y no filtres "a veces". Las consultas del listado tienen que excluir las borradas siempre:

```sql
WHERE user_id = $1 AND status <> 'borrada'
```

Copia de seguridad, en la máquina donde está la base, con un archivo que no se versiona:

```bash
pg_dump "postgres://notas@localhost:5432/notas" --format=custom --file=notas.dump
pg_restore --dbname=notas_prueba notas.dump
```

`pg_dump` sin probar el `pg_restore` no es una copia: es un archivo que crees que funciona. Restaura en otra base (`notas_prueba`) una vez antes de necesitarlo. En el servidor, ese comando va a un cron y el archivo sale del mismo disco de la base (S3, en la ficha de AWS). Un disco lleno se lleva la base y la copia a la vez.

Conexiones: el `Pool` de `pg` abre varias. El valor por defecto basta para una app pequeña. Si Postgres dice `too many connections`, no subas el límite del servidor como primer arreglo: mira cuántos procesos Node hay (un `--watch` más un test más el servidor) y si cada uno crea su pool. Un solo proceso, un solo pool.

## Errores frecuentes

<a id="sintoma-connection-refused"></a>

### `ECONNREFUSED` en el puerto 5432, o `connection refused`

Causa habitual: PostgreSQL no está arrancado, o `DATABASE_URL` apunta a otro host.

Arreglo: en Windows, el servicio se llama parecido a `postgresql-x64-16`. Ábrelo desde "Servicios" o con `Get-Service *postgres*`. En Linux, `sudo systemctl status postgresql`. Luego `psql` con la misma URL que usa Node. Si `psql` entra y Node no, la URL del `.env` no es la que crees: el síntoma de entorno está en [07-nodejs.md](07-nodejs.md#sintoma-env).

<a id="sintoma-password"></a>

### `password authentication failed`

Causa habitual: la contraseña del `.env` no es la del `CREATE USER`, o estás entrando como otro usuario. `postgres` y `notas` no comparten contraseña.

Arreglo: entra como administrador (`sudo -u postgres psql` o el psql de Windows) y fija la contraseña otra vez:

```sql
ALTER USER notas PASSWORD 'notas';
```

Actualiza `.env` y reinicia Node. Un cambio de `.env` no entra en un proceso que ya estaba corriendo.

<a id="sintoma-relation"></a>

### `relation "notes" does not exist`

Causa habitual: la tabla está en otra base, o no aplicaste la migración contra la base a la que Node se conecta. También, en PostgreSQL el nombre sin comillas se guarda en minúsculas: `"Notes"` y `notes` no son la misma.

Arreglo:

```sql
\conninfo
\dt
```

`\conninfo` dice a qué base entraste. `\dt` lista las tablas. Si `notes` no está, corre `src/migrate.js` con el mismo `DATABASE_URL`. Si estás en la base `postgres` por defecto, la URL no incluye `/notas`.

<a id="sintoma-migracion"></a>

### La migración falla a medias

Causa habitual: el archivo SQL tiene dos sentencias y la segunda falla (un tipo que no existe, una tabla ya creada). Sin transacción, la primera queda aplicada y la tabla de control no registra el archivo, así que el siguiente intento repite la primera y falla con `already exists`.

Arreglo: el `migrate.js` de arriba hace `ROLLBACK` si algo falla, así que no deja la primera sentencia puesta. Si ya te pasó con un script a mano, mira `\dt` y `SELECT * FROM schema_migrations`. Borra a mano, en local, lo que se quedó a medias o escribe un `003` que sea idempotente (`ADD COLUMN IF NOT EXISTS` solo cuando de verdad es seguro repetirlo). No marques la migración como aplicada si el `\dt` no coincide con lo que el archivo prometía.

<a id="sintoma-duplicado"></a>

### `duplicate key value violates unique constraint`

Causa habitual: dos altas con el mismo `email`, o un `INSERT` que fija el `id` que ya existe. Es una respuesta de negocio, no un 500.

Arreglo en SQL de comprobación: `SELECT id FROM users WHERE email = $1`. En la API se traduce a 409, en [09-api-rest.md](09-api-rest.md). No quites el `UNIQUE` para que el error desaparezca: el índice es lo que impide dos usuarios con el mismo correo cuando los dos clics llegan a la vez. El `SELECT` previo no basta, porque los dos pueden pasar el `SELECT` antes de que ninguno inserte.

<a id="sintoma-lenta"></a>

### La consulta tarda segundos

Causa habitual: un `WHERE` sobre una columna sin índice en una tabla grande, o un `SELECT *` que trae texto enorme que no ibas a mostrar. Menos veces, en este nivel: falta un índice y además estás filtrando en Node una tabla entera que ya pudiste filtrar en SQL.

Arreglo: `EXPLAIN ANALYZE` con los mismos parámetros. Si ves `Seq Scan` y la tabla tiene muchas filas, el `WHERE` no está cubierto por un índice. Crea el índice que coincide con el filtro (`user_id`, y el orden si hay `ORDER BY`). No indexes una columna "por si acaso" que ninguna consulta filtra. Confirma que el listado pide `LIMIT`.

## Cómo comprobar

1. `psql` con la URL de la app lista las tablas (`\dt`) y una fila de prueba.
2. El script `add` y el script `list` ven esa fila.
3. Un texto de 2001 caracteres lo rechaza el `CHECK`, no la pantalla.
4. Aplicar migraciones dos veces seguidas no da error: la segunda dice que no hay nada nuevo.
5. `EXPLAIN` del listado por usuario no recorre una tabla distinta de la que crees (mira el nombre en el plan).

## Si esto no alcanza

Documentación de PostgreSQL: `postgresql insert returning`, `postgresql where`, `postgresql explain`, `postgresql create index`, `postgresql pg_dump`.

El mensaje de error, entre comillas, más `postgresql`, encuentra la página del código (`42P01` es la relación que no existe, `23505` es la clave duplicada).

## Checkpoint — CRUD simple (60 a 90 minutos)

Una base `notas` tuya y un script Node, sin HTTP todavía:

- Tabla `notes` con id, texto y fecha.
- Añadir, listar, cambiar el texto de un id y borrar ese id, con `$1`, `$2`.
- Un `CHECK` o un `NOT NULL` que rechace el vacío.
- La migración en un archivo `.sql` que puedes volver a aplicar en una base vacía.

Hecho cuando paras Node, vuelves a entrar con `psql` y las filas siguen ahí. El mismo CRUD por HTTP es el checkpoint de [09-api-rest.md](09-api-rest.md), no este.
