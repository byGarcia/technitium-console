# Reconciliación — Administración

Entrega: `18-fase3-administracion.dc.html`, 2026-09-04, 284.752 bytes — la más
grande de las cinco rondas. **Una sola reconciliación**, como se acordó.

## Lo que la entrega hizo bien, y no se vuelve a tocar

- **La decisión 2, que era la única que había que RESOLVER y no sólo dibujar.**
  Cada sección pasa a ser una `<table>` de verdad —`<caption>` con el nombre,
  `th[scope=col]` en los tres verbos, `th[scope=row]` en el sujeto y
  `th[scope=rowgroup]` en *Users* y *Groups*— y cada casilla lleva **nombre propio
  en el DOM**: un `<label>` visualmente oculto con `{Sección} · {Sujeto} · {Verbo}`.
  Deja de ser un nombre que sintetiza el lector por posición y pasa a ser uno
  escrito. Es exactamente lo que se pedía.
- **La matriz se parte en tres piezas que no compiten**: un mapa de concesiones con
  los sujetos en filas y las once secciones en columnas —el instrumento de
  comparación, y cabe en una pantalla—, el índice de once del piloto 3 al lado, y
  las once secciones debajo enteras. El muro sigue estando pero deja de ser el
  único camino.
- **`Force` como bloque de consecuencia**, no como fila de formulario, con las dos
  frases enfrentadas y el bloque armándose en `--dan` al marcarlo. Y el verbo del
  pie **no cambia de rótulo**, porque upstream no lo cambia.
- **Las 24 superficies enumeradas una a una** con su ancho, y el cuadre dicho:
  22 títulos, 25 instancias, «dibujar 22 pierde dos; dibujar 25 duplica una».
- **Sólo dos añadidos de primitiva, los dos justificados contra las 28**: `Matrix`
  —ninguna de las existentes da dos ejes en sólo lectura con nombre por celda— y
  `Confirm.force` como **ranura**, no como primitiva nueva.
- **Ningún candado**, y el hueco no queda en blanco: barra de sólo lectura con la
  frase del contrato y el `Notifier` en su caso de rechazo, que es donde el usuario
  se entera.
- **`ClusterNodeSelect` sólo en Sessions y Cluster**, y en SSO ni el control ni su
  hueco.

## Lo que la entrega me corrigió a MÍ

**Las 31 columnas no existían.** Al intentar reproducir la cifra, su inventario dio
**30** y en vez de cuadrarlo dijo que ninguna partición honrada da 31. Tenía razón:
mi número sumaba las cuatro colecciones más las dos tablas anidadas de SSO y dejaba
fuera `Permissions` y `UserDetails` — incluía unas tablas anidadas y otras no.

Contadas todas con `dev/censo-tablas.mjs`, son **41**. Corregido en el contrato, en
la barra y en el encargo, y la cifra ya no se escribe: la produce el censo.

## Lo que hay que corregir

### B1 · Las ayudas están reescritas — y es culpa del contrato

La entrega dibuja ayuda bajo cada campo de SSO y la marca como copiada del fuente,
pero **la redactó**:

| Dibujado | El literal del producto |
|---|---|
| «Turns on OpenID Connect sign-in for this server.» | «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).» |
| «The OpenID Connect issuer URL of the identity provider.» | «The OpenID Connect (OIDC) Authority URL.» |
| «The client identifier registered with the identity provider.» | «The OpenID Connect (OIDC) Client ID.» |

**Y el motivo es mío: el contrato se envió sin una sola de las 25 ayudas de la
sección** —17 en `Cluster`, 8 en `SSO`—. La regla del proyecto es que no se deja
caer una ayuda, y el contrato es lo único que quien dibuja tiene; sin ellas, lo
único que podía hacer era inventarlas.

**Qué tiene que volver:** las ayudas con su literal, en SSO y en los diálogos de
`Cluster`. El contrato ya las lleva las 25, generadas del fuente.

**Y hay un premio dentro:** las cuatro ayudas de las casillas `Force` **ya dicen lo
que la entrega redactó a mano** —«without asking the node to leave gracefully»,
«without resyncing complete configuration from it», «without informing the Primary
node», «orphaning them»—. Las dos frases enfrentadas del bloque de consecuencia no
hay que escribirlas: están en el producto. *(La segunda dice «and without inform
it», con esa concordancia: es literal de upstream y no se corrige.)*

### B2 · Comprobar que las 17 ayudas de `Cluster` están dibujadas

No se ha verificado que aparezcan en los diálogos —el contrato no las llevaba, así
que probablemente no—. Con el contrato corregido, tienen que estar en
`Initialize New Cluster`, `Join Cluster`, `Edit Node` (las dos), y en los cuatro
diálogos con `Force`.

## Lo que esta reconciliación NO pide

- No se toca ninguna de las seis decisiones: las seis están bien resueltas.
- No se rediscuten `Matrix` ni `Confirm.force`: los dos añadidos están justificados
  y son los mínimos.
- No se pide reproducir el «31»: era mío y estaba mal.
