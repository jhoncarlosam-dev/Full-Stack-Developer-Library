# App completa

Esta es la única ficha donde las piezas se usan juntas. El mapa la llama "Complete App": pantalla, API, PostgreSQL, login y caché. Cada pieza tiene su arreglo en su archivo. Aquí está el orden de armado y los fallos que solo aparecen cuando ya están conectadas.

No empieces aquí. Si un eslabón no cumple su checkpoint, vuelve a ese archivo.

## Cuándo usarlo y cuándo no

Úsalo como checklist de integración, no como un segundo tutorial de React o de SQL. Si un paso falla, el arreglo está en la ficha enlazada, no en añadir más código alrededor.

## Básico

Un solo usuario de prueba, en tu máquina, con todo en local. Puertos fijos:

| Pieza | Dónde | Cómo sabes que vive |
| --- | --- | --- |
| PostgreSQL | `localhost:5432`, base `notas` | `psql` entra y `\dt` muestra `users`, `notes`, `sessions` |
| Redis | `localhost:6379` | `redis-cli PING` → `PONG` |
| API Node | `localhost:3000` | `curl http://localhost:3000/api/salud` |
| React (Vite) | `localhost:5173` | El navegador muestra el login |

Orden de arranque, cada vez que te sientas a trabajar:

1. Servicio de PostgreSQL y de Redis (en la máquina suelen quedar arrancados).
2. `node --env-file=.env src/migrate.js` si hay un SQL nuevo.
3. `npm run dev` en la carpeta de la API.
4. `npm run dev` en la carpeta del frontend.

`.env` de la API, sin commitear:

```text
PORT=3000
DATABASE_URL=postgres://notas:notas@localhost:5432/notas
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=el-secreto-largo
NODE_ENV=development
```

Contrato mínimo que la pantalla y curl comparten:

- `POST /api/usuarios` crea la cuenta.
- `POST /api/sesion` comprueba la contraseña, pone la cookie `refresh` y devuelve `{ token }`.
- `POST /api/sesion/renovar` con la cookie devuelve un access token nuevo.
- `DELETE /api/sesion` cierra.
- `GET /api/notas`, `POST /api/notas`, `PATCH /api/notas/:id`, `DELETE /api/notas/:id` exigen `Authorization: Bearer` y filtran por `user_id`.
- El `GET` usa la caché `notas:${userId}` de [11-redis.md](11-redis.md).

Frontend, al abrir la app:

```jsx
useEffect(() => {
  const controlador = new AbortController();
  fetch("/api/sesion/renovar", {
    method: "POST",
    credentials: "include",
    signal: controlador.signal,
  })
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error("sin sesion");
      return respuesta.json();
    })
    .then((datos) => setToken(datos.token))
    .catch((error) => {
      if (error.name !== "AbortError") setToken(null);
    });
  return () => controlador.abort();
}, []);
```

`setToken(null)` muestra el formulario de login. Un token string muestra la lista. Las llamadas a `/api/notas` mandan el token:

```js
await fetch("/api/notas", {
  headers: { Authorization: `Bearer ${token}` },
});
```

El proxy de Vite hace que el navegador hable con `5173` y Vite reenvíe `/api` a `3000`. Así la cookie se considera del mismo sitio. Configuración en [06-react.md](06-react.md). Sin ese proxy, estás en el síntoma de la cookie.

Comprueba el básico con dos ventanas: curl crea el usuario y una nota; el navegador, tras entrar, la muestra.

## Intermedio

El recorrido de una persona, de punta a punta, con los estados que no son el caso feliz.

1. Registro. Si el correo existe, la API responde 409 y la pantalla dice que ya está registrado, no "error interno".
2. Login. Un 401 muestra "credenciales incorrectas". Un 429 muestra la espera. Ver [11-redis.md](11-redis.md).
3. Lista. Estados `cargando`, `error` y `vacío`, como en el checkpoint de React. Vacío no es un error: es una lista de cero filas después de un 200.
4. Alta. El botón se desactiva mientras dura el POST. Al volver el 201, se vuelve a pedir el listado (o se inserta la nota devuelta) y la caché ya fue borrada en el servidor.
5. Borrado de una nota que ya no está (la borraste en otra pestaña): la API responde 404 y la pantalla quita la fila igual, o muestra "ya no estaba". No dejes un 404 sin manejar: parece que el botón no funciona.
6. Salir. `DELETE /api/sesion` con `credentials: "include"`, token de memoria a `null`, lista desaparecida de la pantalla. Las filas siguen en Postgres. Lo compruebas en psql.

Variables separadas por carpeta. El frontend solo recibe lo que empiece por `VITE_`. En este montaje, con el proxy, no necesita la URL de la API. No crees `VITE_DATABASE_URL`: quedaría dentro del JavaScript público.

Un solo repositorio o dos, como prefieras. Si son dos, los dos tienen su `.gitignore` y ninguno tiene el `.env`. La colección de curl (o un archivo `api.md` con los comandos que ya te funcionaron) vive en el repo de la API para poder probar sin abrir React.

Cuando un fallo cruce capas, aplica [00-metodo-sin-ia.md](00-metodo-sin-ia.md) antes de cambiar las dos a la vez. La pregunta de corte es: ¿curl, con el mismo token, hace lo correcto?

- Si curl falla, no toques React.
- Si curl va bien y el navegador no, mira la pestaña Red: URL, código, cabecera `Authorization`, cabecera `Cookie`.

## Avanzado

Lo que se rompe al salir de tu portátil. El despliegue paso a paso está en [15-despliegue.md](15-despliegue.md). Aquí, las decisiones que tienen que estar tomadas antes de copiar archivos a un servidor.

Un origen. La página y la API se sirven en `https://notas.example.com` y `https://notas.example.com/api`. La cookie `Secure` se guarda, `SameSite=Lax` basta y no configuras CORS. Partir la API a `api.notas.example.com` te obliga al caso CORS con credenciales. No lo hagas en la primera publicación.

Secretos distintos a los de tu `.env` local. El de local tiene la contraseña `notas` y un JWT de prueba. El servidor tiene otros, en el entorno de systemd, no en un `.env` copiado por SCP "para ir rápido". Si copias el de local, rota las claves en cuanto te des cuenta y trata el de local como filtrado si el servidor es de alguien más.

Migraciones antes de arrancar el proceso nuevo. Orden en un despliegue:

1. Copia de seguridad (`pg_dump`) si ya hay datos que importan.
2. `node src/migrate.js` con el código nuevo y la base vieja todavía sirviendo, solo si esa migración es compatible con el código viejo (añadir una columna con default lo es; borrar una columna que el código viejo usa, no).
3. Arrancar el Node nuevo.
4. `curl` al `/api/salud` y un login de prueba.
5. Si el paso 4 falla, el proceso anterior vuelve. Por eso la migración no puede ser un callejón sin vuelta el mismo día que aprendes a desplegar. Practica el "volver" en local: migra, arranca, para, arranca el código anterior.

Salud de verdad. `/api/salud` que solo responde `{ ok: true }` no mira la base. Uno útil, para ti y para Monit:

```js
app.get("/api/salud", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error("redis");
  res.json({ ok: true });
}));
```

Si la base está caída, esto da 500. Monit o el balanceador pueden usarlo. No lo protejas con JWT: el vigilante no tiene usuario. No imprimas versiones ni la cadena de conexión en el JSON.

Límites que ya quedaron decididos en las otras fichas y aquí solo se confirman: cuerpo de 32 KB, texto de nota hasta 2000, login a 10 intentos por cuarto de hora, pool de Postgres uno solo, Redis solo en `127.0.0.1`.

## Errores frecuentes

<a id="sintoma-cookie"></a>

### La cookie no se guarda

Causa habitual:

1. El frontend llama a `http://localhost:3000` desde `http://localhost:5173` y la cookie queda asociada al 3000, mientras el renovar del navegador va al 5173. El proxy de Vite evita el corte.
2. Falta `credentials: "include"` en el `fetch` del login y en el del renovar.
3. `secure: true` con la página en `http://`. El navegador tira la cookie.
4. `path: "/api/sesion"` y estás mirando la cookie en una petición a `/api/notas`. No va en esa petición, y está bien: el refresh solo debe viajar al renovar y al cerrar. El listado usa el access token, no la cookie.
5. `SameSite` y un origen cruzado. Vuelve al punto 1.

Arreglo: en la pestaña Red, abre la respuesta del `POST /api/sesion`. Tiene que haber `Set-Cookie` con `HttpOnly` y `Path=/api/sesion`. Luego abre `POST /api/sesion/renovar` y confirma que la petición lleva `Cookie`. Si `Set-Cookie` está y la petición siguiente no la manda, el origen o el `credentials` no cuadran. Si `Set-Cookie` ni siquiera está, el servidor no entró en el `res.cookie` (el login falló antes, o `cookie-parser` no cambia este síntoma: quien escribe la cookie es `res.cookie`).

<a id="sintoma-solo-local"></a>

### En local va y en el servidor no

Causa habitual: no es "la nube". Es una de estas diferencias, y curl en el servidor las separa:

1. `.env` distinto o ausente. `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`.
2. Migraciones sin aplicar en esa base. `relation "notes" does not exist`.
3. El frontend publicado es una build vieja (`dist/` generado cuando la API aún no pedía `Authorization`).
4. HTTPS y cookie `Secure`, o al revés: `NODE_ENV` no es `production` y mezclas criterios.
5. El proceso escucha en `127.0.0.1` y Nginx no puede llegar, o escucha en un puerto y Nginx apunta a otro. Eso ya es [15-despliegue.md](15-despliegue.md#sintoma-502).

Arreglo: entra por SSH y ejecuta el mismo curl contra `http://127.0.0.1:3000/api/salud` y contra el login. Si ahí funciona y por el dominio no, el fallo es Nginx, DNS o el certificado. Si ahí ya falla, no mires el dominio: es el mismo fallo que en local, con otro entorno. Compara `systemctl cat notas` con tu `.env` local, nombre por nombre, sin copiar los secretos al chat ni a un archivo del repo.

## Cómo comprobar

Recorrido, en este orden, sin saltar:

1. `psql`: cero notas para un usuario nuevo.
2. Registro desde la pantalla.
3. Login, alta de una nota, recarga de la página: la nota sigue y no pide la contraseña otra vez (renovar).
4. Segundo usuario en una ventana privada: no ve esa nota.
5. Salir en la primera ventana: la recarga pide contraseña.
6. `redis-cli GET` de la clave de ese usuario después del alta: vacía o actualizada, no el listado anterior.
7. `npm run build` del frontend termina. El `dev` de Vite no es la app que vas a copiar al servidor.

## Si esto no alcanza

No busques "app completa node react". Busca el síntoma concreto en [00-indice-de-sintomas.md](00-indice-de-sintomas.md). Si el fallo es de encaje (cookie, origen, entorno), quédate en esta ficha. Si es de una sola capa, salta a su archivo.

## Checkpoint — app completa (medio día, partido en dos sentadas si hace falta)

Una app que otra persona puede usar en tu máquina, con instrucciones de tres líneas para arrancar Postgres, Redis, la API y el frontend:

- Cuenta, login, listado, alta, edición, borrado.
- Los datos siguen tras reiniciar Node.
- Dos cuentas no se ven entre sí.
- La lista no muestra datos de antes de un borrado.
- Hay un `curl` escrito en un archivo del repo que crea una nota sin abrir el navegador.

Hecho cuando esa otra persona (o tú, al día siguiente, en una terminal nueva) lo arranca solo con esas instrucciones y el `.env` de ejemplo sin secretos reales (`.env.example`, con los nombres y sin los valores).

Publicarla es el checkpoint de [15-despliegue.md](15-despliegue.md), no este.
