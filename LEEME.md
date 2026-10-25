# Biblioteca de contingencia full stack

Esta carpeta existe para cuando no puedas preguntarle a una IA. Aquí está el patrón, el comando y el arreglo del error habitual para construir una aplicación web completa y dejarla funcionando.

Sigue el orden del [Full Stack Roadmap](https://roadmap.sh/full-stack) (principiantes, 2026). El texto es propio. El mapa solo aporta la lista de temas y el orden.

## Stack de esta biblioteca

Un solo camino, el que el roadmap recomienda:

HTML, CSS, JavaScript, Tailwind, React, npm, Git, GitHub, Node.js, PostgreSQL, API REST, Redis, JWT, Linux, AWS básico (EC2, VPC, S3, Route 53, SES), Monit, GitHub Actions, Ansible y Terraform.

Si una tarea también se hace con otra herramienta, se nombra en una línea. No hay un segundo tutorial.

## Cómo buscar

1. Tienes un error o algo que no se comporta como esperabas: abre [00-indice-de-sintomas.md](00-indice-de-sintomas.md) y busca palabras del mensaje (`CORS`, `EADDRINUSE`, `401`, `relation does not exist`).
2. No sabes en qué parte del mapa estás: abre [00-mapa-del-roadmap.md](00-mapa-del-roadmap.md).
3. El fallo es confuso y no cabe en una ficha: sigue [00-metodo-sin-ia.md](00-metodo-sin-ia.md) y después [19-depuracion.md](19-depuracion.md).
4. Vas a exponer la app a internet o a guardar contraseñas: lee [20-seguridad-minima.md](20-seguridad-minima.md) antes de copiar un ejemplo.

En el editor, la búsqueda de todo el proyecto (en Cursor o VS Code: Ctrl+Shift+F) recorre todos los archivos. Busca el texto literal del error, entre comillas si hace falta.

También puedes abrir [abrir.html](abrir.html) con doble clic. Tiene buscador y no necesita servidor ni internet. Si cambias un markdown, vuelve a generar el visor con:

```bash
node construir-visor.js
```

## Qué significa cada nivel

El significado es el mismo en todos los archivos.

- **Básico.** El mínimo que funciona en tu máquina. Un archivo, un comando, un resultado que puedes ver.
- **Intermedio.** El patrón de una aplicación pequeña de verdad: los datos persisten, los errores se manejan, las piezas están conectadas.
- **Avanzado.** Lo que se rompe cuando hay usuarios reales, y el arreglo concreto: seguridad, rendimiento, despliegue, recuperación. No es un curso de sistemas distribuidos.

Empieza por el básico aunque creas que ya lo sabes. En contingencia, el olvido del básico es lo que más tiempo quita.

## Qué no hace falta memorizar

Memoriza el orden del mapa, el método de depuración y los comandos que usas cada semana (git status, npm run, psql, systemctl). El resto se busca aquí o en la documentación oficial.

Cada ficha termina con las palabras exactas para buscar en la doc oficial si el caso no está cubierto. Fuentes que valen:

- HTML, CSS y JavaScript: MDN Web Docs
- React: react.dev
- Node.js: nodejs.org/docs
- PostgreSQL: postgresql.org/docs
- Redis: redis.io/docs
- AWS: docs.aws.amazon.com
- GitHub Actions: docs.github.com/en/actions
- Ansible: docs.ansible.com
- Terraform: developer.hashicorp.com/terraform/docs

## Orden de lectura si empiezas de cero

1. [00-mapa-del-roadmap.md](00-mapa-del-roadmap.md)
2. [00-metodo-sin-ia.md](00-metodo-sin-ia.md)
3. Los archivos `01` a `18`, en ese orden. Tailwind y React (`02` y `06`) puedes dejarlos para después de Node si el mapa te lo permite; vuelve a ellos antes de la app completa.
4. [12-app-completa.md](12-app-completa.md) es el único sitio donde todas las piezas se arman juntas.
5. [19-depuracion.md](19-depuracion.md) y [20-seguridad-minima.md](20-seguridad-minima.md) se consultan cada vez que algo falla o vas a publicar.

## Qué no está aquí

- Un segundo stack (Python, Java, PHP, Vue, MongoDB).
- Historia de la web, entrevistas o cursos largos.
- Los mapas completos de Frontend, Backend, DevOps y AWS a los que roadmap.sh remite al final. Esos son la siguiente biblioteca, no esta.

## Aviso de dinero

EC2, Route 53, SES y casi todo AWS cobran. Practica el equivalente en tu máquina (Linux, PostgreSQL, Redis, un servidor Node) antes de crear recursos en la nube. Apaga o borra lo que crees el mismo día si solo era una prueba. El detalle está en [14-aws-basico.md](14-aws-basico.md).
