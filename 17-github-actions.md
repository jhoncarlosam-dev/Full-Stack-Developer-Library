# GitHub Actions

GitHub Actions corre comandos en una máquina de GitHub cada vez que empujas código. El checkpoint de CI/CD del mapa es: las pruebas se ejecutan solas y, si pasan, el cambio puede publicarse. Si no pasan, no se publica.

CI es la parte de "correr las pruebas". CD es la parte de "dejar la versión nueva en el servidor". Empieza por CI. Un CD que despliega pruebas rotas automatiza el accidente.

## Cuándo usarlo y cuándo no

Úsalo cuando el repo ya está en GitHub y tienes al menos un comando que decide si el código está bien (`npm test`). Si todavía no hay pruebas, el primer workflow puede limitarse a `npm ci` y un arranque que compruebe que el archivo principal no tiene un error de sintaxis. Mejor una prueba de verdad, aunque sea una.

No metas el despliegue en el mismo workflow el primer día. Primero verde en las pruebas. El despliegue, cuando exista, solo corre en `main` y solo si las pruebas de ese mismo workflow pasaron.

## Básico

Una prueba mínima que de verdad falla si rompes la validación. Con Vitest, que ya se nombró en [04-npm.md](04-npm.md):

```bash
npm install --save-dev vitest
```

`src/texto.js`:

```js
export function textoValido(valor) {
  const text = typeof valor === "string" ? valor.trim() : "";
  return text.length >= 1 && text.length <= 2000;
}
```

`src/texto.test.js`:

```js
import { describe, expect, it } from "vitest";
import { textoValido } from "./texto.js";

describe("textoValido", () => {
  it("rechaza el vacío", () => {
    expect(textoValido("   ")).toBe(false);
  });
  it("acepta una frase", () => {
    expect(textoValido("Primera")).toBe(true);
  });
});
```

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

En local, `npm test` tiene que terminar con código 0. Actions no hace magia: corre eso mismo.

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
```

La versión de Node es la LTS que usas en el servidor. Si el servidor tiene 20, escribe 20. No dejes que Actions corra en una versión y systemd en otra.

Sube el archivo a `main`. En la pestaña Actions del repositorio tiene que aparecer una ejecución verde. Si el repo es nuevo, Actions a veces pide que lo actives en los ajustes.

Un pull request con una prueba rota tiene que verse rojo y no se fusiona. Esa es la regla de protección de la rama, en GitHub: Settings, Branches, rule en `main`, exigir que el check `test` pase. Sin esa regla, el workflow avisa y tú puedes fusionar igual. Para el checkpoint, actívala.

## Intermedio

El workflow de despliegue, separado del de pruebas, solo en `main`, y solo después de que `ci` haya pasado. La forma más simple de "pasó" es poner el job de deploy en el mismo archivo, con `needs: test`. Así no hay forma de desplegar si el job anterior falló.

Desplegar desde GitHub al servidor se hace por SSH. La clave privada es un secreto del repositorio, no un archivo del código. Genera un par solo para esto, en tu máquina:

```bash
ssh-keygen -t ed25519 -f notas-deploy -C "github-actions"
```

La pública (`notas-deploy.pub`) va a `/home/ubuntu/.ssh/authorized_keys` en el servidor. La privada se pega en GitHub: Settings, Secrets and variables, Actions, secreto `SSH_KEY`. Otros secretos: `SSH_HOST` (IP o dominio) y `SSH_USER` (`ubuntu`). No marques "debug" en el workflow para imprimirlos.

Añade un job al mismo archivo, o crea `.github/workflows/deploy.yml` que se dispare al terminar CI en `main`. Un solo archivo es más fácil de leer al principio:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build --prefix frontend
      - name: copiar y reiniciar
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "frontend/dist/*"
          target: "/opt/notas/public"
          strip_components: 2
```

Revisa la versión de `appleboy/scp-action` en el registro de acciones el día que lo uses, y fija un tag. El `source` y `strip_components` dependen de cómo se llame tu carpeta: pruébalo una vez y mira qué quedó en `/opt/notas/public`. Un `index.html` en el sitio equivocado es el fallo más común de este paso.

El restart no va dentro de una acción opaca si puedes evitarlo. Un segundo paso con `appleboy/ssh-action`, también con la versión fijada, ejecuta en el servidor:

```bash
cd /opt/notas
git pull
npm ci --omit=dev
node --env-file=.env src/migrate.js
sudo systemctl restart notas
curl -fsS http://127.0.0.1:3000/api/salud
```

Para que `ubuntu` pueda reiniciar el servicio sin contraseña, una línea de sudoers específica, no `NOPASSWD: ALL`:

```text
ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart notas
```

Archivo `/etc/sudoers.d/notas`, permisos `440`, creado con `sudo visudo -f /etc/sudoers.d/notas`. `visudo` valida la sintaxis. Un sudoers roto te deja sin poder usar `sudo`.

El `git pull` en el servidor exige que el servidor pueda leer el repo (una deploy key de solo lectura). Es otra clave, distinta de la que Actions usa para entrar por SSH. Dos llaves, dos propósitos.

Si `migrate.js` falla, el `curl` no debería ejecutarse: encadena con `&&` o deja que el script salga con código distinto de 0. Actions marca el job rojo y la versión vieja sigue corriendo solo si el restart está después del migrate y no se llegó a él. Orden: migrar, y solo entonces restart.

## Avanzado

Lo que se rompe cuando el workflow es el único que sabe desplegar.

Entorno de pruebas parecido al real. `npm test` que no toca la base no detecta una migración mala. Un servicio de Postgres en el propio job sí:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: notas
      POSTGRES_USER: notas
      POSTGRES_DB: notas
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U notas"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

Y un paso `DATABASE_URL=postgres://notas:notas@localhost:5432/notas node src/migrate.js` antes de los tests que usen la base. El secreto de producción no entra en este job. La URL de prueba va escrita en el workflow porque no es secreta: usuario y clave de mentira, base que se destruye al terminar el job.

Secretos. `${{ secrets.SSH_KEY }}` vacío no siempre falla al parsear el YAML: falla más tarde, con un error de autenticación confuso, o la acción recibe una cadena vacía. El síntoma de abajo lo cubre. No imprimas el secreto en un `run: echo`. Aunque GitHub intente enmascararlo, un `base64` del secreto se cuela en el log. Quien tiene acceso de administrador al repo puede leer los secretos al editarlos; no los pongas en un issue ni en el chat.

Entornos y aprobaciones. En un repo solo tuyo sobra. Cuando haya más gente, el job `deploy` se ata a un environment de GitHub con un revisor obligatorio. Así CI corre en cada PR y CD espera un clic. Es la forma de no publicar un viernes por un push a `main` que no miraste.

No despliegues desde un pull request de un fork con los secretos disponibles. El evento `pull_request` desde forks corre con un token de solo lectura y sin secretos si no cambias la configuración. No cambies esa configuración para "que el PR de un desconocido pueda desplegar". El `if` de `main` y de `push` ya deja el deploy fuera de los PR. Déjalo.

Fijar acciones por tag o por SHA. `@v4` se mueve dentro de la versión mayor. Para esta biblioteca es aceptable en `actions/checkout` y `actions/setup-node`, que son de GitHub. Una acción de un tercero (`appleboy/...`) se fija a un tag concreto y se actualiza el día que tú lo decidas, no sola.

## Errores frecuentes

<a id="sintoma-ci-rojo"></a>

### El workflow está rojo

Causa habitual: `npm test` falla, `npm ci` falla porque el lock no coincide con `package.json`, o un error de sintaxis del YAML (dos espacios de menos y el job ni empieza).

Arreglo: abre la ejecución, abre el job, lee el primer paso rojo, no el último. Copia el comando (`npm test`, `npm ci`) y córrelo en local en la misma versión de Node (`node -v`). Si en local pasa y allí no, compara la versión y si el job tiene la variable que la prueba espera. No pulses "re-run" a ciegas más de una vez: si el código no cambió, el resultado tampoco, salvo un fallo de red al hablar con el registro de npm. En ese caso el log dice `ETIMEDOUT` o `ECONNRESET`, y reintentar sí tiene sentido.

Si el YAML está mal, GitHub muestra el error arriba del workflow, antes de los pasos. Un tabulador en vez de espacios rompe el archivo. El editor tiene que mostrar espacios.

<a id="sintoma-secret"></a>

### El secreto llega vacío

Causa habitual: el secreto está en otro entorno (environment) y el job no declara ese `environment`, o se creó en otro repositorio, u organización, y no en este. También el nombre no coincide: `SSH_KEY` en GitHub y `secrets.SSH_PRIVATE_KEY` en el YAML. Los nombres distinguen mayúsculas.

Arreglo: en el YAML, el nombre entre `secrets.` es exactamente el de la página de secretos. Un paso de diagnóstico temporal, que se borra después:

```yaml
- run: test -n "$SSH_HOST" && echo host-presente || echo host-vacio
  env:
    SSH_HOST: ${{ secrets.SSH_HOST }}
```

Imprime "presente" o "vacío", nunca el valor. Si está vacío, créalo en este repo. Los secretos de un environment solo se ven si el job dice `environment: production`. Los de Dependabot y los de Actions son listas distintas.

<a id="sintoma-no-dispara"></a>

### El workflow no se dispara

Causa habitual: el archivo no está en la rama por defecto en la ruta `.github/workflows/ci.yml` (una carpeta `workflow` en singular no cuenta). O el `on` solo dice `push` a `main` y tú empujaste una rama. O Actions está desactivado en el repositorio. O el YAML no es YAML válido y GitHub lo ignora con un aviso en la pestaña.

Arreglo: en GitHub, abre el archivo en la rama que empujaste y confirma la ruta. La pestaña Actions lista los workflows reconocidos. Si no está, mira el aviso amarillo. Empuja un commit vacío solo cuando la ruta ya es correcta y quieres repetir el evento: `git commit --allow-empty -m "Dispara CI"` y `git push`. No lo hagas para tapar un test rojo.

## Cómo comprobar

1. `npm test` en local, en verde.
2. Un push abre una ejecución y termina en verde.
3. Un commit que rompe la prueba a propósito (en una rama) sale rojo, y `main` no se actualiza si la regla de protección está activa. Luego reviertes ese commit.
4. Si ya hay deploy: el servidor queda en el commit nuevo (`git rev-parse --short HEAD` por SSH) y `/api/salud` responde. Un test rojo no cambia el servidor.

## Si esto no alcanza

Documentación de GitHub: `workflow syntax on push`, `using secrets in github actions`, `encrypted secrets`, `branch protection required status checks`.

El mensaje del paso rojo, literal, más `github actions`.

## Checkpoint — CI/CD (60 a 90 minutos)

- Un test automático que falla si la validación del texto se rompe.
- Un workflow verde en `main`.
- La rama `main` protegida por ese check, o, si la cuenta de GitHub no te deja activar la protección, una nota tuya de no fusionar en rojo y una prueba de que viste el rojo en una rama.
- Opcional y deseable: el job de deploy, con secreto, que reinicia la app solo cuando el test pasó.

Hecho cuando un push que tú no vigilas en la terminal igual ejecuta `npm test`, y sabes dónde mirar el resultado.
