# Monitoreo

Monitorear es enterarte de que la app murió, o de que el disco se está llenando, sin esperar a que alguien abra el navegador. El mapa separa dos cajas: Monit (el vigilante que reinicia un proceso) y el checkpoint de monitoreo (disco, logs, una señal cuando algo va mal).

Empieza por lo que ya tienes. systemd con `Restart=on-failure` y `journalctl` cubren el caso "el proceso se cayó". Monit entra cuando quieres una regla explícita (el puerto 3000 no responde, el disco pasó del 85 %) y un reinicio aunque el proceso haya quedado colgado sin morirse.

## Cuándo usarlo y cuándo no

Úsalo en el servidor donde la app ya está desplegada. En tu portátil, durante el desarrollo, el `--watch` y la terminal alcanzan.

No montes un stack de métricas (Prometheus, Grafana, un SaaS) antes de tener el reinicio y el disco. Esas herramientas son el mapa de DevOps, no este checkpoint. Un correo de Monit, o una línea en el log que tú miras al día siguiente, es suficiente aquí.

## Básico

Confirma que systemd ya reintenta. En el unit de [13-linux.md](13-linux.md) están `Restart=on-failure` y `RestartSec=3`. Prueba controlada:

```bash
sudo systemctl start notas
MAIN=$(systemctl show -p MainPID --value notas)
sudo kill "$MAIN"
sleep 5
systemctl status notas --no-pager
```

El estado tiene que volver a `active` y el PID nuevo no es el que mataste. Si no vuelve, el programa está saliendo con un código que systemd no considera fallo, o `Restart=` no está en el unit que de verdad corre (`systemctl cat notas`).

Salud HTTP, desde la propia máquina, para no depender de Nginx en esta prueba:

```bash
curl -fsS http://127.0.0.1:3000/api/salud
```

`-f` hace que curl termine con error si el código es 400 o más. `/api/salud` tiene que consultar la base, como en [12-app-completa.md](12-app-completa.md). Un `{ ok: true }` escrito a fuego dice que Node vive y calla si Postgres no.

Disco, cada vez que entres al servidor y, mejor, en un cron:

```bash
df -h /
```

Anota el porcentaje. Por encima de 80 % ya es momento de mirar `/var/log` antes de que el síntoma sea `No space left on device`.

## Intermedio

Monit vigila el puerto y el disco, y reinicia el servicio. En Ubuntu:

```bash
sudo apt install monit
```

En Ubuntu, `/etc/monit/monitrc` ya define cada cuántos segundos corre Monit e incluye `/etc/monit/conf.d/*`. No repitas `set daemon` dentro del archivo de la app: un segundo `set daemon` hace fallar `monit -t`. El intervalo se cambia una sola vez en `monitrc` (60 segundos es un valor razonable).

`/etc/monit/conf.d/notas`:

```text
check host api-notas with address 127.0.0.1
  if failed port 3000 protocol http request "/api/salud" status = 200 for 2 cycles
    then exec "/usr/bin/systemctl restart notas"

check filesystem root with path /
  if space usage > 85% then alert

check system localhost
  if memory usage > 90% then alert
```

La comprobación HTTP exige un 200. Un proceso vivo que responde 500 no cuenta como sano. `for 2 cycles` espera dos rondas fallidas antes de reiniciar, para no matar el proceso por un parpadeo. Reiniciar en cada fallo instantáneo, en bucle, es peor que el fallo: Postgres no se recupera si lo martilleas. Si `monit -t` se queja de la línea `status`, deja la comprobación de puerto y protocolo, y usa la salud desde el cron con `curl -fsS` mientras consultas la sintaxis de tu versión con `man monit`.

```bash
sudo monit -t
sudo systemctl enable --now monit
sudo monit reload
sudo monit status
```

`monit -t` es la sintaxis, igual que `nginx -t`. No recargues sin eso.

Alerta: Monit puede mandar correo si configuras un relay. En este checkpoint no hace falta abrir ese frente el mismo día. `sudo monit status` y el log `/var/log/monit.log` son la alerta local. Cuando SES ya envía correo ([14-aws-basico.md](14-aws-basico.md)), se puede añadir `set alert tu@correo` y un `set mailserver`. Hasta entonces, un cron que escribe el disco en el journal basta como segunda pieza:

```bash
echo '*/30 * * * * df -h / | logger -t disco' | sudo tee /etc/cron.d/disco-notas
```

`logger` manda la línea a journald. La lees con `journalctl -t disco`. El archivo de cron tiene que terminar en salto de línea. Si `tee` no lo dejó, el cron ignora el archivo.

Reinicio colgado. Un Node en un bucle infinito sigue con el proceso vivo: systemd no lo reinicia porque no murió, y el puerto a veces ni acepta conexiones. La regla de Monit sobre `/api/salud` sí lo reinicia. Compruébalo parando Postgres, no inventando un bucle: la salud debe pasar a 500, Monit debe ejecutar el restart, y en `journalctl -u notas` se ve el arranque nuevo. Luego vuelve a arrancar Postgres. Si Monit reinicia cada minuto mientras la base sigue caída, para Monit (`sudo monit unmonitor api-notas`) hasta arreglar la base, o el reinicio en bucle no te deja leer el error con calma.

## Avanzado

Lo que se rompe cuando el vigilante está mal calibrado o nadie mira las alertas.

Reiniciar no arregla un fallo de configuración. Si falta `JWT_SECRET`, Monit reiniciará para siempre y el log se llenará. La regla avanzada es: si el servicio lleva N reinicios en unos minutos, deja de reiniciar y alerta. En el unit de systemd puedes acotar con `StartLimitBurst=5` y `StartLimitIntervalSec=300`. Cuando se alcanza el límite, el servicio queda parado y `status` lo dice. Ese "parado a propósito" es más claro que un proceso que parpadea.

```ini
[Service]
Restart=on-failure
RestartSec=3
StartLimitIntervalSec=300
StartLimitBurst=5
```

Monit, a su vez, no debería lanzar `systemctl restart` si systemd ya se rindió. Mira `status` antes de forzar. Un reinicio manual (`systemctl reset-failed notas` y luego `start`) es la decisión tuya, cuando ya leíste el error.

Disco y logs. El tope de journald está en [13-linux.md](13-linux.md). Monit avisa al 85 %; tú tienes que tener un sitio donde leer ese aviso. Una vez por semana, entra y mira `monit status` y `df -h`. Un monitoreo que no se mira es un archivo en `/etc`.

Qué no vigilar todavía: CPU media, "usuarios conectados", tiempo de cada ruta. Con un solo servidor, el puerto, la salud con base de datos, la memoria y el disco cuentan la historia. El día que una ruta concreta se vuelva lenta, el log de [07-nodejs.md](07-nodejs.md) (método, ruta, código, milisegundos) te dice cuál, sin otro sistema.

El vigilante también se cae. `systemctl enable monit` hace que vuelva tras un reboot. Compruébalo en el mismo reboot del checkpoint de despliegue: después de entrar, `systemctl is-active monit` imprime `active`.

No expongas el puerto de Monit (2812) a internet. Si activas su web, que escuche en `127.0.0.1` y entra por SSH. Un Monit abierto con la contraseña por defecto es una puerta para reiniciar tus servicios desde fuera.

## Errores frecuentes

<a id="sintoma-proceso-muerto"></a>

### El proceso murió y nadie se enteró

Causa habitual: lo habías arrancado en una sesión SSH o con `npm run dev`, sin unit y sin Monit. Cerraste el portátil y se fue. O el unit no tiene `Restart=` y un error lo dejó `inactive` desde anoche.

Arreglo: `systemctl status notas` y `journalctl -u notas --since "yesterday" --no-pager`. Si no existe el unit, créalo. Si existe y está `inactive (dead)` sin reinicios, falta `Restart=on-failure` o systemd alcanzó el `StartLimitBurst` (en el log se lee `start request repeated too quickly`). En ese segundo caso, lee el error de Node, corrígelo, `sudo systemctl reset-failed notas` y `start`. Mata la costumbre de dejar `node` en primer plano dentro de `tmux` como si fuera el despliegue.

<a id="sintoma-logs"></a>

### El disco se llenó de logs

Causa habitual: un `console.log` del cuerpo de cada petición, un `Restart=` en bucle con el mismo error de mil líneas, o Nginx en `debug`. El síntoma de disco de Linux es la consecuencia; aquí está la causa de los logs.

Arreglo:

```bash
journalctl --disk-usage
sudo journalctl --vacuum-size=100M
sudo du -xh /var/log --max-depth=1 | sort -h
```

Quita el log ruidoso del código y despliega esa versión. Recorta el journal como en [13-linux.md](13-linux.md). Si Monit está reiniciando en bucle, `unmonitor` hasta que la salud pase en un arranque manual. Un vacuum sin quitar la causa solo aplaza el llenado unas horas.

## Cómo comprobar

1. Matar el PID de Node lo devuelve a `active` sin intervención, o Monit lo reinicia si lo dejas colgado sin puerto.
2. `curl -fsS http://127.0.0.1:3000/api/salud` falla si paras PostgreSQL, y vuelve cuando lo arrancas. La salud no miente.
3. `monit status` muestra la comprobación del host y la del disco.
4. Tras un reboot, `notas` y `monit` están `active`.
5. Sabes dónde leer el aviso (journal o `monit status`) y lo has abierto al menos una vez después de la prueba del `kill`.

## Si esto no alcanza

`monit check host port`, `systemd StartLimitBurst`, `journalctl vacuum-size`.

La frase `start request repeated too quickly` se busca literal.

## Checkpoint — monitoreo (45 a 60 minutos)

En el servidor del despliegue:

- systemd reanima el proceso después de un `kill`.
- `/api/salud` falla si la base está parada.
- Monit (o el cron del disco, si Monit aún no envía correo) deja una prueba de que miraste el disco.
- El puerto 2812 no está abierto al público.

Hecho cuando puedes decir, sin entrar al navegador de la app, si la API está viva y cuánto disco queda.
