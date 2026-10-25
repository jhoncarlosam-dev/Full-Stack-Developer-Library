# Método sin IA

Cuando algo falla, el orden importa más que la memoria. Recorre estos pasos en este orden. No saltes al paso 4 porque el mensaje "se parece" a un error que viste la semana pasada.

Detalle de herramientas (consola, logs, curl, SQL) en [19-depuracion.md](19-depuracion.md). Esta página es solo la secuencia.

## 1. Reproducir

Escribe, en una frase, qué haces y qué ocurre.

```text
Abro /notas, recargo, y la API responde 401.
El formulario de alta no hace nada al pulsar Guardar.
npm test falla solo en GitHub, en mi máquina pasa.
```

Si no puedes repetirlo, no lo arregles todavía. Anota cuándo apareció: al recargar, solo en el teléfono, solo después del último commit, solo en el servidor.

## 2. Leer el error literal

Copia la primera línea del error, no el párrafo final. La causa suele estar arriba del todo o en la primera línea que menciona tu archivo, no en `node_modules`.

Busca ese texto en [00-indice-de-sintomas.md](00-indice-de-sintomas.md). Si está, sigue esa ficha y vuelve aquí solo si el arreglo no cuadra con lo que ves.

Ignora, de momento, consejos genéricos del tipo "reinicia el ordenador". Reiniciar es el paso 6, no el paso 2.

## 3. Separar la capa

Un fallo vive en un solo sitio hasta que demuestres lo contrario. Tacha capas con una prueba pequeña.

| Capa | Prueba mínima | Si falla aquí |
| --- | --- | --- |
| Navegador | Consola (F12) y pestaña Red. ¿Hay una petición? ¿Qué código trae? | [03-javascript.md](03-javascript.md), [06-react.md](06-react.md) |
| HTML/CSS | ¿El elemento existe en el inspector? ¿Tiene tamaño 0? | [01-html.md](01-html.md), [02-css-y-tailwind.md](02-css-y-tailwind.md) |
| API | `curl` a la misma URL, sin el frontend | [09-api-rest.md](09-api-rest.md) |
| Auth | La misma llamada con y sin token | [10-jwt.md](10-jwt.md) |
| PostgreSQL | La misma consulta en `psql` | [08-postgresql.md](08-postgresql.md) |
| Redis | `redis-cli PING` y la clave que esperabas | [11-redis.md](11-redis.md) |
| Proceso Node | ¿El proceso sigue vivo? ¿En qué puerto? | [07-nodejs.md](07-nodejs.md), [13-linux.md](13-linux.md) |
| Proxy / HTTPS | ¿Nginx responde y el proceso de atrás también? | [15-despliegue.md](15-despliegue.md) |
| Máquina y red | SSH, grupo de seguridad, DNS | [14-aws-basico.md](14-aws-basico.md) |
| CI | El mismo comando del workflow, en local | [17-github-actions.md](17-github-actions.md) |

Ejemplo: la pantalla dice "no se pudieron cargar las notas". En la pestaña Red la petición devuelve 500. `curl` devuelve el mismo 500. Entonces el frontend está descartado. El log de Node dice `relation "notes" does not exist`. La capa es PostgreSQL, no React.

## 4. Cambiar una sola cosa

Un cambio por intento: una línea, una variable de entorno, un índice, un puerto. Anota qué cambiaste. Si no mejora, deshazlo antes del siguiente intento.

Dos cambios a la vez te dejan sin saber cuál funcionó. Al día siguiente no podrás repetirlo.

## 5. Comprobar

La comprobación es el mismo gesto del paso 1, más el caso vecino que podría haberse roto.

- Si arreglaste el alta, prueba también el listado y el borrado.
- Si arreglaste el login, recarga la página y llama a una ruta protegida.
- Si arreglaste el servidor, mira el log después de reiniciar, no solo la primera respuesta.

Cada ficha tiene una sección "Cómo comprobar". Úsala. Una pantalla que "parece" arreglada no cuenta.

## 6. Recién entonces, lo mecánico

Si la capa ya está aislada y el cambio dirigido no bastó:

- Reinicia solo el proceso implicado, no todo el sistema.
- Confirma que estás en el directorio y la rama que crees (`pwd`, `git status`).
- Confirma que el `.env` que lee el proceso es el que editaste.
- Confirma que el navegador no muestra una versión vieja: recarga forzada, o una ventana privada.

## Qué no hacer

- No pegues el error en cinco sitios y apliques el primer comando que veas. Un `DROP TABLE`, un `git reset --hard` o un `terraform destroy` no son pasos de diagnóstico.
- No desactives HTTPS, la autenticación o CORS "para ver si arranca" y lo dejes así. El atajo de diagnóstico se anota y se revierte. La versión que se publica está en [20-seguridad-minima.md](20-seguridad-minima.md).
- No compares tu máquina con el servidor hasta haber ejecutado el mismo comando en los dos. "En local funciona" casi siempre es otra versión del código, otra variable o otra base de datos.

## Plantilla para dejar constancia

Cuando el fallo te lleve más de media hora, escribe esto en un archivo del propio proyecto (`NOTAS-FALLO.md`, sin secretos) antes de seguir:

```text
Qué hice:
Qué esperaba:
Qué ocurrió:
Texto literal del error:
Capa que ya descarté:
Último cambio de un solo paso:
Cómo lo comprobé:
```

Esa nota es tu reemplazo de la conversación con la IA. La próxima vez el índice de síntomas y esta nota te ahorran el recorrido.
