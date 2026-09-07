# Fase 3 · barra de aceptación — Dashboard + cromo + Login

Contra qué se juzga lo que devuelva Claude Design, escrito **antes** del prompt
para que no se ajuste a lo que llegue. Nueve puntos. Los tres primeros no se
negocian: si uno falla, el retorno **no es un punto de partida** y se devuelve.

Referencia: [`fase3-contrato-dashboard-cromo.md`](fase3-contrato-dashboard-cromo.md).

---

## Bloqueantes

### 1 · No falta nada, y se comprueba por lista

Recorrido punto por punto **contra el contrato leído del volcado**, no contra la
impresión. Tienen que estar, con su literal:

- Las **once tarjetas** por su nombre, con sus **nueve porcentajes** —y sin
  porcentaje en `Total Queries` y `Clients`, que es como están hoy—.
- Los **seis contadores** de `Server`, distintos de las tarjetas.
- Las **tres listas top-N**, cada una con su `More`, y el **resumen a cinco filas**.
- Las **cuatro gráficas** con su título.
- Los **seis periodos**, literales.
- El menú **`Blocking`**: su primera entrada condicional en **las tres
  situaciones**, las **ocho duraciones** literales y **las tres confirmaciones**
  con su título, su texto, su verbo y su tono.
- Las **doce entradas** del lateral, los **seis enlaces externos**, los **dos
  botones** del cromo y la **prosa de versión**.
- El menú **`Administrator`** con sus **cinco entradas**, y **los cuatro diálogos
  que abre** con sus campos y sus pies — incluidas **las dos tablas de
  `My Profile`**, `Member Of` y `Active Sessions`, con sus columnas y sus pies.
- **Y las ramas de esos cuatro diálogos que la captura NO enseñó**, porque medí
  la de un usuario local con 2FA apagado y nada creado. Cada una es un dibujo:
  - `My Profile` — el **menú de acciones por fila de sesión** con
    **`Delete Session`** y **su `Confirm`** literal; `Display Name`
    **deshabilitado** para SSO; y `2FA Status` con sus **tres** valores, incluido
    **`SSO Managed`**.
  - `Change Password` — el cuarto campo **`OTP`**, de seis dígitos, que sólo
    aparece con 2FA activo, y su validación.
  - `Configure 2FA` — **el código QR de 200×200** en la rama apagada, y **la rama
    activa entera**: **Pie: `[Disable 2FA] [Close]`; sin QR, `Secret` ni `OTP`.**
    Una acción, destructiva, **y el descarte que pone `Dialog`** — no «un solo
    botón», que dejaría el diálogo sin salida. Son dos dibujos, no uno con el
    botón cambiado.
  - `Create API Token` — el tercer campo **`Token`** que aparece **después** de
    crear. Es la única vez que ese valor se ve.
- En Login: **dos campos**, **`Login`**, los seis enlaces, la marca y el crédito
  **`Theme:` byGarcia** — y **`Forgot Password?` como superficie**, con sus
  **cinco párrafos y su lista numerada de cinco pasos, palabra por palabra**. Son
  instrucciones de operación, no prosa: no se resumen, no se reescriben, y
  `does not exists` se queda como está porque así está en upstream.

Una sola pérdida devuelve el trabajo. **Un diseño que ha perdido un control no es
un punto de partida.**

### 2 · Las cinco invariantes, dibujadas y no prometidas

1. **Once tarjetas ↔ once series**, misma lista y mismo orden.
2. **Toda etiqueta del servidor sale rotulada**, sean tres o treinta — así que el
   dibujo tiene que **enseñar el caso de muchas**, no sólo los tres sectores de mi
   laboratorio.
3. Ninguna serie es el color de un token de texto.
4. **El vacío y el error no se parecen**, y un dato viejo no se ve como uno nuevo.
5. **Cero se dibuja `0`**, no como caja de vacío. Hoy `Refused`, `Blocked` y
   `Dropped` valen cero: tienen que salir dibujados.

### 3 · Las siete ramas no observadas, dibujadas

Esto es lo que impide que una foto poblada se convierta en el único estado
posible. Cada una con su dibujo:

| Rama | Qué tiene que enseñar |
|---|---|
| **Carga** | Tarjetas a `—` y el hueco de carga en `Queries` |
| **Error** | Tarjetas a `—` **y un aviso**. Nunca ceros |
| **Vacío real** | `No queries for this period.` y `No data for this period.`, **distinguible del error de un vistazo** |
| **Rango personalizado** | `Start`, `End`, `Show`, y los dos mensajes literales |
| **Cluster** | El selector de nodo con el agregado `Cluster`, **y la pantalla sin él**: son dos dibujos, no uno |
| **Permisos, en el cromo** | El lateral **con menos entradas**. El Dashboard no cambia por permiso; el cromo sí |
| **SSO, en el menú de cuenta** | El menú **con tres entradas**, sin `Change Password` ni `Configure 2FA` |

El **estado mixto** cuenta como una octava y va también: la pantalla con una
región vacía y siete pobladas a la vez.

---

## No bloqueantes, pero se piden y se revisan

### 4 · El estado es de la región, no de la pantalla

Que se vea que cada panel responde por lo suyo. Una región vacía **no puede**
vaciar visualmente el resto, que es justo lo que la herramienta hacía antes de
arreglarla.

### 5 · Las dos superficies del top-N, atadas y distintas

El resumen y el modal de hasta mil filas **no son el mismo objeto**: se acepta que
se vean distintos, no que se fundan. El título del modal lleva el límite dentro
—`Top 1000 Domains`—, y su pie el total. Y `Top Clients` dibuja lo que las otras
dos no tienen: **detalle** bajo el nombre y la marca de **rate limited**.

### 6 · Login es una superficie aparte, y arregla sus tres defectos

No comparte cromo. Y el retorno tiene que **nombrar** los tres defectos de hoy, no
heredarlos en silencio:

- que aparezca un **landmark principal** —hoy no hay ninguno—;
- que el título sea un **encabezado** y no un `div` de marca;
- y que `Theme: byGarcia` siga siendo lo que es, **un crédito y no un selector**.

### 7 · El cromo, con sus dos anchos y su estado activo

La entrada activa **se anuncia**, no sólo se colorea. Y el cromo tiene un botón
`Menu` que hoy existe: el dibujo estrecho no es opcional.

### 8 · Ningún número de mi laboratorio, dibujado como si fuera dato

`304`, `firmada.test`, `172.23.0.2`, `A/SOA/NS`, `Udp`: **todo eso es contexto**.
Si vuelven dibujados como si fueran el contenido, el diseño ha copiado la
instancia en vez de la pantalla. Los rótulos sí son contrato; los valores no.

### 9 · Cero funcionalidad nueva

Ni un control, ni un flujo, ni una validación, ni un texto que no esté hoy. Las
palabras, **literales**. La paridad se juzga contra **upstream**, no contra esta
consola.

---

## Cómo se resuelve un fallo

Con Claude Design, **no parcheando el código**. Un hueco es un asunto de diseño
mientras no se demuestre lo contrario, y arreglarlo aquí deja el dibujo y la
consola diciendo cosas distintas — que es exactamente lo que este contrato
existe para impedir.

## Y lo que NO se le va a exigir, dicho por justicia

- **Anchos y espaciado.** Este contrato no midió ninguno.
- **Las series de las gráficas leídas del DOM.** No se pueden: van en el prompt
  porque salen de la API, y ninguna herramienta del repositorio comprueba hoy la
  invariante 2 contra la pantalla. Se revisa a ojo contra la lista.
- **Los otros dos modales de `More`.** Sólo se abrió uno; los otros se asumen
  iguales por ser el mismo componente, y así consta.

**Y una advertencia sobre las exenciones, que ya ha fallado dos veces.** «No lo
miré» se convierte en «no existe» con una facilidad que este documento ha
demostrado: primero con el menú `Administrator` entero, y después con las ramas de
sus cuatro diálogos —el QR, el `OTP`, el `Token`, el `Delete Session`—, que se
midieron abriendo cada uno y **enseñaron sólo la rama del usuario que tenía
delante**. Una exención sólo vale si dice **qué** queda fuera; «lo demás» no es una
exención, es un agujero.

**Lo que ya NO se exime, y por qué se eximía mal.** Esta lista incluía «el
contenido del menú `Administrator`». No puede: el punto 1 dice **«no falta nada»**,
y decirlo mientras se exime un menú entero es decir «no falta nada de lo que he
mirado». Son cinco entradas, cuatro diálogos y dos tablas dentro de uno de ellos,
todo medido y ahora en el contrato. Lo mismo con `Forgot Password?`, que estaba
como rótulo de botón y es una superficie con cinco pasos numerados.
