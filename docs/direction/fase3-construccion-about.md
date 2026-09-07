# Construcción — About

Fase 3, superficie 12 y última. El plan decía **«va directa salvo que su contrato
destape un delta real»**. Lo destapó.

## Lo que la propia pantalla necesitaba: nada

About es referencia y ya estaba bien: sus **nueve destinos de upstream** están
—se restauraron el 2026-09-03, cuando de los nueve sólo sobrevivía GitHub—, la
prosa es literal, el logo es el de Technitium y los cuatro anchos no desbordan.
`dev/check-parity-controls.mjs` en verde: 28 destinos, 112 ayudas, 94 ejemplos.

## El delta: el flujo de actualización nunca se contrató

La ronda del cromo contrató **el cromo**, no este diálogo, y
`check-parity-controls.mjs` no lo ve porque sus enlaces son `href="#"` que
`main.js` rellena en tiempo de ejecución. Recorrido punto por punto contra
`main.js:702-800` y `index.html:72-73, 141, 3892`, salieron **seis cosas**: tres
literales que faltaban, dos controles y un añadido.

### Lo que faltaba y era literal — restaurado sin preguntar

| | |
|---|---|
| `Read Change Logs` | Decía `Change Log`. Literal reescrita |
| `Current Version:` · `Update Version:` | El salto se dibuja `15.4 → 16.0`, y **la flecha dice cuál es cuál al ojo y a nadie más**. Vuelven los dos nombres de upstream, ocultos, así que la comparación conserva la forma que decidió la ronda del cromo |
| Los dos `Note!` del modal | «It is highly recommended to Backup Settings before installing the update.» y «You will have to refresh this web page manually after updating…». **No estaban en ninguna parte de la consola**. No son decoración: son la diferencia entre una actualización que va bien y otra que te deja mirando una consola que ya no es la que corre |

### Lo que era decisión de producto — consultado, y decidido

**1 · El par `Disable / Enable Update Notification`. Se restaura.**

Upstream lo tiene en el menú de cuenta. Aquí la preferencia se **leía**
—`checkForUpdate` no llamaba al endpoint si estaba puesta— y **nada podía
escribirla**, así que esa rama de nuestro propio código era inalcanzable y el
usuario no tenía forma de dejar de recibir el aviso. Vuelve con su confirmación y
sus dos avisos de éxito, todos literales de upstream.

Y con un detalle de comportamiento replicado tal cual: **una vez silenciado en una
sesión, el aviso no vuelve aunque lo reactives** — `disableUpdateNotification`
esconde el enlace y `enableUpdateNotification` no lo enseña otra vez. Se recupera
entrando de nuevo. Es la misma clase de fidelidad que la comparación por subcadena
de `Quick Add`.

**2 · El panel `Update` de About. Se retira.**

Tenía un botón `Check for Update` y cuatro frases —«No update available. You are
running the latest version.», «Update notifications are turned off for this
server.», «Unable to check for updates.» y el rótulo del propio botón— y **ninguna
de las cuatro existe en upstream**: ni en su `index.html` ni en su `main.js`,
comprobado contra la instancia `ref`.

Upstream comprueba **una vez, al entrar**, y lo dice en el cromo, visible desde las
doce pantallas. Esta consola hace lo mismo en `app/Versions`, donde el aviso va
montado sobre la versión de la que habla. Una segunda comprobación forzada en la
única pantalla que nadie visita duplicaba ese aviso con cuatro literales que el
producto no dice.

Se queda el panel `Server`: versión y arranque son datos que el propio About de
upstream enseña bajo su título.

## Consecuencia que conviene ver

**About ya no pide nada al servidor.** Todo lo que dibuja viene de la sesión que el
cromo ya tiene, así que la pantalla **no tiene estado de carga ni de fallo**: su
única variación es si esa sesión traía `info`, y eso se dice —`—`— en vez de
fingirse. Por eso su matriz del paso 6 tiene dos columnas y no cuatro, y se dice en
vez de rellenarlas con casillas que no existen.

## Validación

| | con `info` | sin `info` |
|---|---|---|
| **1440** | ✔ | ✔ (prueba) |
| **1024** | ✔ | ✔ (prueba) |
| **768** | ✔ | ✔ (prueba) |
| **390** | ✔ | ✔ (prueba) |

Ningún ancho desborda. 14 enlaces y **cero botones** en los cuatro: el inventado ya
no está.

**Uniformidad**: catorce familias idénticas al barrido de Administración y una que
**baja** — `aviso-info` de 2 a 1. La que desaparece es la del panel retirado, el
único aviso de la consola que vivía en la columna de 300 px y al que la base de la
fase 2 tuvo que dedicar un párrafo para aceptarlo como no-deriva. **Una familia que
baja no se celebra sola**: baja porque se ha quitado algo, y lo quitado eran cuatro
literales que upstream no dice.

**Portón**: typecheck, lint, build y 1.090 pruebas, los cuatro por código de salida
0. Paridad con upstream en verde.

## Lo que deja la última superficie

La misma lección que Administración, por el otro lado. Allí el paso de construir
cazó **seis cosas dibujadas que no debían construirse**; aquí ha cazado **seis que
llevaban meses construidas y nadie había contratado**. En los dos casos porque
alguien recorrió el contrato contra el fuente de upstream, línea a línea, en el
último momento en que se puede.

Y una regla de método que faltaba escribir: **una herramienta verde no es un
contrato**. `check-parity-controls.mjs` decía «los 28 destinos están» y era cierto,
porque los tres enlaces de este modal no son destinos en el HTML: son `href="#"`
que el JavaScript rellena. Lo que una herramienta no puede ver hay que ir a verlo.
