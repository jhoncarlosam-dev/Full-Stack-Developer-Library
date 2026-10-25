# Despliegue

Desplegar es dejar la app completa respondiendo en una URL, con HTTPS, sin que tú tengas una terminal abierta. Las piezas son las de [12-app-completa.md](12-app-completa.md). La máquina es la de [14-aws-basico.md](14-aws-basico.md) o, para practicar sin factura, una Linux tuya en la red local. Los comandos son los mismos.

Nginx recibe el 80 y el 443 y reparte: lo que empiece por `/api` va a Node en el puerto 3000, el resto son los archivos de `dist/`. PostgreSQL y Redis no salen de la máquina.

## Cuándo usarlo y cuándo no

Hazlo cuando el checkpoint de la app completa ya pasa en local. Desplegar antes solo copia un fallo a un sitio donde cuesta más ver los logs.

No despliegues con `npm run dev`, ni con Vite preview, ni abriendo el puerto 3000 en el grupo de seguridad "un momento". Ese momento se queda.

## Básico

En la máquina, con el código ya en `/opt/notas` (un `git clone` de tu repo, o un `git pull`):

```bash
cd /opt/notas
npm ci --omit=dev
node src/migrate.js
```

`migrate.js` tiene que ver `DATABASE_URL`. Si todavía no existe el unit de systemd, exporta la variable en esa sesión o usa `node --env-file=.env src/migrate.js`. El `.env` está en el servidor, creado a mano, con secretos distintos a los de tu portátil.

El frontend se construye antes de copiarlo, en tu máquina o en el servidor. En el servidor hace falta que las devDependencies estén disponibles en el momento del build, así que una opción simple es construir en local y copiar solo `dist/`:

```bash
npm run build
```

Eso ocurre en la carpeta del frontend. Sube el contenido de `dist/` a `/opt/notas/public/` (`scp -r dist/* ubuntu@IP:/opt/notas/public/`). No subas `node_modules`.

Node tiene que poder servir salud en el 3000, y Nginx los estáticos. Si prefieres que Node no sirva archivos, Nginx apunta `root` a esa carpeta. Esta ficha lo hace así, para que Node solo sea la API.

`/etc/nginx/sites-available/notas`:

```nginx
server {
  listen 80;
  server_name notas.example.com;

  root /opt/notas/public;
  try_files $uri $uri/ /index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

`try_files ... /index.html` manda las rutas de React (`/nueva`) al `index.html`. Sin eso, recargar `/nueva` da 404 de Nginx aunque en el `dev` de Vite funcionara.

```bash
sudo ln -s /etc/nginx/sites-available/notas /etc/nginx/sites-enabled/notas
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` tiene que decir ok antes del reload. Un reload con el archivo roto deja el servidor anterior, o lo tira, según el error: no lo saltes.

El unit de systemd es el de [13-linux.md](13-linux.md). `NODE_ENV=production` va dentro del `.env` que ese unit carga. En producción la cookie lleva `Secure`, así que este HTTP básico es solo el puente hasta el certificado. No des por terminado el despliegue en HTTP si ya hay usuarios.

Comprueba desde la propia máquina:

```bash
curl -i http://127.0.0.1:3000/api/salud
curl -i http://127.0.0.1/api/salud
```

Los dos tienen que responder 200. El primero no pasa por Nginx. El segundo sí. Si el primero va y el segundo no, el fallo es Nginx, no Node.

## Intermedio

HTTPS con Let's Encrypt. El dominio ya apunta a esta máquina ([14-aws-basico.md](14-aws-basico.md)). El puerto 80 es alcanzable desde internet, porque el validador de Let's Encrypt entra por ahí.

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d notas.example.com
```

Certbot reescribe el `server` de Nginx, escucha en el 443 y redirige el 80 al 443. Renueva solo con un timer de systemd. Compruébalo:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

`--dry-run` no sustituye el certificado. Confirma que el mecanismo de renovación está programado. Un certificado caduca a los 90 días y el síntoma es el candado roto, no un fallo de Node.

La app detrás de un proxy tiene que saber que la petición original era HTTPS, si alguna vez armas una URL absoluta. `proxy_set_header X-Forwarded-Proto` ya va en el básico. No redirijas tú dentro de Express a HTTPS si Nginx ya redirige: dos redirecciones se enredan.

Variables solo en el servidor. `/opt/notas/.env` con `chmod 600`, dueño el del servicio. Nombres mínimos:

```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://notas:CONTRASEÑA_LARGA@127.0.0.1:5432/notas
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=otro-secreto-distinto-al-de-tu-portatil
```

PostgreSQL en esa máquina no acepta contraseñas desde la red. En `pg_hba.conf` la línea de `127.0.0.1` puede ser `scram-sha-256`, y no hay línea para `0.0.0.0/0`. `listen_addresses` se queda en `localhost`. Es el equivalente, dentro de la caja, a no abrir el 5432 en el grupo de seguridad.

Actualizar una versión, a mano, el día que todavía no hay CI:

```bash
cd /opt/notas
git pull
npm ci --omit=dev
node --env-file=.env src/migrate.js
sudo systemctl restart notas
curl -i http://127.0.0.1:3000/api/salud
```

El build del frontend, si cambió, se vuelve a generar y a copiar a `public/` antes del restart. Si la migración falla, no reinicies a ciegas: el código nuevo puede no entender la base vieja, o al revés. Lee el error, que será uno de [08-postgresql.md](08-postgresql.md#sintoma-migracion).

## Avanzado

Lo que se rompe a la segunda actualización, o el día que el disco se llena a las tres de la mañana.

Orden seguro, el mismo de la app completa, escrito como lista de despliegue:

1. `pg_dump` a S3, o al menos a otro directorio, antes de migrar si ya hay datos de alguien.
2. Migración compatible con el código que todavía está corriendo.
3. Copiar `public/` nuevo.
4. `systemctl restart notas`.
5. `curl` de salud, un login y un alta de prueba. El alta de prueba se borra después.
6. Si el paso 5 falla, `git checkout` al commit anterior, `npm ci`, restart. Por eso el paso 2 no puede haber tirado una columna que el código anterior necesita. Si la tiró, "volver" ya no es un checkout: es un `pg_restore`. Practica ese caso en la base `notas_prueba`, no el día que te importe.

Dos procesos en el mismo puerto: un Node viejo que lanzaste a mano y el de systemd. `ss -ltnp | grep 3000` muestra el PID. Solo debe haber uno, y su padre conceptual es systemd (`systemctl status` muestra el Main PID). Si matas el equivocado, systemd lo reintenta o, si era el manual, el servicio sigue bien. Mira el PID antes de `kill`.

Cabeceras mínimas en el `server` de Nginx, dentro del bloque que escucha 443:

```nginx
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
```

`always` las manda también en los errores. No copiar una lista enorme de cabeceras que no sabes explicar. La política de contenido (CSP) es el siguiente paso cuando ya no queden `script` inline; un CSP mal puesto deja la página en blanco y parece un fallo de React. Añádela en una ventana en la que puedas probar, no en el mismo minuto del primer HTTPS.

Copia de la configuración. `/etc/nginx/sites-available/notas` y el unit de systemd no están en el repo hasta que tú los copies a una carpeta `deploy/` del proyecto, sin secretos. El `.env` no entra en esa carpeta. Ansible, en [18-ansible-y-terraform.md](18-ansible-y-terraform.md), es quien los escribe en el servidor cuando dejes de hacerlo a mano. Hasta entonces, una copia en el repo es lo que te permite rehacer la máquina.

Cliente real. `curl https://notas.example.com/api/salud` desde tu casa, y el navegador en una ventana privada: registro, alta, recarga. La ventana privada evita que una cookie vieja de `localhost` te engañe.

## Errores frecuentes

<a id="sintoma-502"></a>

### 502 Bad Gateway

Causa habitual: Nginx está vivo y Node no. El proxy no tiene a quién hablar. También: Node escucha en otro puerto, o escucha solo en un sitio que Nginx no usa. `proxy_pass http://127.0.0.1:3000` con Node en el 3001 produce este síntoma. Un Node que escucha en `127.0.0.1` está bien para esta receta; un Node apagado, no.

Arreglo:

```bash
systemctl status notas --no-pager
curl -i http://127.0.0.1:3000/api/salud
ss -ltnp | grep 3000
journalctl -u notas -n 40 --no-pager
```

Si curl al 3000 falla, el problema es el servicio (variable, migración, puerto ocupado), no Nginx. Arranca ese hilo en [13-linux.md](13-linux.md#sintoma-servicio). Si curl al 3000 va bien y el navegador ve 502, `nginx -t` y el `proxy_pass`: tiene que ser `http://127.0.0.1:3000`, con el puerto, sin barra final si la `location` es `/api/` y Express espera `/api/...`. Una barra de más recorta el camino y las rutas dejan de coincidir, a veces como 404 y a veces como 502 si el upstream ni responde. Cuando Node sí responde y la ruta no existe, Express devuelve su 404, no un 502. El 502 es "no hubo respuesta HTTP".

<a id="sintoma-https"></a>

### El candado no carga o el certificado falló

Causa habitual: el DNS no apunta a esta máquina, el 80 no es accesible desde fuera (certbot no pudo validar), el certificado venció porque el timer de renovación no corre, o el navegador entra por `https://` a la IP en vez de al nombre. Un certificado de Let's Encrypt es para el nombre, no para la IP. Entrar por la IP da aviso de seguridad aunque el sitio con nombre esté bien.

Arreglo: `dig notas.example.com +short` y la IP pública coinciden. `sudo certbot certificates` muestra la fecha. Si caducó, `sudo certbot renew` con el 80 abierto. Si nunca se emitió, lee el error de certbot: `connection refused` es Nginx o el grupo de seguridad; `NXDOMAIN` o una IP distinta es Route 53. No firmes un certificado a mano "autofirmado" y lo dejes para los usuarios: el navegador les pedirá una excepción y las cookies `Secure` se comportan distinto según el cliente.

<a id="sintoma-env-servidor"></a>

### En el servidor faltan variables y en local no

Causa habitual: en local usas `--env-file=.env` y en el servidor el unit no tiene `EnvironmentFile=`, o apunta a otra ruta. También un `.env` con `export PORT=3000`, que systemd no interpreta como bash, y el valor queda mal. O copiaste el archivo y el servicio no se reinició.

Arreglo:

```bash
systemctl cat notas
sudo ls -la /opt/notas/.env
sudo -u ubuntu bash -c 'test -n "$PORT" && echo PORT-si || echo PORT-no'
```

Ese `bash -c` no carga el `EnvironmentFile`. Quien lo carga es el servicio. Para ver qué tiene el proceso, mira el arranque: la comprobación `Boolean(process.env.PORT)` de [07-nodejs.md](07-nodejs.md#sintoma-env), escrita en el log. No imprimas `JWT_SECRET` ni `DATABASE_URL` para "ver si están". Compara nombres en `systemctl cat` y en tu `.env.example`.

<a id="sintoma-build-distinto"></a>

### El build del servidor no coincide con el de tu máquina

Causa habitual: en el servidor quedó un `dist/` o un `public/` viejo, o `npm install` allí resolvió otras versiones porque faltaba el `package-lock.json`. También un `git pull` que no trajo el frontend porque viven en otro repo que no actualizaste.

Arreglo: anota el commit (`git rev-parse --short HEAD`) en las dos máquinas. Tienen que coincidir. Despliega el frontend con `npm ci` y `npm run build` usando el lock, no con `npm install`. Borra `public/` antes de copiar el `dist/` nuevo, para no dejar un `assets/index-VIEJO.js` que el HTML ya no referencia, ocupando disco y confundiéndote al buscar. En el navegador, ventana privada: el nombre del JS en el código fuente tiene que ser el del build que acabas de copiar.

## Cómo comprobar

1. `curl https://notas.example.com/api/salud` desde tu casa, no solo dentro del servidor.
2. El navegador muestra el candado para ese nombre. Recargar en una ruta de React no da 404.
3. Registro, alta, recarga con la sesión, y un segundo usuario que no ve la nota.
4. `ss` no muestra 3000, 5432 ni 6379 en una dirección pública (`0.0.0.0` en esos puertos es un problema; `127.0.0.1:3000` está bien).
5. Tras `sudo reboot`, sin que entres por SSH, la URL vuelve a responder cuando la máquina termina de arrancar.

## Si esto no alcanza

`nginx proxy_pass`, `nginx try_files spa`, `certbot nginx`, `systemd EnvironmentFile`.

El texto `502 Bad Gateway` junto con `nginx error log` (`/var/log/nginx/error.log`) da la línea `connect() failed`, que es la confirmación de que el upstream no aceptó la conexión.

## Checkpoint — despliegue (medio día)

La app completa en una URL:

- HTTPS si tienes dominio. Si no lo tienes, HTTP en la IP, sabiendo que es temporal y que la cookie de producción no irá `Secure` hasta que haya HTTPS. Anótalo en tu nota de despliegue para no darlo por cerrado.
- Node solo en localhost, Nginx delante.
- Un `git pull` (o una copia nueva) más restart, con la migración aplicada, y la salud en verde.
- Reboot de prueba y la URL sigue viva.

Hecho cuando apagas tu portátil y la URL sigue abriendo el login.
