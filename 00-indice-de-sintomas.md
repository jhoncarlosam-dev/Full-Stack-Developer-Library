# Índice de síntomas

Busca una palabra del mensaje de error o de lo que ves. Cada fila apunta a la ficha con el arreglo. Si el síntoma encaja con dos filas, empieza por la más específica (el código HTTP o el nombre del error gana a "no funciona").

El método para cuando nada de esta lista encaja está en [00-metodo-sin-ia.md](00-metodo-sin-ia.md).

## Navegador y pantalla

| Qué ves | Dónde |
| --- | --- |
| La página sale en blanco y la consola está vacía | [01-html.md](01-html.md#sintoma-pagina-en-blanco) |
| La página sale en blanco y la consola tiene un error rojo | [03-javascript.md](03-javascript.md#sintoma-pagina-en-blanco-js) |
| Pantalla en blanco solo con React | [06-react.md](06-react.md#sintoma-pantalla-en-blanco) |
| `Cannot read properties of null` o `undefined` | [03-javascript.md](03-javascript.md#sintoma-null) |
| `is not a function` | [03-javascript.md](03-javascript.md#sintoma-not-a-function) |
| El botón no hace nada | [03-javascript.md](03-javascript.md#sintoma-boton-muerto) |
| El formulario recarga la página y pierde lo escrito | [01-html.md](01-html.md#sintoma-formulario-recarga) |
| La imagen sale rota | [01-html.md](01-html.md#sintoma-imagen-rota) |
| El enlace no lleva a ningún lado o baja un archivo | [01-html.md](01-html.md#sintoma-enlace-roto) |
| Los elementos se enciman o se salen de la pantalla | [02-css-y-tailwind.md](02-css-y-tailwind.md#sintoma-encimados) |
| En el teléfono se ve roto y en el escritorio no | [02-css-y-tailwind.md](02-css-y-tailwind.md#sintoma-movil) |
| Las clases de Tailwind no se aplican | [02-css-y-tailwind.md](02-css-y-tailwind.md#sintoma-tailwind-no-aplica) |
| El estado de React no cambia en pantalla | [06-react.md](06-react.md#sintoma-estado-no-cambia) |
| `Maximum update depth exceeded` o el efecto se dispara sin parar | [06-react.md](06-react.md#sintoma-bucle-efecto) |
| Aviso de `key` en una lista | [06-react.md](06-react.md#sintoma-key) |
| Un input de React no deja escribir, o cambia solo | [06-react.md](06-react.md#sintoma-input-controlado) |

## Peticiones HTTP

| Qué ves | Dónde |
| --- | --- |
| `fetch` no entra al `.then` ni muestra error | [03-javascript.md](03-javascript.md#sintoma-fetch-callado) |
| CORS, `No 'Access-Control-Allow-Origin'` | [09-api-rest.md](09-api-rest.md#sintoma-cors) |
| 404 en una ruta que "sí existe" | [09-api-rest.md](09-api-rest.md#sintoma-404) |
| 400 con cuerpo que tú crees válido | [09-api-rest.md](09-api-rest.md#sintoma-400) |
| 500 y la pantalla no dice la causa | [09-api-rest.md](09-api-rest.md#sintoma-500) |
| El cuerpo de la petición llega vacío | [09-api-rest.md](09-api-rest.md#sintoma-body-vacio) |
| 401 al recargar, justo después de haber entrado | [10-jwt.md](10-jwt.md#sintoma-401-recarga) |
| 401 `jwt expired` a los pocos minutos | [10-jwt.md](10-jwt.md#sintoma-token-expirado) |
| 403 con un token que sí es válido | [10-jwt.md](10-jwt.md#sintoma-403) |
| El login dice siempre "credenciales incorrectas" | [10-jwt.md](10-jwt.md#sintoma-login-falla) |
| La cookie no se guarda | [12-app-completa.md](12-app-completa.md#sintoma-cookie) |
| En local va y en el servidor no | [12-app-completa.md](12-app-completa.md#sintoma-solo-local) |

## Node, npm y archivos

| Qué ves | Dónde |
| --- | --- |
| `EADDRINUSE`, puerto ocupado | [07-nodejs.md](07-nodejs.md#sintoma-puerto) |
| `Cannot find module` | [04-npm.md](04-npm.md#sintoma-cannot-find-module) |
| `ERESOLVE`, el `npm install` no termina | [04-npm.md](04-npm.md#sintoma-eresolve) |
| Conflicto en `package-lock.json` | [04-npm.md](04-npm.md#sintoma-lock) |
| `Missing script` | [04-npm.md](04-npm.md#sintoma-script) |
| `require is not defined` o el import ESM falla | [07-nodejs.md](07-nodejs.md#sintoma-esm) |
| `process.env.ALGO` es `undefined` | [07-nodejs.md](07-nodejs.md#sintoma-env) |
| El proceso muere y no queda log | [07-nodejs.md](07-nodejs.md#sintoma-muere-sin-log) |
| El build del servidor no coincide con el de tu máquina | [15-despliegue.md](15-despliegue.md#sintoma-build-distinto) |

## PostgreSQL

| Qué ves | Dónde |
| --- | --- |
| `ECONNREFUSED` 5432 o `connection refused` | [08-postgresql.md](08-postgresql.md#sintoma-connection-refused) |
| `password authentication failed` | [08-postgresql.md](08-postgresql.md#sintoma-password) |
| `relation "..." does not exist` | [08-postgresql.md](08-postgresql.md#sintoma-relation) |
| La migración falla a medias | [08-postgresql.md](08-postgresql.md#sintoma-migracion) |
| `duplicate key value violates unique constraint` | [08-postgresql.md](08-postgresql.md#sintoma-duplicado) |
| La consulta tarda segundos con pocos datos aparentes | [08-postgresql.md](08-postgresql.md#sintoma-lenta) |

## Redis

| Qué ves | Dónde |
| --- | --- |
| Redis `connection refused` | [11-redis.md](11-redis.md#sintoma-redis-caido) |
| La API devuelve datos viejos | [11-redis.md](11-redis.md#sintoma-cache-vieja) |
| La sesión desaparece sola | [11-redis.md](11-redis.md#sintoma-sesion) |

## Git y GitHub

| Qué ves | Dónde |
| --- | --- |
| Perdiste cambios que no habías commiteado | [05-git-y-github.md](05-git-y-github.md#sintoma-perdidos) |
| Conflicto de merge | [05-git-y-github.md](05-git-y-github.md#sintoma-conflicto) |
| Hiciste el commit en la rama equivocada | [05-git-y-github.md](05-git-y-github.md#sintoma-rama-equivocada) |
| `push rejected`, `non-fast-forward` | [05-git-y-github.md](05-git-y-github.md#sintoma-push) |
| Subiste un secreto en un commit | [05-git-y-github.md](05-git-y-github.md#sintoma-secreto) |

## Linux y despliegue

| Qué ves | Dónde |
| --- | --- |
| `Permission denied` | [13-linux.md](13-linux.md#sintoma-permission) |
| `command not found` | [13-linux.md](13-linux.md#sintoma-command) |
| `No space left on device` | [13-linux.md](13-linux.md#sintoma-disco) |
| El servicio no arranca con systemd | [13-linux.md](13-linux.md#sintoma-servicio) |
| 502 Bad Gateway | [15-despliegue.md](15-despliegue.md#sintoma-502) |
| El candado de HTTPS no carga o el certificado falló | [15-despliegue.md](15-despliegue.md#sintoma-https) |
| En el servidor faltan variables y en local no | [15-despliegue.md](15-despliegue.md#sintoma-env-servidor) |

## AWS

| Qué ves | Dónde |
| --- | --- |
| La instancia no responde por SSH ni por HTTP | [14-aws-basico.md](14-aws-basico.md#sintoma-instancia) |
| S3 `AccessDenied` | [14-aws-basico.md](14-aws-basico.md#sintoma-s3) |
| El dominio no abre la app | [14-aws-basico.md](14-aws-basico.md#sintoma-dns) |
| El correo cae en spam o SES lo rechaza | [14-aws-basico.md](14-aws-basico.md#sintoma-correo) |

## Monitoreo, CI e infraestructura

| Qué ves | Dónde |
| --- | --- |
| El proceso murió y nadie se enteró | [16-monitoreo.md](16-monitoreo.md#sintoma-proceso-muerto) |
| El disco se llenó de logs | [16-monitoreo.md](16-monitoreo.md#sintoma-logs) |
| El workflow de GitHub Actions está rojo | [17-github-actions.md](17-github-actions.md#sintoma-ci-rojo) |
| `secrets.ALGO` llega vacío | [17-github-actions.md](17-github-actions.md#sintoma-secret) |
| El workflow no se dispara | [17-github-actions.md](17-github-actions.md#sintoma-no-dispara) |
| Ansible `UNREACHABLE` | [18-ansible-y-terraform.md](18-ansible-y-terraform.md#sintoma-ansible) |
| Terraform `Error acquiring the state lock` | [18-ansible-y-terraform.md](18-ansible-y-terraform.md#sintoma-lock-tf) |
| Un `apply` quiere destruir un recurso que necesitas | [18-ansible-y-terraform.md](18-ansible-y-terraform.md#sintoma-destroy) |

## Seguridad, cuando el síntoma es una duda

| Qué vas a hacer | Dónde |
| --- | --- |
| Guardar una contraseña | [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-guardar-password) |
| Decidir dónde va el token | [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-token) |
| Abrir un puerto o un bucket | [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-expuesto) |
| Meter una clave en el repositorio o en el workflow | [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-clave-repo) |
