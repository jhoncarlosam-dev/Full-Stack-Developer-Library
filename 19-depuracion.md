# Depuración

Depurar es acortar el sitio donde vive el fallo hasta que solo quede una causa. El orden está en [00-metodo-sin-ia.md](00-metodo-sin-ia.md). Esta ficha es la caja de herramientas: qué mirar en cada capa y qué comando lo demuestra. El arreglo de cada error concreto sigue estando en su categoría; el índice es [00-indice-de-sintomas.md](00-indice-de-sintomas.md).

## Cuándo usarlo y cuándo no

Ábrela cuando el síntoma no esté en el índice, o cuando la ficha del índice no coincida con lo que tú ves. Si coincide, no improvises otra teoría: aplica esa ficha.

No acumules `console.log` en todas las funciones "por si acaso" y los dejes. Cada log de diagnóstico se quita al terminar, o se convierte en el log corto de método, ruta, código y milisegundos de [07-nodejs.md](07-nodejs.md).

## Básico

El navegador. F12, y tres pestañas:

1. Consola. El primer error rojo. Clic en el archivo y la línea de tu código, no en la de `node_modules` o de React, salvo que el mensaje solo exista allí.
2. Red. Recarga con la pestaña abierta (si no, la petición de carga ya pasó). Filtra por Fetch/XHR. Entra en la petición de la API y lee, en este orden: URL completa, método, código, cabecera de petición `Content-Type` y `Authorization`, cuerpo de la petición, cuerpo de la respuesta.
3. Elementos. El botón que "no hace nada" está en el DOM o no está. Un elemento con tamaño 0 o tapado por otro explica un clic perdido sin que haya error en la consola.

Reproduce una sola vez y anota esos cuatro datos de la petición (URL, método, código, primera línea del cuerpo). Con eso se entra al índice.

El servidor, en local. La terminal donde corre `npm run dev` es el otro lado de la misma petición. Si el navegador dice 500, la causa está impresa ahí. Si no hay ninguna línea nueva al pulsar el botón, la petición no llegó: URL, puerto o CORS. CORS se ve en la consola del navegador y la petición en Red aparece como error de red, a veces sin código. `curl` no sufre CORS: por eso es el paso siguiente, no un adelanto opcional.

```bash
curl.exe -i http://localhost:3000/api/salud
```

En bash es `curl`. En PowerShell, `curl` a secas puede ser otro comando; `curl.exe` es el de verdad.

Lee el código de arriba abajo en el manejador de esa ruta, no el proyecto entero. La pregunta es: ¿qué línea pudo producir este código HTTP?

## Intermedio

Separar frontend y API con la misma petición que hace el navegador. Copia, desde la pestaña Red, "Copy as cURL" si el navegador lo ofrece, y ejecútala. Si no, reconstrúyela:

```bash
curl.exe -i http://localhost:3000/api/notas -H "Authorization: Bearer TOKEN"
```

- Falla igual que en la pantalla: el frontend queda fuera. Sigue en Node, Postgres o Redis.
- Funciona en curl y falla en la pantalla: compara origen, cookie (`credentials`), y la URL (proxy de Vite frente a `localhost:3000` directo). Es el terreno de [12-app-completa.md](12-app-completa.md#sintoma-cookie).

Base de datos, con la misma SQL que crees que corre. En el manejador, la consulta es un texto con `$1`. Sustituye el parámetro a mano en psql, entre comillas, y mira si el error es el mismo:

```bash
psql "postgres://notas:notas@localhost:5432/notas" -c "SELECT id FROM notes WHERE user_id = 1"
```

Si psql dice que la tabla no existe y Node también, es migraciones. Si psql devuelve filas y Node dice que no hay notas, Node está conectado a otra base. Imprime en el arranque el nombre de la base, no la contraseña:

```js
const base = new URL(process.env.DATABASE_URL);
console.log("base", base.pathname);
```

Redis: `redis-cli GET notas:1` en el momento del fallo, no diez minutos después. La clave o está o no está. Las dos situaciones están en [11-redis.md](11-redis.md).

Git, para saber qué cambió desde que funcionaba:

```bash
git status
git diff
git log --oneline -5
```

Si ayer iba y hoy no, el diff es la lista de sospechosos. No revises el proyecto completo: revisa esas líneas. `git stash` deja tu cambio aparcado y confirma si, sin él, el fallo desaparece. Si desaparece, el bug está en lo que apartaste. Vuelve con `git stash pop` y reduce el diff hasta una sola modificación. Es el "cambiar una sola cosa" del método, aplicado al historial.

En el servidor, los mismos comandos por SSH, contra `127.0.0.1`, más el log:

```bash
journalctl -u notas -n 100 --no-pager
curl -i http://127.0.0.1:3000/api/salud
```

No depures el servidor desde el navegador de tu casa si aún no has hecho ese curl dentro de la máquina. El camino está partido en Nginx, DNS y certificado, y mezclarlos alarga el fallo. El orden está en [15-despliegue.md](15-despliegue.md#sintoma-502).

## Avanzado

Cuando el fallo es intermitente o solo aparece con datos reales.

Una petición concreta, no "a veces falla". En el log corto (método, ruta, código, milisegundos) busca los 500 y los tiempos altos. Si no tienes ese log, añádelo antes de seguir teorizando: sin él estás depurando de memoria. La forma está en [07-nodejs.md](07-nodejs.md).

Bisect, si sabes un commit bueno y uno malo y el fallo se reproduce:

```bash
git bisect start
git bisect bad
git bisect good abc1234
```

Git te deja en un commit intermedio. Pruebas. `git bisect good` o `git bisect bad`. Repites hasta que dice cuál fue el primer commit malo. Entonces `git bisect reset` y miras ese diff, no toda la historia. No lo uses si no puedes probar en cada parada: sin prueba, el bisect adivina.

Consulta lenta: `EXPLAIN ANALYZE` con los parámetros reales, en [08-postgresql.md](08-postgresql.md#sintoma-lenta). No optimices una ruta cuyo log dice 20 ms. El tiempo tiene que salir de un reloj, no de la sensación.

Condición de carrera. Dos altas duplicadas no se reproducen con un clic. Dos terminales a la vez, o el botón sin `disabled`, sí. Si solo pasa "cuando voy rápido", escribe el gesto exacto (doble clic, dos pestañas) en la nota de fallo antes de cambiar el código. El arreglo de la doble alta está en la API, con la transacción o con la clave de idempotencia, no en un `setTimeout`.

El fallo solo en producción. Lista de diferencias, y se tacha una por prueba:

| Diferencia | Cómo la igualas |
| --- | --- |
| Commit distinto | `git rev-parse --short HEAD` en los dos sitios |
| Variable ausente | Nombres, no valores, como en [15-despliegue.md](15-despliegue.md#sintoma-env-servidor) |
| Migración sin aplicar | `SELECT filename FROM schema_migrations` en las dos bases |
| Build viejo del frontend | El nombre del archivo en `public/assets` |
| Datos distintos | Una fila mínima parecida a la de producción, en local, sin copiar datos personales si puedes evitarlo |

Copiar la base de producción a tu portátil arrastra correos y hashes. Si lo haces para un bug que no reproduces de otra forma, bórrala al terminar, no la dejes en un dump dentro del repo, y no la subas a un bucket público.

Cuando lleves más de una hora sin una capa descartada, para y escribe la plantilla de [00-metodo-sin-ia.md](00-metodo-sin-ia.md). Casi siempre el atasco es haber cambiado tres cosas y no saber cuál probar.

## Errores frecuentes de la propia depuración

Estas no son fallos de la app. Son formas de perder el rastro.

### El log que miras no es el del proceso que recibe la petición

Causa habitual: dos Node, el de systemd y uno manual. El log de tu terminal está quieto y el de `journalctl` se mueve, o al revés.

Arreglo: `ss -ltnp | grep 3000` y compara el PID con `systemctl show -p MainPID --value notas`. Lee el log de ese PID, no el de la terminal que quedó abierta desde ayer.

### El navegador enseña una respuesta vieja

Causa habitual: un 304, un service worker de un experimento anterior, o una pestaña que no recargó el JS.

Arreglo: ventana privada, o recarga forzada. En Red, marca "desactivar caché" mientras las herramientas están abiertas. Si un service worker aparece en la pestaña Application, desregístralo: esta app no registra uno en las fichas, así que sería un residuo.

### El `console.log` no sale y crees que esa línea no se ejecuta

Causa habitual: estás mirando la consola del navegador para un log que corre en Node, o al revés. O el proceso de Node es el viejo, sin tu log, porque `--watch` no reinició (un error de sintaxis lo deja en el arranque anterior).

Arreglo: escribe el log con un prefijo feo y único (`ZZZ`) y busca `ZZZ` en la terminal correcta. Si no está, ese proceso no tiene el archivo que estás editando. `pwd` y la ruta del `npm run dev` lo confirman.

## Cómo comprobar

La depuración terminó cuando se cumplen las tres:

1. Puedes repetir el fallo con un gesto de una frase.
2. Un cambio de una sola cosa lo hace desaparecer.
3. El caso vecino sigue funcionando (la otra ruta, el otro usuario, el curl sin navegador).

Si falta la 2, no des por cerrado el arreglo aunque la pantalla "ya se vea bien".

## Si esto no alcanza

MDN: `mdn network panel`, `mdn console`. Node: `nodejs debugging`. Git: `git bisect`. PostgreSQL: `postgresql explain analyze`.

Busca el mensaje literal del primer error, entre comillas, más el nombre de la capa que ya no descartaste.

## Checkpoint — un fallo, una nota (30 minutos)

Provoca a propósito uno de estos, y escríbelo con la plantilla del método, sin saltarte capas:

- Puerto ocupado.
- Tabla inexistente.
- Token ausente.

Hecho cuando la nota nombra la capa, el comando que lo demostró (`curl`, `psql` o la consola) y el archivo de esta biblioteca que tiene el arreglo. No hace falta que el fallo sea un misterio: hace falta que el recorrido quede escrito, para el día en que sí lo sea.
