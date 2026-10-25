# AWS básico

AWS alquila máquinas, discos de red, nombres DNS y envío de correo. El mapa, en este tramo, pide cinco servicios y nada más: EC2 (la máquina), VPC (la red), S3 (archivos), Route 53 (el dominio) y SES (el correo). El resto del mapa de AWS es la siguiente biblioteca.

Esta ficha es la receta mínima de un solo servidor para la app de notas. No es una certificación.

## Antes de crear nada

AWS cobra. La capa gratuita cambia con el tiempo, dura un periodo limitado en las cuentas nuevas y no cubre todo lo que parece "pequeño" (una IP elástica sin instancia asociada, un dominio, un buzón de SES fuera de la sandbox, un disco que olvidaste). Antes de pulsar Create:

1. Entra en Billing y activa una alarma de presupuesto (aunque sea de unos pocos dólares).
2. Elige la región y no la cambies a mitad (por ejemplo `us-east-1` o la más cercana). Anótala. Los recursos de otra región parecen "desaparecidos".
3. Practica antes el mismo montaje en local: Linux, Postgres, Redis, Node, Nginx. Si en local no arranca, en EC2 tampoco, y allí el reloj de la factura sigue.
4. Al terminar la prueba del día, para la instancia. Si no vas a volver, termínala y borra el volumen, la IP elástica y el balanceador si creaste alguno. Esta receta no usa balanceador.

La consola web basta. La línea de comandos (`aws`) y Terraform repiten lo mismo cuando el clic ya lo entiendes; Terraform está en [18-ansible-y-terraform.md](18-ansible-y-terraform.md).

## Cuándo usarlo y cuándo no

Úsalo cuando quieras que la app tenga una IP pública tuya y, más adelante, un dominio. Para enseñar el proyecto un fin de semana, un túnel o un PaaS salen más baratos; el mapa pide AWS, así que esta es la ruta de estudio, con el gasto controlado.

No subas la base de datos a un RDS "porque es lo serio" en este checkpoint. PostgreSQL va dentro de la misma EC2. RDS es otra caja, de otro mapa, y otra factura.

## Básico

### EC2, la máquina

1. AMI: Ubuntu LTS.
2. Tipo: el más pequeño de la capa gratuita de tu cuenta (`t2.micro` o `t3.micro`, el que la consola marque como free tier eligible en el momento de crearla). Si ninguno sale elegible, para y revisa el precio por hora antes de continuar.
3. Par de claves: créalo, descarga el `.pem` una sola vez, `chmod 600` en tu máquina. Sin ese archivo no entras. No lo subas a Git.
4. Red: la VPC por defecto. Así existe una subred pública y una puerta de enlace a internet, que es lo que el mapa llama VPC en este nivel. No diseñes subredes privadas todavía.
5. Disco: 8 o 16 GB gp3 bastan para la app de notas.
6. Grupo de seguridad: un nombre `notas-sg`.

Reglas de entrada de `notas-sg`, y ninguna más:

| Puerto | Origen | Para qué |
| --- | --- | --- |
| 22 | Tu IP pública de hoy, `/32` | SSH |
| 80 | `0.0.0.0/0` | HTTP, para el certificado |
| 443 | `0.0.0.0/0` | HTTPS |

Tu IP cambia si reinicias el router. Cuando SSH deje de entrar, actualiza la regla; no la abras a `0.0.0.0/0` para "salir del paso" y la dejes. No añadas 3000, 5432 ni 6379: Node, Postgres y Redis solo se ven desde dentro de la máquina. Nginx es quien habla con el exterior, en [15-despliegue.md](15-despliegue.md).

Entra:

```bash
ssh -i ~/.ssh/notas.pem ubuntu@LA_IP_PUBLICA
```

El usuario de la AMI Ubuntu es `ubuntu`. En Amazon Linux sería `ec2-user`. Si dices "permission denied" con el usuario equivocado, no es la clave.

Dentro, el checkpoint de [13-linux.md](13-linux.md): instalar, copiar la app, systemd.

### VPC, lo que tienes que reconocer

No vas a crear una VPC nueva en el básico. Vas a saber leer la que ya usa la instancia:

- La instancia está en una subred. Esa subred tiene una ruta `0.0.0.0/0` hacia un Internet Gateway. Si esa ruta no está, la máquina no sale a internet y tú no entras.
- La IP pública no es la IP privada. SSH y Nginx usan la pública. `DATABASE_URL` usa `127.0.0.1`, la de dentro, no la pública.
- El grupo de seguridad es un firewall aparte de `ufw`. Los dos filtran. Si uno permite y el otro no, no entra.

Con eso se depura "la instancia no responde" sin dibujar una red de tres capas.

### S3, archivos

S3 guarda objetos (archivos) en un bucket. Sirve para el `pg_dump` y para una imagen que suba un usuario. No sirvas la base entera desde S3 ni guardes el `.env` ahí sin cifrado y sin pensarlo: un bucket público se ha llevado más de un secreto.

1. Crea un bucket con un nombre único global (`notas-copias-tu-inicial-2026`, no `notas`).
2. Bloquea todo acceso público (la casilla de Block Public Access, las cuatro opciones).
3. Región: la misma de la EC2, para no pagar cruce de regiones en una prueba.

Sube y baja desde la EC2. La instancia necesita un rol de IAM, no una clave de acceso pegada en el `.env`. En la consola: IAM, rol para EC2, política mínima que solo permita `s3:PutObject`, `s3:GetObject` y `s3:ListBucket` sobre el ARN de ese bucket, y asigna el rol a la instancia.

En la EC2, con AWS CLI instalada (`sudo apt install awscli` o el paquete v2 oficial):

```bash
pg_dump "postgres://notas@127.0.0.1:5432/notas" --format=custom --file=/tmp/notas.dump
aws s3 cp /tmp/notas.dump s3://notas-copias-tu-inicial-2026/notas.dump
rm /tmp/notas.dump
aws s3 ls s3://notas-copias-tu-inicial-2026/
```

`rm` local después de comprobar el `ls`. El dump tiene tus datos; no lo dejes en `/tmp` ni lo copies al repo.

## Intermedio

### Route 53, el dominio

Un dominio cuesta dinero todos los años, con o sin tráfico. Si todavía no quieres pagarlo, quédate en la IP pública y da por practicado el DNS más adelante. No registres un dominio "para una prueba de una hora".

Cuando lo tengas:

1. La zona hospedada pública aparece al registrar el dominio en Route 53, o la creas y cambias los NS en el registrador donde ya lo habías comprado.
2. Un registro A apunta el nombre (`notas.example.com`) a la IP pública de la EC2.
3. Espera a que resuelva. `dig notas.example.com` desde tu máquina tiene que mostrar esa IP. Puede tardar minutos; si el TTL es alto y cambiaste un registro viejo, tarda lo que diga el TTL.

Una IP pública de EC2 cambia al parar y volver a arrancar, salvo que uses una IP elástica. La elástica, asociada a una instancia encendida, suele entrar en la capa gratuita de muchas cuentas; suelta y sin instancia, se cobra. Si vas a parar la máquina por las noches, o aceptas actualizar el registro A, o dejas la elástica y revisas la factura la primera semana.

El certificado HTTPS no lo pide Route 53. Lo pide Let's Encrypt en la propia máquina, en [15-despliegue.md](15-despliegue.md), cuando el DNS ya apunta.

### SES, correo

SES envía el correo de "se ha creado tu cuenta" o "restablece la contraseña". Las cuentas nuevas están en sandbox: solo puedes enviar a direcciones que hayas verificado una a una. Para el checkpoint basta verificar tu propio correo de destino y un remitente. Salir del sandbox es una solicitud a AWS; no hace falta para aprender.

1. Verifica una identidad de correo (tu dirección) en la misma región de la app. La región de SES importa: la API de otra región no ve la identidad.
2. En sandbox, verifica también el destinatario.
3. El rol de la EC2, o un usuario IAM distinto del rol de S3, necesita `ses:SendEmail`. Puedes ampliar el rol de la instancia con esa acción si el mismo servidor envía el correo. No uses la clave raíz de la cuenta AWS.

Prueba desde la consola ("Send test email") antes de escribir código. Cuando eso llegue a la bandeja de entrada, el código es una llamada `SendEmail` con el SDK v3 (`@aws-sdk/client-ses`), desde el servidor, nunca desde el navegador: en el navegador las credenciales quedan expuestas. Remitente: la identidad verificada. Cuerpo: texto y HTML. No adjuntes el token de sesión en una URL sin caducidad; el enlace de restablecimiento caduca y es de un solo uso (una fila en Postgres, como el refresh).

Mira la carpeta de spam en la prueba. Un correo sin SPF, DKIM y DMARC cae ahí. En sandbox, SES ya firma con su dominio de prueba si usas el remitente verificado; al pasar a un dominio tuyo hay que publicar los registros que la consola de SES te muestra, en la misma zona de Route 53. Ese es el nivel de "el correo llega a otro buzón", no el de la primera prueba.

## Avanzado

Lo que se rompe cuando la instancia es la única y alguien más la ve.

Copias. Un `pg_dump` diario a S3, con caducidad de objetos (lifecycle de 30 días) para no acumular dumps. Prueba un `aws s3 cp` de vuelta y un `pg_restore` en una base vacía una vez. Sin esa prueba, el bucket es una esperanza.

Disco y parches de la EC2. El disco de 8 GB se llena con logs y dumps locales. El síntoma está en [13-linux.md](13-linux.md#sintoma-disco). Ampliar el volumen en la consola no agranda el sistema de archivos solo: después hay que `growpart` y `resize2fs`. Búscalo con esas dos palabras el día que lo necesites; no lo hagas "por si acaso" el primer día.

Puerta de SSH. Mejor que dejar el 22 abierto a tu IP para siempre: entra y trabaja, y cuando termines la temporada de estudio deja la regla. Una clave `.pem` robada del portátil es la llave de la máquina. Si se te filtra, bórrala en el panel de pares de claves, crea otra y sustituye `~/.ssh/authorized_keys` en la instancia (con la sesión todavía abierta, para no echarte fuera antes de probar la nueva).

IAM mínimo. El rol de la instancia solo S3 de ese bucket y SES de envío. Nada de `AdministratorAccess` "para no perder el tiempo". La clave de acceso de tu usuario personal, si instalas `aws configure` en el portátil, no se copia a la EC2: allí el rol se asume solo. `aws sts get-caller-identity` dentro de la EC2 tiene que mostrar el rol, no tu usuario.

Apagado. `Stop` conserva el disco y puede conservar la IP elástica si la asociaste. `Terminate` borra la instancia. Un volumen marcado para no borrarse al terminar sobrevive y se sigue cobrando. Míralo en EC2, volúmenes, antes de dar la práctica por cerrada.

Alarmas. Además del presupuesto, una alarma de CPU no es prioritaria en este tamaño. Sí lo es la de costo y, cuando la app esté en serio, la de disco. El monitoreo del proceso es Monit, en la máquina, no CloudWatch obligatorio.

## Errores frecuentes

<a id="sintoma-instancia"></a>

### La instancia no responde por SSH ni por HTTP

Causa habitual, en orden:

1. La IP pública cambió porque paraste y arrancaste. Mira la consola, no el papel donde la anotaste.
2. El grupo de seguridad no tiene el 22 desde tu IP actual, o el 80/443 para HTTP.
3. `ufw` dentro de la máquina bloquea, aunque el grupo de seguridad permita.
4. La subred no tiene ruta al Internet Gateway (si creaste una VPC vacía en vez de usar la de por defecto).
5. Estás en la región equivocada de la consola y miras otra instancia.

Arreglo: en la consola, la instancia está `running` y las comprobaciones de estado pasan. Desde tu máquina, `ssh -v -i notas.pem ubuntu@IP` cuenta hasta dónde llega. Si ni siquiera conecta el TCP, es red (grupo de seguridad, IP, VPC), no la clave. Si conecta y dice `Permission denied (publickey)`, es usuario o `.pem`. La clave correcta con el usuario `ec2-user` en una Ubuntu falla igual que una clave mala.

<a id="sintoma-s3"></a>

### S3 `AccessDenied`

Causa habitual: el comando corre sin el rol (en tu portátil, sin credenciales, o en la EC2 antes de asociar el rol), la política no incluye el bucket exacto, o el bucket está en otra región y el CLI apunta a otra.

Arreglo: `aws sts get-caller-identity` y `aws s3 ls s3://el-bucket`. Si la identidad no es el rol, no estás donde crees. La política tiene que llevar el ARN del bucket en `ListBucket` (`arn:aws:s3:::nombre`) y el de los objetos en `GetObject` y `PutObject` (`arn:aws:s3:::nombre/*`). Son dos recursos distintos; con solo uno de los dos, `ls` o `cp` falla y el otro parece funcionar. Un bucket con Block Public Access sigue siendo usable por el rol: "acceso denegado" no se arregla haciendo el bucket público.

<a id="sintoma-dns"></a>

### El dominio no abre la app

Causa habitual: el registro A apunta a una IP vieja, los NS del registrador no son los de la zona de Route 53, o apuntas el dominio a la IP y nadie escucha en el 80 (Nginx parado). El DNS y el servidor son dos capas.

Arreglo: `dig notas.example.com +short` tiene que imprimir la IP pública actual. Si no imprime nada, el problema es la zona o los NS, no Nginx. Si imprime la IP y el navegador no abre, `curl -I http://ESA_IP` desde tu máquina. Si la IP responde y el nombre no, espera al TTL o hay un proxy de más por medio. Si la IP no responde, vuelve al grupo de seguridad y a [15-despliegue.md](15-despliegue.md#sintoma-502).

<a id="sintoma-correo"></a>

### El correo cae en spam o SES lo rechaza

Causa habitual del rechazo: sigues en sandbox y el destinatario no está verificado, el remitente no es una identidad verificada, o llamas a SES en otra región (`US East` vs `Europe`). El mensaje de la API lo dice (`MessageRejected`, `Email address is not verified`).

Causa habitual del spam: el dominio no tiene los registros DKIM que SES te pide, o el cuerpo parece un aviso genérico sin texto claro y sin un remitente reconocible.

Arreglo: envía la prueba desde la consola de SES, en la misma región, al correo que ya verificaste. Si la consola entrega y tu código no, compara región, identidad del `Source` y permisos del rol. Si la consola también cae en spam, publica DKIM antes de escribir más código. No intentes "esquivar" SES con el puerto 25 de la EC2: AWS lo bloquea por defecto y los correos de un VPS sin reputación se descartan.

## Cómo comprobar

1. SSH entra. Tras un `sudo reboot`, vuelve a entrar y systemd levanta la app.
2. El grupo de seguridad no lista 5432 ni 6379 ni 3000.
3. `aws s3 ls` del bucket de copias funciona dentro de la EC2 y un `pg_restore` de prueba recupera una fila.
4. Si hay dominio, `dig` muestra la IP actual y el navegador abre Nginx.
5. Si hay SES, un correo de prueba llega a tu buzón verificado.
6. La alarma de presupuesto existe y sabes cómo parar la instancia.

## Si esto no alcanza

Documentación, con el nombre del servicio: `ec2 security group ssh`, `s3 block public access iam role`, `route 53 record type A`, `ses sandbox verify email identity`.

El código de error (`AccessDenied`, `MessageRejected`) se busca literal junto al nombre del servicio.

## Checkpoint — despliegue en AWS (medio día, con la factura vigilada)

Una EC2 Ubuntu que es solo tuya:

- SSH restringido a tu IP.
- La app de notas escucha por dentro y se abre por HTTP en la IP pública (HTTPS si ya tienes dominio; si no, el HTTP de este checkpoint es temporal y el candado es la ficha siguiente).
- Un dump en un bucket privado y una restauración probada en una base de prueba.
- La instancia parada o terminada si no la vas a usar esta semana, y los volúmenes sobrantes revisados.

Hecho cuando otra persona, con la clave, entra por SSH, ve la app en el navegador y tú puedes decir cuánto te va a costar dejarla encendida.
