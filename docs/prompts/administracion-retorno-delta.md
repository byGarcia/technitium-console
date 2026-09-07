<!-- delta: aporta -->
# Administración — retorno: cinco correcciones, y NINGÚN rediseño

Recorrido `18-fase3-administracion.dc.html` contra el contrato y la barra.

**La entrega está bien y no hay que rehacer nada.** Las seis decisiones están
resueltas —incluida la única que había que RESOLVER y no sólo dibujar—, los dos
añadidos de primitiva están justificados y son los mínimos, y las 24 superficies
están enumeradas una a una con su ancho.

**Lo que falla es el contrato que te mandé**, no el dibujo. Cuatro de las cinco
correcciones son huecos míos que te obligaron a inventar; la quinta es una cifra
mía que tú ya desmentiste.

---

## Lo que NO se toca — y aquí va largo a propósito

Este delta **no reabre ninguna decisión aceptada**. Queda intocable:

- **Las seis decisiones, enteras.** Ninguna se rediscute.
- **La matriz partida en tres piezas**: el mapa de concesiones con los sujetos en
  filas y las once secciones en columnas, el índice de once al lado, y las once
  secciones debajo enteras y nunca plegadas. Y su reparto a dos columnas en 1440.
- **Cómo se llama una celda**: la `<table>` con `<caption>`, `th[scope=col]`,
  `th[scope=row]` y `th[scope=rowgroup]`, y el `<label>` oculto
  `{Sección} · {Sujeto} · {Verbo}`. Es exactamente lo que se pedía.
- **`Matrix` como primitiva nueva** y **`Confirm.force` como ranura**, con sus dos
  justificaciones. No se piden más y no se quita ninguno.
- **El bloque de consecuencia de `Force`**: su sitio al final del cuerpo, las dos
  frases enfrentadas, el armado en `--dan` al marcarlo, y que **el verbo del pie no
  cambie de rótulo**. Sólo cambian las PALABRAS de las dos frases (punto 4).
- **Las tres ramas de Cluster** con sus cabeceras distintas y la pastilla de papel
  junto al `h1`.
- **La regla de `Edit Node`** y el fondo de fila propia que la hace visible.
- **Que no haya candado**, la barra de sólo lectura y el `Notifier` en su caso de
  rechazo.
- **Las 24 superficies**, sus anchos y el cuadre de 22/24/25.
- **`ClusterNodeSelect` sólo en Sessions y Cluster**, y en SSO ni el control ni su
  hueco.

Y una cosa que hiciste mejor de lo pedido y **conviene que se quede**: no cuadrar
el 31 a la fuerza y decir que ninguna partición honrada lo da. Tenías razón.

---

## 1 · El 31 era mío y estaba mal: son 41

Tu inventario dio 30 y dijiste que no salía. No salía porque **mi cifra no contaba
nada coherente**: sumaba las cuatro colecciones más las dos tablas anidadas de SSO
y dejaba fuera `Permissions` y `UserDetails`. Incluía unas anidadas y otras no.

Contadas **todas** las tablas de la sección con `dev/censo-tablas.mjs`:

| Fichero | Columnas |
|---|---|
| `Cluster.tsx` | 9 |
| `Users.tsx` | 8 |
| `Sessions.tsx` | 6 |
| `Permissions.tsx` | 5 |
| `Sso.tsx` | 5 |
| `UserDetails.tsx` | 5 |
| `Groups.tsx` | 3 |
| **total** | **41** |

Entran **las anidadas también** —las de SSO, `Member Of`, las sesiones de
`User Details` y `Members` de `Group Details`— y **la columna sin rótulo**, la de
acciones, porque es estructura: contar sólo las que llevan texto fue lo que en
Zones hizo perder de vista dos columnas de diez.

**Qué tiene que volver:** el 41 en el recuento, con esa partición. Ningún dibujo
cambia — las columnas ya estaban todas.

---

## 2 · Las 27 ayudas, que el contrato no llevaba

Es el hueco grave, y es mío: **el contrato se envió sin una sola**. La regla del
proyecto es que no se deja caer una ayuda, y el contrato es lo único que tienes;
sin ellas, lo único que podías hacer era escribirlas.

Son **27**: **20 en `Cluster`** y **7 en `SSO`**. Van enteras **más abajo, en este mismo
mensaje** — no en un anexo aparte: tú no tienes el repositorio, así que una
referencia a un fichero es un agujero.

**Cuatro de las de Cluster no se ven con un `grep help=`**: viajan dentro de un
array de tuplas y se pasan en un `map`. Son las de `Cluster Options`, y con ellas
aparecen **cuatro campos que este contrato tampoco tenía** —`Heartbeat Refresh
Interval`, `Heartbeat Retry Interval`, `Config Refresh Interval`,
`Config Retry Interval`—, cada uno con su ayuda y su sufijo.

### Este delta añade contenido a DOS dibujos, y sólo a dos

Todo lo demás es sustituir texto. Estas dos sí meten algo que no estaba:

1. **`Cluster Options`** pasa a tener **cinco campos**: `Cluster Domain`
   —deshabilitado y de sólo lectura— y los cuatro intervalos, cada uno con su
   ayuda y su sufijo. Y el botón `Save` **sólo existe en el primario**.
2. **`User Details`** gana **el sufijo de `Session Timeout`** —«seconds (valid
   range 0-604800; default 1800; set 0 to disable)»—, que faltaba porque está
   escrito como texto JSX y no como cadena: ningún censo por `suffix=` lo veía. El
   campo ya estaba; lo que no estaba es lo que dice qué se puede escribir en él.

---

## 3 · Las ayudas dibujadas están reescritas — sin parafrasear

Bajo los campos de SSO dibujaste ayuda y la marcaste como copiada del fuente, pero
está redactada:

| Dibujado | El literal del producto |
|---|---|
| «Turns on OpenID Connect sign-in for this server.» | «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).» |
| «The OpenID Connect issuer URL of the identity provider.» | «The OpenID Connect (OIDC) Authority URL.» |
| «The client identifier registered with the identity provider.» | «The OpenID Connect (OIDC) Client ID.» |

**Qué tiene que volver:** las de abajo, **carácter a carácter**. No se mejoran, no se
acortan y no se uniforman aunque suenen repetitivas.


---

## 4 · Las cuatro frases de `Force` ya existen: no las escribas

El bloque de consecuencia está bien resuelto y **no se toca**. Lo único que cambia
son las palabras: las escribiste a mano y **el producto ya las tiene**.

- «Enabling this option will cause the Secondary node to be deleted from the Cluster without asking the node to leave gracefully.»
- «Enabling this option will cause the current Primary node to be deleted from the Cluster without resyncing complete configuration from it and without inform it.»
- «Enabling this option will cause this Secondary node to leave the Cluster without informing the Primary node.»
- «Enabling this option will cause this Primary node to delete the Cluster for itself even when other Secondary nodes still exist, orphaning them.»

Dicen exactamente lo que la casilla cambia. **Una dice «and without inform it»**,
con esa concordancia: es literal de upstream y **no se corrige**.

---

## 5 · Y diez literales más que tampoco se parafrasean

No son ayuda —son validaciones, avisos de éxito y cuerpos de alerta—, y por eso van
aparte en el contrato: contarlas como ayudas habría sido otra cifra que miente.
Pero se copian igual, y van **abajo, enteras**.

---

# Anexo — las 27 ayudas, los cinco sufijos y las diez literales

Va aquí dentro y no como referencia **porque quien lee esto no tiene el fuente**.
Es el mismo error que este delta viene a corregir: si no viaja, no vuelve.

## `Cluster` — 20 ayudas

- «The fully qualified domain name to be used to identify the new Cluster.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Servers to be added later as Secondary nodes. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Server nodes in the Cluster. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The Web Service HTTPS URL of the Primary node in the Cluster.»
- «The IP address of the Primary node in the Cluster. When unspecified, domain name in the Primary node URL will be resolved and used.»
- «The username of an administrator on the Primary node in the Cluster.»
- «The password of the administrator user specified above.»
- «Enter the 6-digit code you see in your authenticator app for the administrator user specified above.»
- «The fully qualified domain name of the Cluster.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Server nodes in the Cluster. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The Web Service HTTPS URL of the Primary node in the Cluster.»
- «The IP addresses of the Primary node in the Cluster. When unspecified, domain name in the Primary node URL will be resolved and used.»
- «Enabling this option will cause the Secondary node to be deleted from the Cluster without asking the node to leave gracefully.»
- «Enabling this option will cause the current Primary node to be deleted from the Cluster without resyncing complete configuration from it and without inform it.»
- «Enabling this option will cause this Secondary node to leave the Cluster without informing the Primary node.»
- «Enabling this option will cause this Primary node to delete the Cluster for itself even when other Secondary nodes still exist, orphaning them.»
- «The interval in seconds in which the DNS Server must refresh the state of all nodes in the Cluster.»
- «The interval in seconds in which the DNS Server must retry the state refresh process for all nodes in case of a failure.»
- «The interval in seconds in which the DNS Server must refresh the configuration from the Primary node.»
- «The interval in seconds in which the DNS Server must retry the configuration refresh process for the Primary node in case of a failure.»

**Las cuatro que empiezan por «Enabling this option» son las de las casillas
`Force`** (punto 4). **Una dice «and without inform it»**, con esa concordancia:
es literal de upstream y no se corrige.

## `SSO` — 7 ayudas

- «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).»
- «The OpenID Connect (OIDC) Authority URL.»
- «The OpenID Connect (OIDC) Client ID.»
- «The OpenID Connect (OIDC) Client Secret.»
- «The OpenID Connect (OIDC) metadata discovery URL to be used instead of the default one. Configure this option only if the Single Sign-On (SSO) provider uses a different discovery URL.»
- «Enable to allow automatically provisioning of user accounts for new users signing in via Single Sign-On (SSO). Keep this option disabled if you do not expect new SSO users to sign up.»
- «Enable to allow a new user to sign up via Single Sign-On (SSO) only when the user is a member of at least one Remote Group that is mapped to a Local Group in the Group Map option below. This option allows SSO administrators to restrict SSO users to control who can sign up and get access based on their group memberships.» — la de `Allow Sign Up Only For Mapped Users`. En el
  producto, **`Group Map` va en negrita**: es el único trozo con marcado de las 27,
  y por eso aquí el texto va plano — poner los asteriscos cambiaría los caracteres.

## Los cinco sufijos (punto 2)

| Campo | Dónde | Sufijo |
|---|---|---|
| `Heartbeat Refresh Interval` | `Cluster Options` | «seconds (valid range 10-300; default 30)» |
| `Heartbeat Retry Interval` | `Cluster Options` | «seconds (valid range 10-300; default 10)» |
| `Config Refresh Interval` | `Cluster Options` | «seconds (valid range 30-3600; default 900)» |
| `Config Retry Interval` | `Cluster Options` | «seconds (valid range 30-3600; default 60)» |
| `Session Timeout` | `User Details` | «seconds (valid range 0-604800; default 1800; set 0 to disable)» |

**El quinto no estaba en el contrato**: está escrito como texto JSX y no como
cadena, así que ningún censo por `suffix=` lo veía. Va aquí porque un sufijo dice
el rango válido y el valor por defecto — perderlo es perder la única indicación de
qué se puede escribir en ese campo.

El quinto campo del diálogo es `Cluster Domain`, **deshabilitado y de sólo
lectura**. Y el botón `Save` **sólo existe en el primario**.

## Las diez literales que no son ayuda (punto 5)

Validaciones, avisos de éxito y cuerpos de alerta. Tampoco se parafrasean.

- «A full config resync was triggered successfully. Please check the Logs for confirmation.» — `Cluster.tsx`
- «The selected node was successfully promoted to Primary node in the Cluster.» — `Cluster.tsx`
- «Please enter the Primary node admin user's OTP.» — `Cluster.tsx`
- «The Primary node Web Service TLS certificate will be validated using PKI and DANE to ensure that your connection is secure.» — `Cluster.tsx`
- «Use this options only when you know that the Primary node Web Service is using a self-signed TLS certificate and is reachable on a private network.» — `Cluster.tsx`
- «Please enter a value for Heartbeat Refresh Interval.» — `Cluster.tsx`
- «Please enter a value for Heartbeat Retry Interval.» — `Cluster.tsx`
- «Please enter a value for Config Refresh Interval.» — `Cluster.tsx`
- «Please enter a value for Config Retry Interval.» — `Cluster.tsx`
- «Single Sign-On (SSO) config was saved successfully.» — `Sso.tsx`

---

## Qué se entrega

Sólo lo que tocan estos cinco puntos:

- **El recuento a 41**, con la partición del punto 1. Ningún dibujo cambia.
- **Las 27 ayudas con su literal**, sustituyendo las redactadas.
- **Las cuatro frases de `Force`** sustituidas por las del producto.
- **Las diez literales** que no son ayuda, igual.
- Y las **dos únicas adiciones**: **`Cluster Options` completo** con sus cinco
  campos, sus cuatro ayudas y sus cuatro sufijos; y **el sufijo de
  `Session Timeout`** en `User Details`.

**Los cinco sufijos van enteros** —cuatro en `Cluster Options` y uno en
`User Details`—. Ningún dibujo se rehace y ninguna decisión se reabre.
