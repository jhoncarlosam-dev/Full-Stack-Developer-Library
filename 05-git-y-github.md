# Git y GitHub

Git guarda el historial en tu máquina: qué cambió, quién y cuándo, y te deja volver. GitHub es una copia de ese historial en internet, más la revisión del trabajo entre personas (pull request). El checkpoint del mapa es ese trabajo en equipo, aunque el "equipo" seas tú en dos ramas.

## Cuándo usarlo y cuándo no

Empieza a usarlo el día que el proyecto tiene más de un archivo que no quieres perder. No hace falta esperar a "tenerlo bonito".

No subas secretos: `.env`, claves, contraseñas, archivos de servicio de AWS. Si ya ocurrió, el síntoma de abajo es urgente, no un arreglo estético.

## Básico

Una vez en la máquina, si `git --version` falla, instala Git desde git-scm.com y abre una terminal nueva.

Dentro de la carpeta del proyecto:

```bash
git init
git status
git add index.html app.js estilos.css package.json package-lock.json .gitignore
git commit -m "Página de notas con alta y borrado"
git log --oneline
```

`.gitignore` antes del primer commit:

```gitignore
node_modules/
.env
dist/
```

Si `node_modules` ya se coló, no lo borres del disco. Quítalo del próximo commit:

```bash
echo node_modules/ >> .gitignore
git rm -r --cached node_modules
git commit -m "Deja de versionar node_modules"
```

Comandos que se usan cada día:

```bash
git status
git diff
git add -p
git commit -m "Valida el correo antes de guardar"
```

`git add -p` enseña cada trozo y pregunta. Es mejor que `git add .` cuando hay cambios mezclados que no quieres en el mismo commit. `git diff` muestra lo que aún no está en stage. `git diff --staged` muestra lo que sí entrará.

Identidad, solo en este repositorio, si Git se niega a commitear por falta de nombre:

```bash
git config user.name "Ada Lovelace"
git config user.email "ada@example.com"
```

Sin `--global` no toca otros proyectos. Esta biblioteca no cambia la configuración global.

Comprueba: `git log --oneline` muestra tu commit y `git status` dice que no hay nada pendiente.

## Intermedio

Ramas y una copia en GitHub. Crea el repositorio vacío en GitHub (sin README, para no divergir) y enlázalo. Sustituye la URL por la tuya. HTTPS o SSH: si nunca configuraste una clave SSH, HTTPS con el gestor de credenciales de GitHub es el camino con menos piezas.

```bash
git switch -c arregla-formulario
git commit -m "Impide enviar el título vacío"
git push -u origin arregla-formulario
```

En GitHub, abre un pull request hacia `main`. Aunque trabajes solo, el PR es el checkpoint: lees el diff completo antes de fusionar. Fusiónalo con el botón de GitHub o en local:

```bash
git switch main
git pull
git merge arregla-formulario
git push
```

Traer cambios de otra persona, o los tuyos desde otro ordenador:

```bash
git pull
```

`git pull` es `git fetch` más `git merge`. Si prefieres ver qué llegó antes de mezclar: `git fetch` y luego `git log HEAD..origin/main --oneline`.

Deshacer con red de seguridad:

| Situación | Comando |
| --- | --- |
| El archivo está modificado y quieres la versión del último commit | `git restore archivo.js` |
| Lo añadiste con `git add` y quieres sacarlo del stage, sin perder el cambio | `git restore --staged archivo.js` |
| El commit ya está hecho y no se ha empujado, y quieres añadir un archivo olvidado | `git add archivo.js` y `git commit --amend --no-edit` |
| El commit ya está en GitHub | No hagas amend. Un commit nuevo que corrige. |

`--amend` reescribe el último commit. Si ya habías empujado ese commit, el siguiente push exigiría forzar la rama y pisar el historial remoto. No fuerces `main`.

Ver qué había en un commit viejo:

```bash
git show abc1234
git switch --detach abc1234
```

`--detach` mira ese commit sin mover la rama. Para volver: `git switch main`. No commitees en detached HEAD; si lo haces, crea una rama ahí mismo (`git switch -c rescate`) antes de irte.

## Avanzado

Historial que ya está publicado y un error que no se borra "deshaciendo la pantalla".

Revertir un commit que ya está en `main`, sin reescribir:

```bash
git revert abc1234
git push
```

Eso crea un commit nuevo que deshace ese cambio. El historial de los demás sigue siendo válido.

Guardar trabajo a medias sin commitear basura:

```bash
git stash push -m "a medias el login"
git switch main
git stash pop
```

Si `pop` entra en conflicto, los archivos quedan marcados como en un merge. Resuélvelo igual que el síntoma de conflicto y borra el stash solo cuando `git status` esté limpio (`git stash drop` si `pop` ya lo aplicó a medias; comprueba `git stash list`).

Un secreto que llegó a GitHub hay que darlo por filtrado aunque borres el archivo en un commit posterior: sigue en el historial y en los clones ajenos. Rota la clave (en el proveedor: AWS, base de datos, GitHub) antes de limpiar el Git. Luego saca el archivo del último commit y añade la regla al `.gitignore`. Reescribir historia pública (`git filter-repo`, no cubierto como receta de un solo comando porque es fácil de equivocar) es el segundo paso, y exige avisar a quien haya clonado. La regla de oro está en [20-seguridad-minima.md](20-seguridad-minima.md#sintoma-clave-repo).

Archivos grandes: Git no es un disco de vídeos ni de `node_modules`. Si un PDF o un zip pesado entró, el repositorio queda lento para siempre aunque lo borres después. Sácalo en el siguiente commit y, si aún no habías empujado, es el único momento razonable para rehacer el commit local.

## Errores frecuentes

<a id="sintoma-perdidos"></a>

### Perdiste cambios que no habías commiteado

Causa habitual: `git restore`, `git checkout -- archivo` o `git reset --hard` sobre un archivo que nunca estuvo en un commit. Git no puede devolver lo que no guardó.

Arreglo posible, sin garantía: el editor (Cursor, VS Code) tiene historial local del archivo (Timeline / Línea de tiempo, o Ctrl+Z si la pestaña sigue abierta). `git stash list` por si lo guardaste. `git fsck --lost-found` solo recupera commits, no cambios nunca añadidos. Si no está en ninguno, no hay comando que lo traiga de vuelta. A partir de aquí, commitea en cuanto el trozo funcione, aunque el mensaje sea `wip: lista que ya añade`.

<a id="sintoma-conflicto"></a>

### Conflicto de merge

Causa habitual: las dos ramas editaron las mismas líneas. Git escribe marcas dentro del archivo:

```text
<<<<<<< HEAD
const limite = 80;
=======
const limite = 120;
>>>>>>> arregla-formulario
```

Arreglo: abre el archivo, deja el código que debe quedar (una de las dos versiones, o una mezcla), borra las tres marcas (`<<<<<<<`, `=======`, `>>>>>>>`). Busca en el proyecto si quedó alguna marca: una que se escape rompe el programa. Después:

```bash
git add archivo.js
git commit
```

No hace falta un mensaje elaborado: Git propone "Merge...". Si el conflicto es solo `package-lock.json`, no lo unas a mano; sigue [04-npm.md](04-npm.md#sintoma-lock).

<a id="sintoma-rama-equivocada"></a>

### Hiciste el commit en la rama equivocada

Causa habitual: estabas en `main` y el commit todavía no se ha empujado.

Arreglo si no está empujado:

```bash
git switch -c arregla-formulario
git switch main
git reset --hard HEAD~1
```

Eso mueve el commit a la rama nueva (al cambiar de rama te lo llevas, porque el commit es tuyo y `main` lo tenía) y luego deja `main` un commit atrás. `--hard` borra cambios no commiteados. Haz `git status` antes y confirma que está limpio.

Si ya empujaste a `main`, no reescribas. Crea la rama donde estás y revierte en `main` con `git revert` si ese commit no debía publicarse.

<a id="sintoma-push"></a>

### `push rejected` o `non-fast-forward`

Causa habitual: en GitHub hay commits que tú no tienes (otro ordenador, o el botón de editar en la web).

Arreglo:

```bash
git fetch
git pull
git push
```

Si `pull` abre un conflicto, es el síntoma anterior. No uses `git push --force` en `main`. En una rama tuya que nadie más usa, `--force-with-lease` es el único force aceptable, y solo si sabes que estás reescribiendo a propósito (después de un amend que ya habías empujado por error).

<a id="sintoma-secreto"></a>

### Subiste un secreto en un commit

Causa habitual: un `.env` o un JSON de claves añadido con `git add .`.

Arreglo, en este orden, el mismo día:

1. Revoca la clave en el servicio que la emitió y crea otra. La antigua quedó expuesta en cuanto se empujó, y también si el repositorio era privado y hubo un clon.
2. Quita el archivo del árbol y añádelo al `.gitignore`. Commit nuevo.
3. Confirma que la app usa la clave nueva desde un `.env` que no está en Git.
4. Si el repositorio es público, asume que la clave vieja ya se copió. Rotarla es el arreglo; borrar el commit no alcanza.

## Cómo comprobar

1. `git status` limpio después de cada decisión de "esto ya está".
2. Un compañero, u otra carpeta tuya, hace `git clone` y `npm ci` y el proyecto arranca sin pedirte archivos por chat.
3. Una rama con un commit pequeño se fusiona por pull request y `main` queda con ese cambio.
4. `git log --oneline` se lee como una lista de pasos, no como un único commit "cambios".

## Si esto no alcanza

Documentación de Git: `git restore`, `git switch`, `git revert`, `git merge conflicts`.

De GitHub: `about pull requests`, `cloning a repository`, `removing sensitive data from a repository` si llegaste al secreto ya empujado.

## Checkpoint — trabajo colaborativo (45 a 60 minutos)

Con el proyecto ya en un repositorio local:

- `.gitignore` que excluye `node_modules` y `.env`.
- Repositorio en GitHub y al menos dos commits en `main` con mensajes que dicen qué se logró.
- Una rama, un cambio pequeño (un texto, una validación), un pull request y la fusión.
- `git pull` en una segunda carpeta clonada, para ver el cambio llegar.

Hecho cuando el clon tiene el mismo código que das por bueno, sin copiar la carpeta a mano.
