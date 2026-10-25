# Linux

En el servidor, la app no tiene escritorio. Entras por una terminal, miras logs, mueves archivos y dejas el proceso a cargo de systemd. El mapa llama a esta caja "Linux Basics". Los ejemplos son de Ubuntu, que es lo habitual en una EC2 nueva. En tu PC con Windows practicas lo mismo dentro de WSL, o directo en el servidor el día del despliegue.

PowerShell no entiende estos comandos. La terminal del servidor es bash.

## Cuándo usarlo y cuándo no

Úsalo en cuanto la app salga de tu portátil. También para confirmar, por SSH, que un fallo "de AWS" en realidad es un proceso parado.

No hace falta memorizar la administración entera. Con el bloque de abajo se opera la app de esta biblioteca. Lo demás se busca con el nombre del comando.

## Básico

Entrar y mirar sin cambiar nada:

```bash
ssh -i ~/.ssh/notas.pem ubuntu@LA_IP
pwd
whoami
ls -la
df -h
free -h
```

`df -h` es el disco. `free -h` es la memoria. `ls -la` muestra dueños y permisos. `pwd` es la carpeta actual: muchos "no encuentro el .env" son un `cd` que no se hizo.

Archivos y procesos:

```bash
cd /opt/notas
cp .env.example .env
nano .env
mkdir -p /var/log/notas
ps aux | grep node
ss -ltnp | grep 3000
```

`nano` guarda con Ctrl+O y sale con Ctrl+X. Si no está, `sudo apt install nano`. `ss` muestra quién escucha. Es el mismo dato que el síntoma del puerto en [07-nodejs.md](07-nodejs.md#sintoma-puerto).

Instalar lo que la app necesita, una vez:

```bash
sudo apt update
sudo apt install nginx postgresql redis-server
```

Node no siempre va en los repos de Ubuntu a una versión LTS reciente. Si `node -v` es viejo o no existe, usa el paquete de NodeSource o el tarball oficial de nodejs.org para la LTS, y vuelve a abrir la sesión SSH antes de concluir que `node` "no se instaló".

Permisos, en una frase: `r` leer, `w` escribir, `x` entrar en una carpeta o ejecutar. `chmod 600 .env` deja el secreto legible solo por su dueño. `chown ubuntu:ubuntu /opt/notas` entrega la carpeta al usuario que corre la app. Ese usuario no es root.

```bash
sudo mkdir -p /opt/notas
sudo chown ubuntu:ubuntu /opt/notas
chmod 600 /opt/notas/.env
```

Un comando con `sudo` corre como root. Úsalo para instalar y para tocar `/etc`. No para `npm install` ni para `node src/server.js`: si no, los archivos quedan de root y al día siguiente el usuario de la app no puede escribir.

## Intermedio

systemd mantiene el proceso vivo y lo levanta al reiniciar la máquina. `/etc/systemd/system/notas.service`:

```ini
[Unit]
Description=API de notas
After=network.target postgresql.service redis-server.service

[Service]
User=ubuntu
WorkingDirectory=/opt/notas
EnvironmentFile=/opt/notas/.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`EnvironmentFile` exige `CLAVE=valor`, sin `export`, sin comillas raras. Es el reemplazo de `--env-file` en el servidor. El proceso no debe depender de que tú hayas hecho `cd` a mano.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notas
systemctl status notas --no-pager
journalctl -u notas -n 50 --no-pager
```

`enable` lo arranca en cada boot. `restart`, `stop` y `start` son los otros tres que vas a usar. Después de cambiar el `.service` o el `.env`, `daemon-reload` y `systemctl restart notas`. Un restart sin `daemon-reload` no ve el unit nuevo.

Nginx como puerta de entrada queda en [15-despliegue.md](15-despliegue.md). Aquí solo el hábito de leer el log:

```bash
journalctl -u notas -f
journalctl -u nginx -n 50 --no-pager
```

`-f` sigue el log en vivo. Ctrl+C sale de ese seguimiento y no para la app.

Firewall del propio Linux, si está activo:

```bash
sudo ufw status
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

No abras 5432 ni 6379 en `ufw`. Postgres y Redis se quedan en localhost. El grupo de seguridad de AWS es otra cerradura distinta: las dos tienen que permitir el puerto, o la conexión no entra. Ver [14-aws-basico.md](14-aws-basico.md).

## Avanzado

Lo que se rompe a las pocas semanas, no el primer día.

Disco lleno por logs. `journalctl` tiene su propio tope. Configúralo antes de necesitarlo, en `/etc/systemd/journald.conf`:

```text
SystemMaxUse=200M
```

```bash
sudo systemctl restart systemd-journald
```

Eso no borra los logs de Nginx. Esos van en `/var/log/nginx/` y `logrotate` ya viene en Ubuntu para rotarlos. Si añadiste un log propio en `/var/log/notas/app.log`, logrotate no lo conoce hasta que escribas una regla. Más simple: no abras un archivo de log y deja que el proceso escriba a stdout. systemd ya lo guarda. Es el mismo criterio de [07-nodejs.md](07-nodejs.md).

Actualizaciones de seguridad, no "upgrade" el día de una entrega:

```bash
sudo apt update
sudo apt upgrade
```

Hazlo con la app arrancada y cinco minutos para reiniciar si el paquete lo pide (`[restart required]`). Un `dist-upgrade` o un cambio de versión mayor de PostgreSQL no es este comando. Léelo antes de aceptarlo.

Usuario de la app separado del usuario con el que haces SSH, cuando ya no estés practicando:

```text
User=notas
```

El usuario `notas` no tiene shell de login (`adduser --system --group notas` crea uno de sistema). Tú entras como `ubuntu`, con tu clave, y el servicio no puede hacer SSH a ningún sitio. Los archivos de `/opt/notas` son de `notas`. Para desplegar, tu usuario está en el grupo o copias con `sudo -u notas`. En el primer servidor, `User=ubuntu` es aceptable si la clave SSH es tuya y el grupo de seguridad no tiene el puerto 22 abierto al mundo entero.

`tmux` o `screen` no sustituyen a systemd. Sirven para no perder una sesión SSH mientras miras un log. El proceso de la app, si lo dejaste en esa sesión, muere al apagarse el portátil. Si ya te pasó, el síntoma es "en el servidor iba anoche". Pásalo al unit de arriba.

## Errores frecuentes

<a id="sintoma-permission"></a>

### `Permission denied`

Causa habitual: el archivo es de root y el proceso corre como `ubuntu`, o al revés. También una clave SSH con permisos abiertos (`chmod` de la `.pem` tiene que ser `600`; si es `644`, SSH se niega a usarla). Y un directorio sin permiso de ejecución: sin `x` no puedes `cd`, aunque puedas leer el nombre.

Arreglo:

```bash
ls -la /opt/notas
ls -la /opt/notas/.env
```

La columna del dueño tiene que ser el mismo usuario que `User=` del servicio. `namei -l /opt/notas/.env` muestra en qué carpeta del camino se pierde el permiso. No resuelvas con `chmod 777`. Para el `.env`, `600`. Para la carpeta del proyecto, `755` y dueño correcto: `sudo chown -R ubuntu:ubuntu /opt/notas`.

<a id="sintoma-command"></a>

### `command not found`

Causa habitual: el paquete no está instalado, o está instalado y el `PATH` de systemd no es el de tu sesión SSH. Pasa con `node` instalado vía nvm: tu SSH lo encuentra y el servicio no, porque nvm se activa en `.bashrc`, que systemd no lee.

Arreglo: `command -v node` en la SSH te da la ruta real (`/usr/bin/node` o una ruta larga de nvm). Esa ruta completa va en `ExecStart=`. Mejor: instala Node en `/usr/bin` o `/usr/local/bin` y no uses nvm en el servidor. `sudo apt install` el paquete que falte (`nginx`, `postgresql-client`, `redis-tools`).

<a id="sintoma-disco"></a>

### `No space left on device`

Causa habitual: logs, `node_modules` copiados varias veces, un `pg_dump` en el mismo disco, o la imagen de un `apt` a medias.

Arreglo:

```bash
df -h
sudo du -xh / --max-depth=1 | sort -h
```

`du` tarda. Empieza por `/var` y `/home`. Borra dumps viejos y logs ya rotados, no la base de datos. `sudo journalctl --vacuum-size=100M` recorta el journal. Después reinicia la app y comprueba que escribe. Si el disco está al 100 %, Postgres puede haberse parado para no corromperse: `systemctl status postgresql` antes de dar el problema por resuelto. Una copia en el mismo disco no te salva de este fallo; sácala, como en [08-postgresql.md](08-postgresql.md).

<a id="sintoma-servicio"></a>

### El servicio no arranca con systemd

Causa habitual: error de sintaxis en el unit, `ExecStart` con una ruta que no existe, o el programa sale al instante porque falta una variable.

Arreglo, en este orden:

```bash
sudo systemd-analyze verify notas.service
journalctl -u notas -n 80 --no-pager
sudo -u ubuntu /usr/bin/node /opt/notas/src/server.js
```

El tercer comando corre igual que el servicio, en primer plano, y ves el error de Node (`Falta PORT`, `EADDRINUSE`, módulo no encontrado). `status` muestra `203/EXEC` si la ruta de `ExecStart` está mal, y `exited` con código si Node arrancó y murió. `Restart=on-failure` reintenta; si muere siempre, `journalctl` se llena de los mismos renglones. Lee el primero, no el último.

## Cómo comprobar

1. `ssh` entra sin contraseña, con la clave.
2. `systemctl status notas` dice `active (running)` después de cerrar la SSH y volver a entrar.
3. `curl http://127.0.0.1:3000/api/salud` dentro del servidor responde. Desde tu casa todavía no tiene por qué: eso es el grupo de seguridad y Nginx.
4. `sudo reboot`, esperas, vuelves a entrar y el servicio está otra vez `active` sin que tú lo arranques.
5. `.env` está en `600` y no es legible por otros (`ls -la`).

## Si esto no alcanza

`man systemctl`, `man journalctl`, `man ssh`. En la práctica: `systemd service example`, `journalctl unit`, `ufw allow nginx`.

El código de salida de systemd (`203/EXEC`, `217/USER`) se busca literal.

## Checkpoint — moverte en el servidor (45 a 60 minutos)

En una máquina Linux tuya (WSL o la EC2 del siguiente archivo):

- Entras por SSH o por la terminal de WSL.
- La app arranca con systemd, no a mano.
- Lees el log con `journalctl` y encuentras una línea que tú imprimiste.
- Cierras la sesión, vuelves, y el proceso sigue.

Hecho cuando un reinicio de la máquina no te obliga a acordarte del comando `node`.
