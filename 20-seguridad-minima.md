# Seguridad mínima

Esta ficha es el suelo, no un mapa de ciberseguridad. Son las decisiones que evitan los incidentes típicos de una app de notas recién publicada: contraseñas en claro, tokens robables, bases abiertas a internet y secretos en Git. El mapa largo de seguridad es otra biblioteca. Aquí se cruza con el índice, en las dudas de "¿esto se puede publicar así?".

Si un ejemplo de otra ficha y esta se contradicen, manda esta.

## Cuándo usarlo y cuándo no

Léela antes de poner la app en una IP pública, antes del primer usuario que no eres tú, y en cuanto vayas a guardar una contraseña o una clave de AWS.

No la uses para aplazar el checkpoint local. En `localhost`, sin datos de nadie, el riesgo es menor, y aun así el hábito se coge aquí: hash, parámetros SQL, `.env` fuera de Git. Cambiarlo el día del despliegue es cuando se olvida.

## Básico

Contraseñas. Nunca se guardan en claro, ni en un log, ni en el JWT, ni en un `console.log` "un segundo". Se guarda el hash de bcrypt con coste 12, como en [10-jwt.md](10-jwt.md). Quien vea la tabla `users` no puede leer la clave ni probarla en otro sitio a velocidad de diccionario sin pagar el coste del hash. `bcryptjs` evita tener que compilar nada en el servidor.

Comprobar con `bcrypt.compare`. No compares dos hashes con `===`: formatos distintos del mismo secreto pueden no ser idénticos como texto, y además enseñas en el código un patrón que luego copias a tokens. Para el refresh opaco, el hash SHA-256 sí se puede comparar como texto porque tú lo generaste siempre igual; está en la ficha de JWT.

SQL. Toda entrada de usuario va en `$1`, `$2`, no concatenada. El ejemplo y el motivo están en [08-postgresql.md](08-postgresql.md). Validar el tipo antes (número entero, texto con largo máximo) reduce basura; no sustituye al parámetro.

Secretos. `.env` en `.gitignore`. En el repo, `.env.example` solo con los nombres:

```text
PORT=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
```

`JWT_SECRET` se genera con `randomBytes`, no con una frase del README. Uno distinto en tu máquina y en el servidor.

HTTPS en cuanto haya dominio. Sin él, la contraseña y la cookie viajan legibles en la red por la que entras. El certificado está en [15-despliegue.md](15-despliegue.md). Hasta ese día, no pidas a otra persona que use la app desde una cafetería.

El navegador no es una frontera. Cualquiera puede mandar un POST con curl saltándose React. La validación y el `user_id` viven en el servidor.

## Intermedio

Sesión. Access token corto en memoria. Refresh en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, `Path` estrecho. El servidor guarda el hash del refresh, no el valor. Cerrar sesión borra la fila. Cambiar la contraseña borra todas las filas de ese usuario. El detalle, en [10-jwt.md](10-jwt.md).

No pongas el access token en `localStorage`. Un script inyectado lo lee; la cookie `httpOnly` no. Ese script entra si pintas notas con `innerHTML` o si cargas un paquete que no revisaste. `textContent` y JSX (`{nota.texto}`, que escapa) cierran el agujero de las notas. No bajes la guardia en un `dangerouslySetInnerHTML` "para el markdown de la nota": o no hay HTML de usuario, o lo filtras con una librería hecha para eso y aun así la cookie `httpOnly` es la red de fondo.

CORS. Origen explícito, o mejor el mismo origen vía Nginx, y no `*` con credenciales. Ver [09-api-rest.md](09-api-rest.md#sintoma-cors).

Cabeceras de Nginx, las dos de [15-despliegue.md](15-despliegue.md): `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`. No añadas una CSP copiada de un blog el mismo día que enciendes el sitio.

Permisos de filas. `WHERE id = $1 AND user_id = $2` en lectura, edición y borrado. El id no es un secreto: se prueba 1, 2, 3. Responder 404 cuando la fila es de otro evita confirmar que existe; está en la ficha de JWT.

Límite de login. Diez intentos por correo cada cuarto de hora, en Redis, código 429. Sin Redis disponible, el login se niega (503), no se deja abierto. Ver [11-redis.md](11-redis.md).

Cookies y registro. `chmod 600` el `.env`. El proceso no corre como root. Los puertos 5432, 6379 y 3000 no están en el grupo de seguridad ni en `ufw`. SSH solo desde tu IP.

Dependencias. `npm audit` de vez en cuando, sin `--force` automático. Actualiza el paquete que el aviso nombra, corre `npm test`, commitea lock y `package.json` juntos. Un paquete que no usas se desinstala: es superficie de menos.

## Avanzado

Lo que se rompe cuando la app lleva semanas encendida y la cuenta de AWS tiene una tarjeta.

Claves de AWS. Rol de la instancia con S3 de un bucket y `ses:SendEmail`, nada de administrador. Sin claves de larga duración dentro de la EC2. La clave raíz de la cuenta no se usa para el día a día; activa el MFA de esa raíz el día que abras la cuenta y no generes access keys para ella. Si una access key tuya llegó a un repo, se desactiva en IAM aunque hayas borrado el commit. El orden está en [05-git-y-github.md](05-git-y-github.md#sintoma-secreto).

Redis y Postgres solo en `127.0.0.1`. Un `listen_addresses = '*'` más un grupo de seguridad amplio es una base pública. Los buscadores de internet encuentran esos puertos solos. No hace falta un atacante dedicado a tu proyecto.

Copias. `pg_dump` periódico a un bucket privado, con lifecycle para no guardarlos eternos, y un `pg_restore` probado. Una copia que nunca restauraste no cuenta. El dump tiene datos personales (correos): el bucket no se hace público "para descargarlo fácil". Lo bajas con el rol o con tu usuario IAM.

Cuenta de práctica y cuenta con usuarios reales, separadas, el día que dejes de estar practicando. Un `terraform destroy` en el directorio equivocado no debería poder llevarse la base de otras personas. `prevent_destroy` en el bucket de copias está en [18-ansible-y-terraform.md](18-ansible-y-terraform.md).

Actualizaciones del sistema (`apt upgrade`) en la EC2 con más regularidad que "cuando me acuerdo", y la app tiene que poder reiniciarse después. El monitoreo de [16-monitoreo.md](16-monitoreo.md) te dice si no levantó.

Datos de más. No pidas nombre, teléfono o dirección para una app de notas. El correo y la contraseña alcanzan. Borrar la cuenta es un `DELETE` de sus notas y de sus sesiones, y luego del usuario, en una transacción. Si todavía no hay botón, no guardes tampoco un historial paralelo "por si acaso".

Registro de incidentes, en una libreta tuya, no en el repo: qué clave rotaste, qué día, qué servicio. La próxima vez no adivinas si la clave vieja sigue viva.

Lo que esta ficha no cubre y no debes inventar: guardar tarjetas, cumplir una normativa concreta, pentesting, o "dejar la contraseña en un comentario hasta el lunes". Si el producto llega a cobrar dinero, es otra biblioteca y, muy probablemente, un proveedor de pagos que no te deja tocar el número de tarjeta.

## Errores frecuentes

<a id="sintoma-guardar-password"></a>

### Vas a guardar una contraseña

Arreglo: columna `password_hash`, `bcrypt.hash(password, 12)` en el registro, `bcrypt.compare` en el login, mínimo 10 caracteres, la misma frase de error si el correo no está y si la clave no coincide. No hay `SELECT password` en ninguna ruta. No hay log del cuerpo de `POST /api/sesion`. Si ya guardaste alguna en claro, trátalas como filtradas: borra esas filas o fuerza un cambio, y no las "conviertas" con un script que las loguee por el camino.

<a id="sintoma-token"></a>

### Vas a decidir dónde va el token

Arreglo: no va en `localStorage` ni en la URL. El access token va en memoria y en la cabecera `Authorization`. El refresh va en cookie `httpOnly` con las banderas de [10-jwt.md](10-jwt.md). Si todavía estás en el básico de una sola cadena JWT, asume que se pierde al recargar y la pantalla lo dice. Alargarla a 30 días para no perderla es el peor sitio: un robo dura 30 días y no hay fila que borrar.

<a id="sintoma-expuesto"></a>

### Vas a abrir un puerto o un bucket

Arreglo: la lista permitida hacia internet es 22 desde tu IP, 80 y 443. Nada más. El bucket de copias y el de archivos de usuario llevan Block Public Access. Un archivo que el usuario deba descargar se entrega con una URL firmada de corta duración o a través de tu API, después de comprobar el `user_id`, no con el objeto público. `aws s3 ls` con el rol tiene que funcionar, y abrir la URL del objeto en una ventana privada sin estar logueado tiene que fallar.

<a id="sintoma-clave-repo"></a>

### Vas a meter una clave en el repositorio o en el workflow

Arreglo: si es un secreto, va a `.env` (servidor o portátil) o a los secretos de GitHub Actions, no al YAML, no a un `run: echo`, no a un issue, no a esta biblioteca. El workflow comprueba que el secreto está presente imprimiendo `presente` o `vacío`, como en [17-github-actions.md](17-github-actions.md#sintoma-secret). Si ya se subió, se rota en el proveedor el mismo día y después se limpia el árbol. Rotar es lo que quita el acceso. El commit nuevo solo deja de repartirlo.

## Cómo comprobar

1. En psql, `password_hash` empieza por `$2` y no se parece a la contraseña que escribiste.
2. `git status` y `git log -p -1` no contienen `.env`, ni `AKIA`, ni un `JWT_SECRET=` con valor.
3. Desde una red que no es la tuya (o con el grupo de seguridad a la vista), los únicos puertos de entrada son 22 restringido, 80 y 443.
4. El segundo usuario no lee la nota del primero ni adivinando el id.
5. La cookie de refresh, en las herramientas del navegador, está marcada HttpOnly y, en producción, Secure.

## Si esto no alcanza

OWASP, en este orden de búsqueda: `owasp password storage bcrypt`, `owasp sql injection`, `owasp session management`. MDN: `mdn httpOnly`, `mdn content security policy` cuando llegue el momento de la CSP, no antes.

El mapa de seguridad completo de roadmap.sh no está resumido aquí.

## Checkpoint — antes de dejarla encendida (30 minutos)

Con la app ya desplegada, recorre la lista de "Cómo comprobar" y anota un sí o un no por cada punto. Cualquier no se arregla antes de pasar la URL a otra persona. Hecho cuando los cinco son sí, incluido el `git log` del último commit.
