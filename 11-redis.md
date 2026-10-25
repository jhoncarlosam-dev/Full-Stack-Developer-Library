# Redis

Redis guarda valores en memoria y los devuelve en poco tiempo, con una caducidad. En esta biblioteca hace tres trabajos concretos: cachear un listado, limitar ráfagas de peticiones y, si quieres, guardar el refresh de la sesión fuera de PostgreSQL. No sustituye a PostgreSQL. Si Redis se vacía, la app tiene que seguir: irá más lenta o pedirá entrar de nuevo, pero no habrá perdido las notas.

## Cuándo usarlo y cuándo no

Úsalo cuando la misma lectura cara se repite, o cuando un contador tiene que vivir unos minutos y no te importa perderlo al reiniciar.

No lo uses como única copia de las notas, de los usuarios o de los pagos. Tampoco hace falta el día del CRUD simple: mételo cuando el listado ya sale de Postgres y quieres dejar de pegarle en cada refresco.

Se puede hacer una caché parecida en la propia base o en memoria del proceso. La memoria del proceso no se comparte si mañana arrancas dos Node. Redis sí.

## Básico

Redis escucha en el puerto 6379. En el servidor Linux:

```bash
sudo apt update
sudo apt install redis-server
redis-cli PING
```

Tiene que responder `PONG`. En Windows nativo no hay un Redis oficial equivalente. Practica dentro de WSL con los mismos comandos, o con una línea de Docker si ya lo usas: `docker run --name redis-local -p 6379:6379 redis:7`. Es una herramienta de práctica, no otra caja del mapa.

`.env`

```text
REDIS_URL=redis://127.0.0.1:6379
```

```bash
npm install redis
```

`src/redis.js`:

```js
import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (error) => console.error("redis", error.message));
await redis.connect();
```

En `server.js` el `await` de arriba solo funciona si el archivo es el de entrada. Si `redis.js` se importa desde varios sitios, conecta una vez desde `server.js` y exporta el cliente ya creado, sin `await` en la cima de un módulo que se importe dos veces. Forma simple y suficiente:

```js
import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (error) => console.error("redis", error.message));

export function conectarRedis() {
  if (!redis.isOpen) return redis.connect();
}
```

Comandos que cubren el checkpoint, en `redis-cli`:

```text
SET nota:1 "Revisar el formulario" EX 60
GET nota:1
TTL nota:1
DEL nota:1
```

`EX 60` borra la clave al minuto. `TTL` dice cuántos segundos quedan. `-2` significa que ya no está.

Desde Node:

```js
await redis.set("nota:1", "Revisar el formulario", { EX: 60 });
const valor = await redis.get("nota:1");
```

Los valores son texto. Un objeto se guarda con `JSON.stringify` y se lee con `JSON.parse`.

## Intermedio

Caché del listado de notas de un usuario. La clave incluye el usuario. Una clave `notas` global mezcla los listados de todo el mundo: es una fuga, no una optimización.

```js
const clave = `notas:${userId}`;
const cacheado = await redis.get(clave);
if (cacheado) {
  res.json(JSON.parse(cacheado));
  return;
}
const { rows } = await pool.query(
  "SELECT id, text, created_at FROM notes WHERE user_id = $1 ORDER BY id LIMIT 20",
  [userId],
);
await redis.set(clave, JSON.stringify(rows), { EX: 30 });
res.json(rows);
```

Al crear, editar o borrar una nota de ese usuario, la caché miente hasta que caduque. Bórrala en la misma petición que escribe:

```js
await pool.query("INSERT INTO notes (user_id, text) VALUES ($1, $2)", [userId, text]);
await redis.del(`notas:${userId}`);
```

Treinta segundos es un número de práctica. Súbelo solo si el listado es caro y puedes tolerar ese retraso. En una app de notas personales, invalidar al escribir importa más que alargar el `EX`.

Límite de intentos de login, para que un bucle no pruebe contraseñas sin freno:

```js
const clave = `login:${email}`;
const intentos = await redis.incr(clave);
if (intentos === 1) await redis.expire(clave, 15 * 60);
if (intentos > 10) {
  res.status(429).json({ error: "Demasiados intentos. Espera un cuarto de hora." });
  return;
}
```

429 es el código de "demasiado". `INCR` y `EXPIRE` tienen una carrera diminuta si el proceso muere entre los dos; para un login es aceptable. Si el primer intento no pone caducidad, la clave vive para siempre y el usuario queda bloqueado. Por eso el `expire` va cuando el contador pasa a ser 1.

Redis caído no tiene que tumbar el listado. Tiene que tumbar el límite de login solo si prefieres negar el login a dejarlo sin límite. Decisión de esta biblioteca: si Redis no responde, el listado se sirve desde Postgres y el login se niega con 503. Un login sin límite, en silencio, es peor que una pausa.

```js
let cacheado = null;
try {
  cacheado = await redis.get(clave);
} catch (error) {
  console.error("redis", error.message);
}
if (!cacheado) {
  // consulta a Postgres, y el set va en su propio try
}
```

## Avanzado

Lo que se rompe cuando hay más de un proceso o cuando la memoria se llena.

Dos Node detrás de Nginx comparten Redis y no comparten la memoria del proceso. El contador de login y la caché tienen que estar en Redis para que el límite sea de verdad. Si el contador vive en una variable, cada proceso tiene el suyo y el atacante tiene un cupo por proceso.

Carrera de la caché. Dos peticiones ven la clave vacía, las dos consultan Postgres, las dos escriben. El resultado es correcto, solo redundante. No hace falta un candado para un listado de notas. Sí hace falta no cachear respuestas de error: un 500 guardado con `EX 30` convierte un fallo corto en un fallo de medio minuto.

`maxmemory`. Si no pones tope, Redis crece hasta que el sistema mata el proceso o el disco de swap se come la máquina (Redis en swap va muy mal). En el servidor, en `redis.conf`:

```text
maxmemory 256mb
maxmemory-policy allkeys-lru
```

`allkeys-lru` tira las claves menos usadas cuando llega al tope, incluidas las de sesión si las guardaste aquí. Por eso las notas no viven solo en Redis. Si guardas el refresh de [10-jwt.md](10-jwt.md) en Redis en vez de en `sessions`, un desalojo cierra sesiones al azar: es el síntoma de abajo. Para una app pequeña deja los refresh en PostgreSQL y usa Redis para caché y contadores, que sí se pueden perder.

No expongas el puerto 6379 a internet. `bind 127.0.0.1` y, si hay contraseña, `requirepass` en el mismo archivo, y `REDIS_URL=redis://:clave@127.0.0.1:6379`. La clave va en `.env`, no en el repositorio. Un Redis sin contraseña y con el puerto abierto en el grupo de seguridad se usa para minar o para colarse en la red; no es un riesgo teórico. Al desplegar, el grupo de seguridad no incluye el 6379. Ver [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-expuesto).

Caché y usuario. La clave `notas:${userId}` ya aísla. No cachees `GET /api/notas/15` en una clave `nota:15` compartida si la respuesta depende de quién pregunta: o la clave incluye el usuario, o no se cachea.

## Errores frecuentes

<a id="sintoma-redis-caido"></a>

### Redis `connection refused`

Causa habitual: el servicio no está arrancado, `REDIS_URL` apunta a otro host, o en Windows estás llamando a `127.0.0.1` y Redis está dentro de WSL con otra IP.

Arreglo: `redis-cli -u "$REDIS_URL" PING` con la misma URL que Node. En Linux, `sudo systemctl status redis-server` (el nombre a veces es `redis`). Arranca con `sudo systemctl start redis-server`. Si `PING` responde y Node no conecta, el proceso de Node no vio `REDIS_URL`: [07-nodejs.md](07-nodejs.md#sintoma-env).

<a id="sintoma-cache-vieja"></a>

### La API devuelve datos viejos

Causa habitual: escribiste en Postgres y no hiciste `DEL` de `notas:${userId}`, o borraste otra clave (`notas` sin el id). También pasa si el `SET` se hace antes del `COMMIT` y la otra petición lee la caché nueva mientras la transacción aún no se ve, o al revés: cacheas y luego el `INSERT` falla.

Arreglo: escribe en Postgres, confirma que no hubo error, y solo entonces `DEL`. No hagas `SET` del listado nuevo a mano si es fácil equivocarse en la forma: borrar la clave obliga al próximo `GET` a leer la base. Comprueba con `redis-cli GET notas:1` justo después del POST. Tiene que decir `(nil)` o el JSON que ya incluye la nota nueva.

<a id="sintoma-sesion"></a>

### La sesión desaparece sola

Causa habitual: el refresh está en Redis con un `EX` corto, o `allkeys-lru` lo desalojó, o guardaste la sesión en la memoria del proceso y nodemon reinició al guardar un archivo. Un reinicio de Node no borra Redis ni Postgres; sí borra las variables.

Arreglo: `redis-cli TTL sesion:EL_ID`. Si devuelve un número pequeño, la caducidad es esa. Si la sesión debe durar 14 días, el `EX` está mal puesto (segundos, no días: 14 días son `1209600`). Si las sesiones no deben perderse al llenarse la memoria, muévelas a la tabla `sessions` de [10-jwt.md](10-jwt.md) y deja Redis para la caché. Mira también la cookie: una cookie de sesión del navegador, sin `maxAge`, muere al cerrar el navegador aunque Redis siga teniendo la clave.

## Cómo comprobar

1. `redis-cli PING` responde `PONG` en el mismo sitio donde corre Node.
2. El primer `GET /api/notas` y el segundo devuelven lo mismo, y en el log se ve una sola consulta SQL (pon un `console.log` delante del `pool.query` mientras lo compruebas, y quítalo).
3. Después de un `POST`, el siguiente `GET` ya incluye la nota, sin esperar 30 segundos.
4. El intento 11 de login en un cuarto de hora devuelve 429.
5. Con Redis parado, el `GET /api/notas` sigue respondiendo desde Postgres.

## Si esto no alcanza

Documentación de Redis: `redis set ex`, `redis incr`, `redis maxmemory-policy`, `redis ttl`.

Del paquete de Node: `node-redis set options EX`.

## Checkpoint — caché (45 minutos)

Con la API de notas ya filtrada por usuario:

- Redis local que responde `PONG`.
- El listado se cachea 30 segundos por usuario.
- Un alta borra la caché de ese usuario y no la de otro. Lo compruebas con dos usuarios.
- Redis parado no impide leer las notas.

Hecho cuando puedes explicar qué dato se perdería si borras todas las claves (`FLUSHDB` solo en tu Redis de práctica) y la respuesta es "ninguna nota, solo velocidad y contadores".
