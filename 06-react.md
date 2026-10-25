# React

React parte la pantalla en componentes: funciones que devuelven el HTML de un trozo y se vuelven a ejecutar cuando cambian sus datos (el estado). El mapa lo coloca junto a Tailwind y permite saltarlo hasta después del backend. Antes de esta ficha tienen que estar firmes el HTML, el CSS y el JavaScript de las fichas 01 a 03. React no sustituye esas tres: las organiza.

El empaquetador de estos ejemplos es Vite. Crear el proyecto:

```bash
npm create vite@latest notas-ui -- --template react
cd notas-ui
npm install
npm install tailwindcss @tailwindcss/vite
npm run dev
```

La conexión de Tailwind está en [02-css-y-tailwind.md](02-css-y-tailwind.md). Entra a la URL que imprime el comando (normalmente `http://localhost:5173`).

## Cuándo usarlo y cuándo no

Úsalo cuando haya varias pantallas o una pantalla cuyo HTML cambia según datos (listas, formularios, sesión). Para una página de un solo bloque estático, React sobra: el checkpoint de HTML es más claro sin él.

No hace falta React para llamar a una API. `fetch` ya lo hace. React entra cuando quieres que el resultado de esa llamada pinte la pantalla sin que tú toques el DOM a mano.

## Básico

Un componente, un estado, una lista. `src/App.jsx`:

```jsx
import { useState } from "react";

export default function App() {
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState([]);

  function agregar(event) {
    event.preventDefault();
    const texto = titulo.trim();
    if (!texto) return;
    setNotas((prev) => [...prev, { id: crypto.randomUUID(), texto }]);
    setTitulo("");
  }

  function borrar(id) {
    setNotas((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Notas</h1>
      <form onSubmit={agregar} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="titulo">Título</label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-stone-900 px-3 py-2 text-white">
          Guardar
        </button>
      </form>
      <ul className="mt-6 grid gap-2">
        {notas.map((nota) => (
          <li key={nota.id} className="flex items-center justify-between gap-3 rounded border border-stone-300 p-3">
            <span>{nota.texto}</span>
            <button type="button" onClick={() => borrar(nota.id)}>Borrar</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Reglas que evitan los síntomas de abajo:

- El HTML de React se llama JSX y va en `return`. Escribes `className`, no `class`, y cierras todas las etiquetas (`<input />`, `<li>...</li>`).
- El estado se cambia con la función (`setNotas`), no con `notas.push`. Un push modifica el mismo array y React puede no repintar.
- La forma `setNotas((prev) => ...)` usa el valor más reciente. Hace falta cuando el nuevo valor depende del anterior y hay varios clics seguidos.
- `key={nota.id}` identifica la fila. El índice del array sirve solo si la lista no se reordena ni se borra por el medio.
- `sr-only` de Tailwind deja el label disponible para el lector de pantalla y lo oculta en la vista. Si no usas Tailwind, un `<label>` visible es mejor que uno escondido a mano.

Comprueba: `npm run dev`, añade dos notas, borra la primera. Recargar las pierde: siguen en memoria. Igual que en el JavaScript básico.

## Intermedio

Datos que vienen del servidor, pantalla de carga y pantalla de error. El servidor puede ser el de [09-api-rest.md](09-api-rest.md). Mientras no exista, apunta el `fetch` a una lista fija solo para ver el estado de carga, y cámbialo en cuanto la API responda.

```jsx
import { useEffect, useState } from "react";

export default function ListaNotas() {
  const [notas, setNotas] = useState([]);
  const [estado, setEstado] = useState("cargando");

  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/notas", { signal: controlador.signal })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
        return respuesta.json();
      })
      .then((datos) => {
        setNotas(datos);
        setEstado("listo");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEstado("error");
      });
    return () => controlador.abort();
  }, []);

  if (estado === "cargando") return <p>Cargando…</p>;
  if (estado === "error") return <p>No se pudieron cargar las notas.</p>;
  if (notas.length === 0) return <p>No hay notas todavía.</p>;

  return (
    <ul>
      {notas.map((nota) => (
        <li key={nota.id}>{nota.texto}</li>
      ))}
    </ul>
  );
}
```

El array vacío `[]` al final de `useEffect` significa "una vez, al aparecer el componente". Sin ese array, el efecto corre después de cada pintado y, si dentro hay un `setNotas`, el pintado se repite sin fin.

`AbortController` cancela la petición si el usuario se va de la pantalla antes de que responda. Sin eso, la respuesta llega y llama a `setNotas` en un componente que ya no está, y React avisa.

En desarrollo, Vite puede proxyar `/api` al Node del puerto 3000 para no pelear con CORS. En `vite.config.js`:

```js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
```

Ese proxy no existe en el build de producción. En producción el navegador y la API comparten origen gracias a Nginx, como en [15-despliegue.md](15-despliegue.md), o la API manda las cabeceras CORS.

Varias pantallas sin meter un router todavía: un estado `vista` con valores `"lista"` y `"detalle"` basta para el checkpoint. React Router entra cuando haya URLs que una persona quiera guardar o compartir (`/notas/12`). Paquete: `react-router`. Rutas mínimas:

```jsx
import { BrowserRouter, Route, Routes, Link } from "react-router";

export default function App() {
  return (
    <BrowserRouter>
      <nav><Link to="/">Lista</Link></nav>
      <Routes>
        <Route path="/" element={<ListaNotas />} />
        <Route path="/nueva" element={<NuevaNota />} />
      </Routes>
    </BrowserRouter>
  );
}
```

El nombre del paquete y el del import cambian según la versión mayor. Si el import falla, abre `node_modules/react-router/package.json` y mira el campo que la documentación de esa versión indica, o busca `react router installation` para el número que instalaste. No mezcles tutoriales de la versión 6 con la 7.

## Avanzado

Lo que se rompe cuando el componente se usa en serio.

Subir el estado al padre solo si dos hermanos lo necesitan. Si solo lo usa un formulario, déjalo dentro del formulario. Un `App.jsx` con veinte `useState` es la señal de partir componentes, no de instalar un gestor de estado global. Para esta app no hace falta Redux ni Zustand.

Formulario de edición: copia el dato al estado local al abrir, guarda contra el servidor, y vuelve a pedir la lista. No edites el objeto de la lista "en caliente" si el usuario puede cancelar.

```jsx
function guardarCambio(id, texto) {
  setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, texto } : n)));
}
```

El `...n` copia el resto de campos. `n.texto = texto` muta el objeto que React ya tenía y a veces no repinta, a veces repinta a medias.

Listas largas: no pagines en el navegador trayendo 10 000 filas. Pide `?limit=20&cursor=` a la API, como en [09-api-rest.md](09-api-rest.md).

Build que se publica:

```bash
npm run build
npm run preview
```

`dist/` es HTML, CSS y JS estáticos. El servidor web los sirve; Node no tiene por qué servirlos si ya tienes Nginx. Las variables que el navegador debe ver van con prefijo `VITE_` y se leen como `import.meta.env.VITE_API_URL`. Cualquier otra variable del `.env` no llega al navegador, y eso es bueno: una clave de base de datos en el frontend queda pública. Relee [20-seguridad-minima.md](20-seguridad-minima.md) antes de meter algo en `VITE_`.

`npm run dev` es solo para desarrollar. En el servidor se ejecuta el contenido de `dist/`, no el servidor de Vite.

## Errores frecuentes

<a id="sintoma-pantalla-en-blanco"></a>

### Pantalla en blanco solo con React

Causa habitual: un error al renderizar. En desarrollo, React muestra una caja roja; si el error ocurre antes de montar, solo está en la consola. También pasa si `main.jsx` apunta a un `div#root` que no existe en `index.html`.

Arreglo: abre la consola y lee la primera línea tuya, no la de `react-dom`. Comprueba que `index.html` tiene `<div id="root"></div>` y que `main.jsx` hace `createRoot(document.getElementById("root")).render(<App />)`. Si la caja roja dice que un componente devolvió `undefined`, falta el `return` del JSX.

<a id="sintoma-estado-no-cambia"></a>

### El estado no cambia en pantalla

Causa habitual: mutaste el array o el objeto (`notas.push`, `nota.texto = ...`) y llamaste a `setNotas(notas)` con la misma referencia. React compara por identidad y no ve un cambio.

Arreglo: crea un array nuevo, como en `setNotas((prev) => [...prev, nota])` o `filter` / `map`. Comprueba con un `console.log` dentro del componente: si el log muestra el dato nuevo y la pantalla no, el valor pintado no es ese estado (estás leyendo otra variable).

<a id="sintoma-bucle-efecto"></a>

### `Maximum update depth exceeded` o el efecto se dispara sin parar

Causa habitual: `useEffect` sin el array de dependencias, o con una dependencia que es un objeto creado en cada pintado (`useEffect(..., [ { id } ])` crea un objeto nuevo siempre). Dentro del efecto hay un `setState`, que vuelve a pintar, que vuelve a lanzar el efecto.

Arreglo: dependencia `[]` si de verdad es "al montar". Si depende de un id, pasa el id primitivo (`[id]`), no un objeto. No hagas `setNotas` incondicional dentro de un efecto que depende de `notas`.

<a id="sintoma-key"></a>

### Aviso de `key` en una lista

Causa habitual: un `.map` que devuelve elementos sin `key`, o con `key={index}` y luego reordenas o borras.

Arreglo: `key={nota.id}` con un id estable. No uses `Math.random()` como key: cambia en cada pintado y el input pierde el foco. El aviso está en la consola y nombra el componente.

<a id="sintoma-input-controlado"></a>

### Un input no deja escribir, o React avisa de controlado y no controlado

Causa habitual: `value={titulo}` sin `onChange`, entonces React lo deja fijo en el valor inicial. O `value={nota.titulo}` cuando `titulo` a veces es `undefined` (pasa de no controlado a controlado).

Arreglo: pareja `value` y `onChange`, como en el básico. Si el dato puede faltar, usa `value={titulo ?? ""}`. Un input que el navegador maneja solo, sin estado, se escribe con `defaultValue`, no con `value`.

## Cómo comprobar

1. `npm run dev` muestra la lista, el alta y el borrado.
2. Un título con `<b>` se ve literal, no en negrita.
3. La consola no tiene el aviso de `key` ni el de máximo de actualizaciones.
4. Recargar con la API apagada muestra el párrafo de error, no una página en blanco.
5. `npm run build` termina y `npm run preview` abre esa build. Eso es lo que se despliega, no el `dev`.

## Si esto no alcanza

En react.dev: `react useState`, `react useEffect`, `react rendering lists`, `react forms`, `react you might not need an effect`.

Si el error nombra un hook, busca esa frase entre comillas junto con `react.dev`.

## Checkpoint — app de frontend (90 minutos)

Una app Vite + React + Tailwind, sin copiar el CSS a mano:

- Listar, crear y borrar notas.
- Campo controlado y botón desactivado si el texto va vacío (`disabled={titulo.trim() === ""}`).
- Tres estados visibles: cargando, error y vacío. Puedes simular el error apagando la URL a propósito.
- Se entiende a 360px: columna, botones que caben, texto que no se sale.

Hecho cuando `npm run build` genera `dist/` y, al recorrer alta y borrado, la consola queda limpia.

Los datos pueden vivir en el estado. Conectarlos a PostgreSQL es el checkpoint de más adelante, no de esta ficha. Si ya tienes la API, sustitúyelos por `fetch` y el checkpoint cuenta igual, con más motivo.
