# JWT y sesión

JWT (JSON Web Token) es una cadena firmada que el servidor puede verificar sin guardarla. Sirve para saber quién llama. No sirve para esconder datos: la parte del medio se lee en claro. No pongas ahí la contraseña, el hash ni datos que el usuario no debería ver en su propio navegador.

La contraseña se comprueba una vez, en el login, contra un hash guardado en PostgreSQL. Después el cliente presenta el token. El mapa llama a esta caja "JWT Auth". La ficha de al lado, Redis, no hace falta para el básico ni para el intermedio.

## Cuándo usarlo y cuándo no

Úsalo cuando haya usuarios y filas que son suyas. Hasta entonces, la API abierta del CRUD es suficiente para practicar SQL.

No uses un JWT como permiso permanente de años, ni lo guardes en `localStorage` si puedes evitarlo: cualquier script metido en la página lo lee. El patrón intermedio deja el recuerdo de la sesión en una cookie `httpOnly`, que el JavaScript de la página no puede leer.

## Básico

Un token de una hora en la cabecera `Authorization`. Al recargar la página se pierde, porque solo vive en una variable. Ese es el síntoma de abajo, y es el comportamiento esperado de este nivel, no un fallo de firma.

```bash
npm install jsonwebtoken bcryptjs
```

Genera un secreto largo y mételo en `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Con `"type": "module"`, ese `require` de una sola vez en la terminal igual funciona porque es un proceso aparte. Si no, usa:

```bash
node --eval "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64url'))"
```

`.env`

```text
JWT_SECRET=pega-aqui-el-valor
```

Alta de usuario y login, añadidos al servidor de [09-api-rest.md](09-api-rest.md):

```js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const DUMMY_HASH = bcrypt.hashSync("no-es-una-cuenta", 12);

app.post("/api/usuarios", asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email.includes("@") || password.length < 10) {
    res.status(400).json({ error: "Correo o contraseña no válidos" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Ese correo ya está registrado" });
      return;
    }
    throw error;
  }
}));

app.post("/api/sesion", asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const { rows } = await pool.query(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];
  const coincide = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !coincide) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
}));
```

`DUMMY_HASH` es un hash bcrypt de verdad, generado al arrancar, de una contraseña que no corresponde a ninguna cuenta. Cuando el correo no existe, `compare` trabaja el mismo tipo de cálculo que cuando existe. Así un atacante no distingue "no hay usuario" de "mala contraseña" midiendo el reloj. La respuesta es la misma frase en los dos casos. Si la contraseña escrita coincidiera con la de relleno y el usuario no existe, la condición `!user` igual responde 401.

Proteger una ruta:

```js
function exigirUsuario(req, res, next) {
  const cabecera = req.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Falta sesión" });
    return;
  }
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(datos.sub);
    next();
  } catch {
    res.status(401).json({ error: "Sesión no válida" });
  }
}

app.get("/api/notas", exigirUsuario, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, text, created_at FROM notes WHERE user_id = $1 ORDER BY id LIMIT 20",
    [req.userId],
  );
  res.json(rows);
}));
```

El alta de notas del CRUD tiene que guardar también `user_id`. Si la tabla todavía no tiene esa columna, es la migración `002` de [08-postgresql.md](08-postgresql.md), adaptada: añadir `user_id` solo cuando ya sepas rellenar las filas viejas, o recrear la base de práctica.

Comprueba:

```bash
curl -i -X POST http://localhost:3000/api/sesion -H "Content-Type: application/json" -d "{\"email\":\"ada@example.com\",\"password\":\"una-frase-larga\"}"
curl -i http://localhost:3000/api/notas -H "Authorization: Bearer PEGA_EL_TOKEN"
```

Sin la cabecera, 401. Con el token, solo las notas de ese usuario.

## Intermedio

El básico obliga al frontend a guardar el token. Si lo dejas en una variable, recargar da 401. Si lo dejas en `localStorage`, recargar funciona y cualquier XSS se lleva la sesión. El término medio de esta biblioteca: el access token dura poco y el recuerdo es una cookie que el JavaScript no lee.

- Access token: JWT de 15 minutos, en memoria, cabecera `Authorization`. Se pierde al recargar, a propósito.
- Refresh: valor opaco (no hace falta que sea un JWT), en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, `Path=/api/sesion`, caducidad de 14 días.
- El servidor guarda solo el hash de ese valor (en la tabla `sessions`). Si te copian la base, no pueden presentar la cookie.

```js
import { createHash, randomBytes } from "node:crypto";

function hashToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

app.post("/api/sesion", asyncRoute(async (req, res) => {
  // ...la misma comprobación de correo y contraseña...
  const access = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refresh = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '14 days')`,
    [user.id, hashToken(refresh)],
  );
  res.cookie("refresh", refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/sesion",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
  res.json({ token: access });
}));

app.post("/api/sesion/renovar", asyncRoute(async (req, res) => {
  const refresh = req.cookies?.refresh ?? "";
  const { rows } = await pool.query(
    `SELECT user_id FROM sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(refresh)],
  );
  if (!rows[0]) {
    res.status(401).json({ error: "Sesión no válida" });
    return;
  }
  const access = jwt.sign({ sub: String(rows[0].user_id) }, process.env.JWT_SECRET, { expiresIn: "15m" });
  res.json({ token: access });
}));

app.delete("/api/sesion", asyncRoute(async (req, res) => {
  const refresh = req.cookies?.refresh ?? "";
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(refresh)]);
  res.clearCookie("refresh", { path: "/api/sesion" });
  res.status(204).end();
}));
```

Hace falta `cookie-parser` (`npm install cookie-parser` y `app.use(cookieParser())` antes de las rutas). La tabla:

```sql
CREATE TABLE sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
```

El frontend, al cargar la app, llama a `POST /api/sesion/renovar` con `credentials: "include"`. Si responde 200, guarda el access token en memoria y sigue. Si responde 401, muestra el login. Eso es lo que quita el 401 al recargar sin meter el token en `localStorage`.

```js
const respuesta = await fetch("/api/sesion/renovar", {
  method: "POST",
  credentials: "include",
});
```

`credentials: "include"` es lo que manda la cookie. Sin eso, el navegador la guarda y no la envía, y parece que "la cookie no existe". El caso está cruzado con [12-app-completa.md](12-app-completa.md#sintoma-cookie).

Cerrar sesión borra la fila y la cookie. Cerrar solo la pestaña no cierra sesión: el refresh sigue válido hasta el `DELETE` o hasta los 14 días. En una app pequeña eso es aceptable si el botón "Salir" sí llama al `DELETE`.

## Avanzado

Lo que se rompe cuando roban una cookie o cuando cambias el secreto un martes.

Rotación. En cada `renovar`, borra el refresh usado y emite otro. Si el mismo refresh llega dos veces, asume que se copió: borra todas las sesiones de ese usuario y responde 401. El cliente legítimo tendrá que entrar otra vez; el copiado también. Es mejor que dejar las dos sesiones vivas.

```js
const usado = await pool.query(
  "DELETE FROM sessions WHERE token_hash = $1 AND expires_at > now() RETURNING user_id",
  [hashToken(refresh)],
);
if (!usado.rows[0]) {
  res.status(401).json({ error: "Sesión no válida" });
  return;
}
```

El `INSERT` del refresh nuevo va en la misma transacción que ese `DELETE`.

Revocar al cambiar la contraseña: `DELETE FROM sessions WHERE user_id = $1`. Si no, el refresh robado sigue renovando access tokens aunque el usuario haya puesto una clave nueva.

`JWT_SECRET` distinto en cada entorno (tu máquina, el servidor). Rotarlo invalida todos los access tokens, que duran 15 minutos: es soportable. No reutilices un secreto de ejemplo. Si el secreto se filtró, el arreglo es rotarlo y borrar `sessions`, no "esperar a que caduquen" los refresh de 14 días.

`secure: true` solo cuando la página es HTTPS. En local, con HTTP, una cookie `Secure` no se guarda y el síntoma parece un login roto. Por eso va atada a `NODE_ENV === "production"`. En el servidor, HTTPS es obligatorio antes de poner producción. Ver [15-despliegue.md](15-despliegue.md).

CSRF. Una cookie se envía sola en una navegación. Con `SameSite=Lax`, un formulario de otro sitio no la manda en un `POST` cruzado. No bajes a `SameSite=None` para "arreglar" el frontend en otro dominio: si la API y la página están en orígenes distintos y necesitas la cookie, estás en el caso avanzado de CORS con `credentials` y una lista de orígenes concreta, más un token CSRF de doble envío. Mientras puedas, sirve la página y la API en el mismo dominio (Nginx) y quédate en `Lax`.

No metas permisos finos solo dentro del JWT (`{ admin: true }`) sin poder invalidarlos. Un JWT de 15 minutos con un rol viejo es un cuarto de hora de más. Para una app de notas, el permiso es "esta fila tiene tu `user_id`". No hace falta un sistema de roles. Cuando lo necesites, la fuente del rol es la base, leída al renovar, no un booleano eterno dentro del token.

## Errores frecuentes

<a id="sintoma-401-recarga"></a>

### 401 al recargar, justo después de haber entrado

Causa habitual: el access token está en una variable de React y la recarga la vacía. El básico hace eso a propósito.

Arreglo: pasa al patrón intermedio (`POST /api/sesion/renovar` al arrancar la app) o, si todavía estás en el básico y solo quieres terminar el día, guarda el token en `sessionStorage` sabiendo que un XSS se lo lleva. No lo dejes en `localStorage` "porque es más fácil" y lo olvides ahí. `sessionStorage` al menos muere al cerrar la pestaña.

Si ya usas la cookie y sigues viendo 401 al recargar, el renovar no se está llamando, o la cookie no se envía: sigue en el síntoma de la cookie de [12-app-completa.md](12-app-completa.md#sintoma-cookie).

<a id="sintoma-token-expirado"></a>

### 401 con `jwt expired`

Causa habitual: el access token llegó a su `expiresIn`. Con 15 minutos pasa en medio del trabajo. El mensaje exacto lo produce `jsonwebtoken` cuando verificas; si tu `catch` lo convierte todo en "Sesión no válida", lo verás en el log solo si lo imprimes.

Arreglo: en el cliente, un 401 en una ruta normal dispara un solo `POST /api/sesion/renovar` y, si sale bien, repite la petición original con el access nuevo. Si el renovar también da 401, al login. No alargues el access a 30 días para no implementar el renovar: ese token robado sirve un mes.

Comprueba el reloj del servidor. Un VPS con la hora mal marca tokens como caducados al nacer. `date -u` en el servidor tiene que parecerse a la hora real.

<a id="sintoma-403"></a>

### 403 con un token que sí es válido

Causa habitual: el token identifica a Ada y la nota es de otra persona. Eso no es un 401. El 401 dice "no sé quién eres". El 403 dice "sé quién eres y esta fila no es tuya". También aparece si exiges un rol que el usuario no tiene.

Arreglo: la consulta lleva `WHERE id = $1 AND user_id = $2`. Si no devuelve fila, responde 404, no 403, cuando no quieras revelar que el id existe. Reserva el 403 para una acción que el usuario entiende que no puede hacer (borrar la cuenta de otro, por ejemplo). No cambies el 403 por un 200 vacío.

<a id="sintoma-login-falla"></a>

### El login dice siempre "credenciales incorrectas"

Causa habitual, con la contraseña bien escrita:

1. El correo se guardó con mayúsculas y lo buscas en minúsculas, o al revés. El alta de esta ficha guarda `toLowerCase()`. Un alta anterior, no.
2. `bcrypt.compare` contra un hash que no es bcrypt (pegaste la contraseña en claro en `password_hash` al probar en psql).
3. `JWT_SECRET` vacío. Eso falla al firmar, y si el error cae en un `catch` demasiado amplio, lo conviertes en 401.
4. El body no llega: [09-api-rest.md](09-api-rest.md#sintoma-body-vacio).

Arreglo: en psql, `SELECT email, left(password_hash, 4) FROM users WHERE email = 'ada@example.com';`. El hash de bcrypt empieza por `$2`. Si la fila no está, el correo no es el que crees. Si el hash no empieza por `$2`, vuelve a registrar. Mira el log antes de asumir que la contraseña no coincide: un 500 tragado no es una credencial mala.

## Cómo comprobar

1. Alta, login, `GET /api/notas` con el token, y el mismo GET sin token (401).
2. Un segundo usuario no ve las notas del primero.
3. Con el patrón intermedio: recargar la página vuelve a entrar sin pedir la contraseña, y "Salir" hace que el renovar responda 401.
4. Un token recortado o con un carácter cambiado responde 401.
5. El `.env` no está en Git y el secreto no aparece en el JSON de ninguna respuesta.

## Si esto no alcanza

`jsonwebtoken verify`, `bcrypt compare`, MDN `set-cookie HttpOnly`, MDN `fetch credentials`.

El mensaje `jwt expired` y `invalid signature` se buscan literales.

## Checkpoint — login (60 a 90 minutos)

Sobre la API de notas:

- Registro con contraseña de al menos 10 caracteres, guardada como hash. En psql no se lee la contraseña.
- Login que devuelve un token, y `GET /api/notas` filtrado por el usuario del token.
- Dos usuarios de prueba, cada uno con una nota, sin poder leerse entre sí.
- Recargar no deja la app en un 401 mudo: o renuevas con la cookie, o la pantalla pide entrar otra vez y lo explica.

Hecho cuando puedes mostrarlo con curl (alta, login, listado) y, en la pantalla, el segundo usuario no ve la nota del primero.
