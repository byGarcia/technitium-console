# Piloto 3 — relevo para la sesión que lo reconcilie

`15-piloto-settings.dc.html` llegó el **2026-09-02**. 149 301 bytes, 1 455 líneas,
etag **`1788358640023496`**. **Comprobar el etag antes de leer nada**: ha valido
las tres veces del piloto 2.

## Contra qué se recorre

- `piloto-3-contrato-general.md` — el contrato, generado, y **viaja entero dentro
  del prompt**.
- `piloto-3-barra-aceptacion.md` — los ocho puntos, escritos **antes** de enviar.
- El prompt tal como se envió: `docs/prompts/piloto-3-general-ready.md`.

`14-piloto-zones.dc.html` sigue en su etag `1788353202632538`: el piloto 2
aceptado no se ha tocado.

## Lo que YA está recorrido, y no hay que repetir

**Las tres tablas de reglas del final (líneas ~1378-1455), enteras.** Responden a
los ocho puntos de la barra. Lo esencial, para no releerlas:

- **Ayuda**: tercera columna a 360 px, siempre visible, **nunca plegada ni
  resumida**; a 1180 baja a segunda línea, a 560 bajo su control. Ningún ancho la
  esconde. — punto 2.
- **`Note!` contra `Warning!`**: tres diferencias, y la primera es la buena —
  **el `Warning!` va antes de los controles y el `Note!` después**, «uno puede
  cambiar tu decisión, el otro la explica». Avisos a ancho de sección, fuera de
  la columna de ayuda. — punto 4.
- **Los dos grises**: maestro = **local y reversible** (filete ámbar, opacidad,
  una pastilla que nombra el interruptor); permiso = **global e irreversible**
  (un aviso arriba y candado, valores legibles y ayuda sin atenuar, «leer no
  requiere permiso»). Si coinciden gana el permiso. **«Ámbar = puedes; candado =
  no puedes.»** — punto 5, y es la mejor respuesta del piloto.
- **Barra**: pegajosa abajo, cuatro botones **siempre presentes**; las ocho
  combinaciones dan **una barra con hasta cuatro apagados**, no ocho barras. Y el
  alcance de `Save Settings` **se dice en la barra**. — punto 6.
- **Subpestañas**: salen del lateral y viven sobre el título a todos los anchos.
  **Validación**: el aviso nace en la barra, dice subpestaña y campo, y al seguirlo
  el error se pinta junto a su campo, nunca en los dos sitios. — punto 7.
- **390**: las tres columnas se apilan; «no se pierde ni un párrafo ni un
  sufijo». — punto 8.
- **12 textos propuestos**, todos con su porqué, y uno especialmente honesto: el
  rótulo del botón de añadir de las listas QPM **no consta en el contrato**, así
  que dibuja el verbo desnudo y dice que si el fuente dice otra cosa, gana el
  fuente.
- **Seis cosas declaradas abiertas** por el propio piloto, y una es de las que
  valen: la columna de ayuda de 360 px **está medida contra los 41 párrafos de
  `General` y no contra los de DHCP**, que hereda el mismo kit.

## Un defecto del CONTRATO que encontró el piloto, y tenía razón

El piloto declara abierto «cuatro rótulos de grupo» porque **el contrato dice que
hay seis `GroupRow` y sólo nombra dos**. Comprobado contra el fuente: es cierto y
el fallo es del contrato. Los seis son

`Zone Defaults` · `Software Update` · `IPv6 Support` · `UDP Socket Pool` ·
`DNSSEC` · `EDNS Client Subnet (ECS)`

y `evidencia/general-dom.json` sólo llevaba dos, porque el extractor emitía el
nombre del control y para un control dentro de un grupo ganaba el del control —
aunque `GroupRow` pinta su rótulo **con la misma clase** (`rowLabel`) que el
extractor ya miraba.

**Y al nombrarlos aparece una pregunta de diseño que el piloto no pudo hacerse**
(`General.tsx`, orden de fuente): **cinco de los seis repiten el título de su
sección** — `Software Update` bajo la sección `Software Update`, `DNSSEC` bajo
`DNSSEC`, `UDP Socket Pool` bajo `UDP Socket Pool`, `IPv6 Support` bajo `IPv6`,
`EDNS Client Subnet (ECS)` bajo `EDNS Client Subnet`. **Sólo `Zone Defaults`
aporta algo que su sección no dice**, y es el único que el contrato perdió del
todo.

Es la misma clase de error que ya se corrigió una vez hoy con los sufijos: **una
cifra sin su inventario**. Hay que arreglar el extractor, regenerar evidencia y
contrato, y decidir si esa repetición se dibuja dos veces o una.

## Una frase del piloto que es imprecisa, no falsa

Dice que las subpestañas «hoy sólo existen ahí por debajo de 1180 px». Comprobado
en el fuente: hoy viven en el lateral (`app/Shell.tsx:220`, visibles sólo con su
sección activa, sin desplegable). Lo que sí es cierto y es el buen argumento:
**el raíl de 60 px del piloto 1 esconde las etiquetas por debajo de 1180**, así
que ahí las nueve se quedarían sin sitio. Sacarlas del lateral **arregla algo que
el piloto 1 rompía**; conviene decírselo así.

## Lo que FALTA por recorrer

**El censo nombre a nombre de los dibujos.** El piloto afirma en su cierre que
`2a` y `3a` traen los 39 controles, las 41 ayudas, los 19 sufijos, los 12 avisos,
las 10 secciones, las 2 listas, las 9 subpestañas y los 4 botones, todo literal.
**Eso no está comprobado**, y es justo lo que no puede darse por bueno de palabra:
es el punto 1 de la barra y la única cosa que la regla de cero funcionalidad no
permite perder.

Comprobado sólo el arranque de `1b`, donde las ayudas salen **literales y
enteras**.

## Cómo hacer ese censo sin leer 1 100 líneas

El navegador quedó **bloqueado** por una sesión previa de Playwright («Browser is
already in use», perfil `mcp-chrome-91fe29b`, proceso vivo). El proceso no se mató
a propósito. Con el navegador libre, la vía barata es abrir el fichero del piloto
y contar en el DOM, igual que se hizo con el panel real; si no, leerlo por tramos.

## Las trampas de esta pantalla

Están escritas en `piloto-3-barra-aceptacion.md` y siguen valiendo. La que más:
**resumir un texto no es rediseñarlo, es perderlo** — aquí la superficie es el
texto, no los campos.
