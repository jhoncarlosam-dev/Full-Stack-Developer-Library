# Mapa del roadmap full stack

El [roadmap](https://roadmap.sh/full-stack) es el orden en que un principiante llega a publicar una aplicación web. Cada caja de abajo dice para qué está, qué demuestra el checkpoint y qué archivo de esta biblioteca la cubre.

Audiencia del mapa original: quien empieza de cero. Recomendación del mapa: Node.js, porque ya vienes de JavaScript. Tailwind y React se pueden saltar y retomar después del backend. Esta biblioteca los deja en su sitio del mapa y lo recuerda en cada archivo.

```text
HTML CSS JavaScript
  -> página estática -> interactividad
npm -> paquetes externos
Git GitHub -> trabajo en equipo
Tailwind React -> app de frontend
Node.js -> programas de terminal
PostgreSQL -> CRUD
REST + Redis + JWT -> app completa
Linux + AWS -> despliegue
Monit -> monitoreo
GitHub Actions -> CI/CD
Ansible -> automatización
Terraform -> infraestructura
```

Al terminar, el mapa señala cuatro caminos más largos que no se redactan aquí: Frontend, Backend, DevOps y AWS.

## 1. La página

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| HTML | Estructura, texto, formularios, imágenes y enlaces | Checkpoint: página estática | [01-html.md](01-html.md) |
| CSS | Que esa estructura se vea ordenada en escritorio y en el teléfono | El mismo checkpoint | [02-css-y-tailwind.md](02-css-y-tailwind.md) |
| JavaScript | Que la página reaccione sin recargar | Checkpoint: interactividad | [03-javascript.md](03-javascript.md) |
| Checkpoint — Static Webpages | Una página tuya, sin framework, abierta en el navegador | Publicarla como archivos | [01-html.md](01-html.md) |
| Checkpoint — Interactivity | Botones, listas y formularios que cambian la página | Una lista de tareas en JS puro | [03-javascript.md](03-javascript.md) |

## 2. Herramientas de trabajo

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| npm | Instalar código de otros y definir comandos del proyecto | Checkpoint: paquetes externos | [04-npm.md](04-npm.md) |
| Checkpoint — External Packages | Usar una librería en vez de reescribirla | Validar un formulario con un paquete | [04-npm.md](04-npm.md) |
| Git | Historial local: guardar, comparar, deshacer | Un commit que puedes revertir | [05-git-y-github.md](05-git-y-github.md) |
| GitHub | Copia remota y revisión entre personas | Checkpoint: trabajo colaborativo | [05-git-y-github.md](05-git-y-github.md) |
| Checkpoint — Collaborative Work | Rama, pull request y fusión sin pisar el trabajo ajeno | Un cambio revisado antes de entrar a la rama principal | [05-git-y-github.md](05-git-y-github.md) |

## 3. Frontend con framework

El mapa dice que puedes saltarte esto y volver después del backend. Hazlo si HTML, CSS y JS todavía no están firmes. No llegues a la app completa sin haber vuelto.

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| Tailwind CSS | Estilos con clases ya pensadas, sin escribir un CSS enorme | Una página que se adapta al ancho | [02-css-y-tailwind.md](02-css-y-tailwind.md) |
| React | Pantallas hechas de piezas con estado | Checkpoint: app de frontend | [06-react.md](06-react.md) |
| Checkpoint — Frontend Apps | Una app de varias pantallas que habla con datos, aunque sean locales | Lista con alta, edición y borrado | [06-react.md](06-react.md) |

## 4. Backend

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| Node.js | JavaScript fuera del navegador: servidor y scripts | Checkpoint: apps de terminal | [07-nodejs.md](07-nodejs.md) |
| Checkpoint — CLI Apps | Un programa de consola que lee y escribe archivos | Un script que resume un CSV | [07-nodejs.md](07-nodejs.md) |
| PostgreSQL | Datos que siguen ahí al apagar el proceso | Checkpoint: CRUD simple | [08-postgresql.md](08-postgresql.md) |
| Checkpoint — Simple CRUD Apps | Crear, leer, actualizar y borrar filas de verdad | Notas guardadas en Postgres | [08-postgresql.md](08-postgresql.md) |
| RESTful APIs | Contrato HTTP entre la pantalla y el servidor | Rutas con códigos de estado correctos | [09-api-rest.md](09-api-rest.md) |
| JWT Auth | Saber quién llama y qué puede hacer | Login que sobrevive a recargar | [10-jwt.md](10-jwt.md) |
| Redis | Memoria rápida para caché, límites y sesiones | Una respuesta repetida que no golpea Postgres | [11-redis.md](11-redis.md) |
| Checkpoint — Complete App | Pantalla, API, base de datos, login y caché juntos | La pieza de [12-app-completa.md](12-app-completa.md) | [12-app-completa.md](12-app-completa.md) |

## 5. Ponerla en internet

AWS cobra. Lee el aviso de [14-aws-basico.md](14-aws-basico.md) antes de crear nada.

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| Linux Basics | Moverte en el servidor donde vive la app | Entrar, ver logs, reiniciar un servicio | [13-linux.md](13-linux.md) |
| Basic AWS Services | Máquina, red, archivos, dominio y correo | Checkpoint: despliegue | [14-aws-basico.md](14-aws-basico.md) |
| EC2 | El servidor virtual | Una máquina que responde por SSH | [14-aws-basico.md](14-aws-basico.md) |
| VPC | La red privada donde está esa máquina | Saber por qué un puerto no es visible | [14-aws-basico.md](14-aws-basico.md) |
| S3 | Archivos y copias, no la base de datos | Subir un archivo y leerlo | [14-aws-basico.md](14-aws-basico.md) |
| Route 53 | El nombre de dominio apunta a tu servidor | Un dominio que abre la app | [14-aws-basico.md](14-aws-basico.md) |
| SES | Enviar correo desde la app | Un correo de prueba que llega | [14-aws-basico.md](14-aws-basico.md) |
| Checkpoint — Deployment | La app responde en una URL pública con HTTPS | [15-despliegue.md](15-despliegue.md) | [15-despliegue.md](15-despliegue.md) |

## 6. Que siga funcionando sola

| Caja del mapa | Para qué está | Se demuestra con | Archivo |
| --- | --- | --- | --- |
| Monit | Reiniciar un proceso que se cayó | Checkpoint: monitoreo | [16-monitoreo.md](16-monitoreo.md) |
| Checkpoint — Monitoring | Enterarte de que el disco se llena o la app murió | Una alerta local o un reinicio automático | [16-monitoreo.md](16-monitoreo.md) |
| GitHub Actions | Correr pruebas y el despliegue en cada cambio | Checkpoint: CI/CD | [17-github-actions.md](17-github-actions.md) |
| Checkpoint — CI/CD | Un push a la rama principal deja la app nueva en el servidor, o aborta si las pruebas fallan | Un workflow verde | [17-github-actions.md](17-github-actions.md) |
| Ansible | Repetir la instalación del servidor sin hacerlo a mano | Checkpoint: automatización | [18-ansible-y-terraform.md](18-ansible-y-terraform.md) |
| Checkpoint — Automation | Un playbook que deja Node, Postgres y el servicio listos | El mismo archivo | [18-ansible-y-terraform.md](18-ansible-y-terraform.md) |
| Terraform | Describir la infraestructura como código | Checkpoint: infraestructura | [18-ansible-y-terraform.md](18-ansible-y-terraform.md) |
| Checkpoint — Infrastructure | Crear y destruir el servidor desde un archivo, sin clics | El mismo archivo | [18-ansible-y-terraform.md](18-ansible-y-terraform.md) |

## Qué practicar en cada tramo

No avances de tramo con el checkpoint anterior solo leído. Tiene que haber un resultado en tu máquina.

1. Una página estática tuya.
2. Esa página con una lista que se agrega y se borra, en JavaScript puro.
3. Un paquete de npm usado de verdad y un repositorio en GitHub con una pull request.
4. La misma lista en React y Tailwind, o saltar este punto y volver antes del paso 6.
5. Un script de Node y después notas en PostgreSQL con alta, lectura, cambio y borrado.
6. La misma lista con API, login y una caché. Eso es la app completa.
7. Esa app en un servidor con HTTPS. Primero en local con los mismos comandos de Linux; AWS solo cuando el local ya funciona.
8. Un reinicio automático, un workflow que corre pruebas, y los archivos de Ansible y Terraform del servidor que ya entendiste a mano.

## Siguiente biblioteca, no esta

Cuando el checkpoint de infraestructura esté hecho, el mapa manda a profundizar por separado:

- Frontend: accesibilidad, rendimiento del navegador, más React.
- Backend: diseño de API, SQL avanzado, colas, observabilidad.
- DevOps: más automatización, contenedores, redes.
- AWS: el resto de servicios, con presupuesto y alarmas de costo.

Esos cuatro mapas no están escritos aquí.
