# Ansible y Terraform

Ansible deja el servidor configurado igual cada vez que lo ejecutas: paquetes, unit de systemd, Nginx, la app. Terraform describe la infraestructura (la EC2, el grupo de seguridad, el bucket) en un archivo y la crea o la destruye. El mapa los separa: primero automatización (Ansible), después infraestructura (Terraform).

Los dos se practican cuando ya hiciste el montaje a mano una vez, en [13-linux.md](13-linux.md), [14-aws-basico.md](14-aws-basico.md) y [15-despliegue.md](15-despliegue.md). Automatizar un montaje que no entiendes copia el error a un archivo más largo.

AWS sigue cobrando lo que Terraform cree. Un `apply` es un clic de "Create" con otro nombre.

## Cuándo usarlo y cuándo no

Úsalos para poder tirar la máquina de práctica y volver a tenerla mañana sin repetir veinte pasos de memoria.

No hace falta Ansible para instalar Node en tu portátil, ni Terraform para crear un bucket que vas a usar una tarde. El checkpoint es rehacer el servidor de la app, no gestionar una empresa.

Se puede hacer lo mismo con scripts bash. El mapa pide estas dos herramientas; los archivos de abajo son el mínimo, no un curso de cada una.

## Básico

### Ansible, un solo servidor

En tu máquina (donde está el código), con Python 3:

```bash
pip install ansible
```

O el paquete de tu sistema. `ansible --version` tiene que imprimir un número.

Carpeta `deploy/ansible/` en el repo. Nada de secretos. `inventory.ini`:

```ini
[web]
notas ansible_host=LA_IP ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/notas.pem
```

`playbook.yml`:

```yaml
- name: preparar la app de notas
  hosts: web
  become: true
  tasks:
    - name: paquetes
      ansible.builtin.apt:
        name:
          - nginx
          - postgresql
          - redis-server
        state: present
        update_cache: true

    - name: carpeta de la app
      ansible.builtin.file:
        path: /opt/notas
        state: directory
        owner: ubuntu
        group: ubuntu
        mode: "0755"
```

```bash
ansible -i inventory.ini web -m ping
ansible-playbook -i inventory.ini playbook.yml
```

`ping` tiene que decir `pong`. Si no, es el síntoma de abajo y no tiene sentido seguir. `become: true` es sudo. El usuario `ubuntu` necesita poder hacer sudo, que en la AMI de Ubuntu ya puede.

La segunda ejecución del mismo playbook tiene que decir `ok`, no volver a instalar de cero ni fallar. Eso es idempotencia: correrlo dos veces deja el mismo resultado. Si una tarea "cambia" siempre, está mal escrita (por ejemplo un `shell` que añade una línea a un archivo cada vez). Prefiere el módulo (`ansible.builtin.file`, `ansible.builtin.copy`, `ansible.builtin.template`) al `shell`.

### Terraform, un grupo de seguridad y poco más

Instala Terraform desde la documentación de HashiCorp (el paquete oficial), no un binario de un sitio al azar. `terraform version` imprime el número.

`deploy/terraform/main.tf`, región y AMI revisadas el día que lo uses. La AMI de Ubuntu cambia; no copies un `ami-012345` de un ejemplo viejo. Búscala en la consola de EC2 al lanzar una instancia Ubuntu y pégala, o usa el data source de Canonical que esté vigente en la doc (`terraform aws ami ubuntu`). Si el data source falla, una AMI concreta de tu región, escrita en el archivo, es suficiente para el checkpoint.

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "notas" {
  name = "notas-sg"
  description = "ssh desde casa, http y https"

  ingress {
    description = "ssh"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["TU_IP/32"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

Sustituye `TU_IP`. No dejes `0.0.0.0/0` en el 22 "temporalmente" dentro de un archivo que vas a aplicar.

```bash
cd deploy/terraform
terraform init
terraform plan
terraform apply
```

`plan` es la lectura obligatoria. Tiene que decir que va a crear el grupo de seguridad y nada que tú no esperes. `apply` pide confirmación: escribes `yes`. Las credenciales son las de tu usuario IAM en tu máquina (`aws configure` o variables de entorno), con permiso para ese recurso, no la clave raíz, y no se commitean. `terraform.tfstate` contiene ids y a veces datos sensibles: está en `.gitignore`, igual que `.env`. Sin el state, Terraform cree que no hay nada y quiere volver a crear.

Para el checkpoint de infraestructura basta este grupo, o una EC2 además del grupo si aceptas el costo de dejarla unas horas. Si añades `aws_instance`, el `plan` tiene que mostrar un `t2.micro` o `t3.micro` que tú hayas elegido mirando el precio, un disco pequeño y este security group. Al terminar la práctica:

```bash
terraform destroy
```

`destroy` también enseña un plan. Léelo. Confirma que lo que va a borrar es la práctica, no un recurso con otro nombre que ya tenías en la cuenta.

## Intermedio

Ansible termina lo que el playbook básico dejó a medias: el unit, Nginx y el `.env` a partir de una plantilla sin secretos dentro del repo.

`deploy/ansible/templates/notas.env.j2`:

```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://notas:{{ db_password }}@127.0.0.1:5432/notas
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET={{ jwt_secret }}
```

Los valores viajan por variables de Ansible, en un archivo que no se versiona, `deploy/ansible/secretos.yml`, listado en `.gitignore`:

```yaml
db_password: "cambia-esto"
jwt_secret: "cambia-esto-tambien"
```

En el playbook:

```yaml
- name: entorno
  ansible.builtin.template:
    src: templates/notas.env.j2
    dest: /opt/notas/.env
    owner: ubuntu
    group: ubuntu
    mode: "0600"
```

Y el unit de systemd con `ansible.builtin.copy` hacia `/etc/systemd/system/notas.service`, seguido de:

```yaml
- name: recargar systemd
  ansible.builtin.systemd:
    name: notas
    state: started
    enabled: true
    daemon_reload: true
```

`state: started` arranca si no está, y no reinicia si ya está. Para recoger un cambio de código hace falta `restarted`, y eso corta conexiones. Sé explícito: una tarea de restart que solo corre cuando tú la pides (`--tags restart`), no en cada `playbook` de "asegurarme de que los paquetes siguen".

Terraform, state remoto cuando dejes de ser la única persona. En solitario, el `terraform.tfstate` local, fuera de Git, alcanza si haces copia de ese archivo en un sitio privado (el bucket de S3 con acceso solo tuyo es el sitio natural). Si lo pierdes y los recursos siguen en AWS, no lances `apply` a ciegas: importar (`terraform import`) o borrar a mano en la consola lo que creaste, con calma. Dos states distintos queriendo crear el mismo `notas-sg` chocan con "already exists".

Un solo directorio de Terraform por entorno. No reutilices el de práctica, con su state, para "la de verdad" cambiando un nombre a mitad. Carpeta nueva, state nuevo, `plan` leído desde cero.

## Avanzado

Lo que se rompe cuando el archivo manda sobre la consola y alguien cambia las dos.

No edites en la consola lo que Terraform ya controla. El siguiente `plan` querrá deshacer el clic (cerrar un puerto que abriste a mano, o volver a abrir uno que cerraste). Si el cambio de la consola era correcto, llévalo al `.tf` y deja que el `plan` quede en "no changes". Si era un experimento, deshazlo en la consola antes del siguiente `apply`.

`prevent_destroy` en el bucket de copias:

```hcl
resource "aws_s3_bucket" "copias" {
  bucket = "notas-copias-tu-inicial-2026"
  lifecycle {
    prevent_destroy = true
  }
}
```

Así un `destroy` de un descuido falla al llegar al bucket en vez de borrar los dumps. Para destruirlo de verdad el día que cierres el proyecto, quitas el bloque, aplicas y luego destruyes. Es un paso extra a propósito.

Ansible y secretos. `secretos.yml` no entra en el repo. Un `ansible-playbook` con `-v` o `-vvv` puede imprimir el `.env` en tu terminal. No pegues esa salida en un issue. En CI, Ansible no corre con `-vvv`.

El playbook no hace `git pull` como root dentro de un directorio de `ubuntu` con llaves mezcladas. El despliegue de código sigue siendo el de [17-github-actions.md](17-github-actions.md) o un `git pull` como el usuario de la app. Ansible prepara la máquina; no sustituye al historial de Git.

Terraform y la IP de SSH. Tu IP cambia y el `cidr_blocks` queda viejo: no entras, y la tentación es abrir `0.0.0.0/0`. Cambia la IP en el `.tf`, `plan`, `apply`. El plan solo debe tocar esa regla.

Prueba de destrucción. En la cuenta de práctica, `terraform destroy` y comprueba en la consola que la instancia y el grupo ya no están, y que el bucket con `prevent_destroy` sí está. Volver a crear es el checkpoint: `apply` y luego el playbook de Ansible, y la app queda como la dejaste documentada. Si ese recorrido solo funciona "porque la máquina vieja seguía ahí", no está automatizado.

## Errores frecuentes

<a id="sintoma-ansible"></a>

### Ansible `UNREACHABLE`

Causa habitual: IP vieja, grupo de seguridad sin tu IP actual, clave distinta de la que usaste con `ssh` a mano, o `ansible_user` equivocado.

Arreglo: el mismo `ssh -i ~/.ssh/notas.pem ubuntu@LA_IP` tiene que entrar antes de repetir el playbook. Si SSH entra y Ansible no, compara `ansible_ssh_private_key_file` y el usuario del inventory con el comando SSH que sí funcionó. `ansible -i inventory.ini web -m ping -vvv` muestra a qué IP intentó hablar. No uses `-vvv` si el playbook ya incluye secretos; para el `ping` no hay secretos.

<a id="sintoma-lock-tf"></a>

### `Error acquiring the state lock`

Causa habitual: otro `apply` o `plan` sigue corriendo, o se cortó a medias y dejó el lock. Terraform crea un archivo de lock para que dos applies no escriban el state a la vez. Con state local, el lock es de tu máquina. Con state en S3, el lock está en DynamoDB (o en el mecanismo de la versión que uses) y sobrevive a cerrar la tapa del portátil.

Arreglo: espera a que el otro comando termine. Si estás seguro de que no hay otro (cerraste la terminal, solo estás tú), borra el lock como dice el mensaje, con el id que el propio error imprime. No borres `terraform.tfstate` para "quitar el lock": eso olvida los recursos. Después, `terraform plan` tiene que verse coherente con lo que hay en la consola de AWS.

<a id="sintoma-destroy"></a>

### Un `apply` quiere destruir un recurso que necesitas

Causa habitual: cambiaste el nombre del recurso en el `.tf` (Terraform lo entiende como "borra este y crea otro"), cambiaste un atributo que obliga a reemplazar (en las EC2, varios lo hacen, y el plan lo dice con `forces replacement`), o estás en el directorio y el state de otra práctica.

Arreglo: no escribas `yes`. Lee el plan línea a línea. `Plan: 0 to add, 1 to change, 0 to destroy` es muy distinto de `1 to destroy`. Si el reemplazo es una EC2, vas a perder el disco de esa instancia salvo que el volumen tenga `delete_on_termination = false` y aun así la app se cae durante el cambio. Corrige el `.tf` para que el plan no destruya, o acepta el reemplazo después de un `pg_dump` restaurado en otra parte. `terraform plan -out=plan.bin` y `terraform apply plan.bin` aplican exactamente lo que leíste, no un plan nuevo calculado un minuto después.

## Cómo comprobar

1. `ansible-playbook` dos veces seguidas: la segunda no cambia paquetes ni permisos del `.env` (sigue en `600`).
2. `terraform plan` después de un `apply` dice que no hay cambios.
3. El grupo de seguridad en la consola coincide con el archivo: 22 solo desde tu IP, sin 5432.
4. `terraform.tfstate` y `secretos.yml` no salen en `git status`.
5. Has leído un plan que destruía algo y has salido sin escribir `yes`, aunque fuera una prueba. Saber abortar es parte del checkpoint.

## Si esto no alcanza

Ansible: `ansible apt module`, `ansible template module`, `ansible systemd module`, `ansible unreachable`.

Terraform: `terraform plan`, `terraform state`, `terraform prevent_destroy`, y el nombre del recurso AWS (`aws_security_group`, `aws_instance`).

El error de AWS que Terraform envuelve (`InvalidAMIID`, `InvalidParameterValue`) se busca literal.

## Checkpoint — automatización e infraestructura (medio día, con la factura en mente)

- Un playbook que deja Nginx, PostgreSQL, Redis, la carpeta y el unit listos en una Ubuntu a la que ya puedes entrar por SSH.
- Un Terraform que crea el grupo de seguridad (y la instancia, si decides pagarla unas horas) y cuyo `plan` posterior está limpio.
- `.gitignore` con el state y los secretos.
- Al acabar la práctica de la instancia, `destroy` o stop consciente, y una mirada a la consola de facturación.

Hecho cuando puedes explicar qué harías si la EC2 desapareciera esta noche: aplicar Terraform, pasar Ansible, desplegar el commit que CI ya probó. Si algún paso solo está en tu memoria y no en un archivo, todavía no está hecho.

## Siguiente biblioteca

Con esto termina el recorrido del mapa de full stack para principiantes. Los mapas largos de Frontend, Backend, DevOps y AWS quedan fuera, a propósito. Vuelve a [00-mapa-del-roadmap.md](00-mapa-del-roadmap.md) cuando quieras elegir el siguiente.
