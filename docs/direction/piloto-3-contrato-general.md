# Piloto 3 — el contrato de `Settings › General`

Generado por `dev/pane-contract-doc.mjs` el **2026-09-02**, de dos fuentes y no de una:
el **censo** lo da `static-contract.mjs` leyendo el fuente con el parser de TypeScript, y
la **atadura** —qué ayuda cuelga de qué control, en qué sección, con qué sufijo y qué lo
apaga— la da `evidencia/general-dom.json`, verificado contra el DOM vivo **elemento a
elemento** con SHA-256 por cadena.

> Un contrato tomado sólo de la pantalla no ve lo que el harness no puede dibujar; uno tomado
> sólo del fuente no sabe qué va con qué. El piloto 2 pagó la primera mitad de esa lección.

## Las tres poblaciones, que no son una suma

El AST cuenta 47 y el DOM 54, y **no hay una coincidencia que celebrar**: hay tres cosas de
naturaleza distinta, y sólo la primera es lo que el diseño no puede perder.

| Población | Cuántos | Qué es |
|---|---|---|
| **Controles comparables** | **39** | En el fuente y en la pantalla. **Lo innegociable.** |
| Etiquetas estructurales | 8 | Sólo en el AST, y **nombradas una a una más abajo**: 6 `GroupRow` y 2 `EditableList`. La pantalla las pinta como encabezado o como rótulo de lista, nunca como control |
| Celdas de filas de datos | 15 | Sólo en el DOM: las celdas de las dos listas QPM. Son **dato del servidor** — con otra configuración son otro número |

## El cromo del panel

- **Título:** `General`. Migas: `Settings`.
- **Nueve subpestañas**, y `General` es una de ellas: `General` · `Web Service` · `Optional Protocols` · `TSIG` · `Recursion` · `Cache` · `Blocking` · `Proxy & Forwarders` · `Logging`.
  La activa se marca con `aria-current=page` y es un enlace real
  (`/settings/general/`), no una pestaña de JavaScript: cada panel tiene su URL.
- **Barra pegajosa** (`position: sticky`) con **4 botones**:
  `Save Settings` · `Flush Cache` · `Backup Settings` · `Restore Settings`.

  **La barra no es de este panel: es de los nueve**, y eso cambia lo que significa cada botón.
  Tres cosas de `Settings.tsx:38-53`, las tres verificadas en el fuente y ninguna deducible del
  dibujo:

  1. **`Save Settings` envía SIEMPRE los campos de los nueve paneles**, se esté donde se esté.
     No hay nueve formularios: hay uno con nueve pestañas. Trocearlo por pestaña cambiaría qué
     se guarda.
  2. **Los tres permisos de la barra son distintos**: guardar pide `Settings.canModify`, vaciar
     la caché `Cache.canDelete`, y copia y restauración `Settings.canDelete`. Los botones
     aparecen o no según eso. Son **tres puertas independientes** —copia y restauración
     comparten una— y por tanto hasta **ocho combinaciones de visibilidad**, no cuatro.
  3. **Un fallo de validación puede estar en otra subpestaña.** Upstream enfoca el campo aunque
     su pestaña esté oculta y el usuario no ve nada; aquí el aviso dice qué falta y **la
     pantalla salta a la subpestaña de ese campo**. Está resuelto en el código: el piloto no
     tiene que inventarlo, y no puede perderlo.

  Y **`Flush Cache` pregunta antes de actuar**, con un `Confirm` cuyo contrato entero es su
  frase — el mismo patrón que el piloto 2 cerró:

  > Are you sure to flush the DNS Server cache?

  Título `Flush Cache`, verbo `Flush`, **no destructivo** (`variant="primary"`).
  `Settings.tsx:375`. Es la única confirmación alcanzable desde este panel; las otras dos de la
  pantalla —`Temporary Disable Blocking` y `Update Block Lists`— viven en el panel `Blocking`.

## Los interruptores maestros y lo que apagan

`General` **no tiene ni un condicional de render**: nada aparece y desaparece. Lo que tiene son
**dos interruptores** y **5 controles que se deshabilitan** con ellos. Comprobado abriendo los dos
estados en el harness, no leído de una captura: encendidos los dos, no queda ni un control gris.

- **`Enable UDP Socket Pool`** apaga `UDP Socket Pool Excluded Ports`
- **`Enable EDNS Client Subnet`** apaga `ECS IPv4 Prefix Length` · `ECS IPv6 Prefix Length` · `ECS IPv4 Override` · `ECS IPv6 Override`

Un campo gris porque su maestro está apagado y uno gris porque no hay permiso **se ven igual y no
son lo mismo**. Es una de las cosas que este piloto tiene que resolver.

## Las 8 etiquetas estructurales, nombradas

Se enumeran porque **un recuento sin inventario no es un contrato**: el piloto 3 declaró abierto
«cuatro rótulos de grupo» precisamente porque la primera versión decía seis y nombraba dos.

| Rótulo | Tipo | Dónde |
|---|---|---|
| `Zone Defaults` | `GroupRow` | sección **Default Parameters** |
| `Software Update` | `GroupRow` | sección **Software Update** |
| `IPv6 Support` | `GroupRow` | sección **IPv6** |
| `UDP Socket Pool` | `GroupRow` | sección **UDP Socket Pool** |
| `DNSSEC` | `GroupRow` | sección **DNSSEC** |
| `EDNS Client Subnet (ECS)` | `GroupRow` | sección **EDNS Client Subnet** |
| `Queries Per Minute (QPM) Limits (IPv4)` | `EditableList` | sección **Rate Limiting** |
| `Queries Per Minute (QPM) Limits (IPv6)` | `EditableList` | sección **Rate Limiting** |

**Y aquí hay una decisión que tomar, que el contrato anterior escondía**: cinco de los seis
`GroupRow` **repiten el título de su sección** —`Software Update` bajo la sección `Software
Update`, `DNSSEC` bajo `DNSSEC`, `UDP Socket Pool` bajo `UDP Socket Pool`, `IPv6 Support` bajo
`IPv6`, `EDNS Client Subnet (ECS)` bajo `EDNS Client Subnet`—. Hoy la pantalla los pinta los dos,
uno debajo del otro. **Sólo `Zone Defaults` dice algo que su sección no dice.** Si esa repetición
se dibuja dos veces, una, o la sección se queda con el rótulo del grupo, es decisión de diseño.

## Los 19 sufijos en línea

Van pegados al control, en la misma línea, y **no son decoración**: la mayoría es el único sitio
de la pantalla donde se lee el rango admitido y el valor por defecto. Un dibujo que los pierda
convierte un campo con reglas en una caja vacía.

| Control | Sufijo, literal |
|---|---|
| `Default Record TTL` | `seconds (default 3600/1h)` |
| `Default NS Record TTL` | `seconds (default 14400/4h)` |
| `Default SOA Record TTL` | `seconds (default 900/15m)` |
| `Minimum SOA Refresh` | `seconds (default 300/5m)` |
| `Minimum SOA Retry` | `seconds (default 300/5m)` |
| `EDNS UDP Payload Size` | `bytes (valid range 512-4096; default 1232)` |
| `ECS IPv4 Prefix Length` | `(valid range 0-32; default 24)` |
| `ECS IPv6 Prefix Length` | `(valid range 0-64; default 56)` |
| `QPM Sample Size` | `minutes (valid range 1-60; default 5)` |
| `QPM Limit UDP Truncation` | `% (valid range 0-100; default 50)` |
| `Client Timeout` | `milliseconds (valid range 1000-10000; default 2000)` |
| `TCP Send Timeout` | `milliseconds (valid range 1000-90000; default 10000)` |
| `TCP Receive Timeout` | `milliseconds (valid range 1000-90000; default 10000)` |
| `QUIC Idle Timeout` | `milliseconds (valid range 1000-90000; default 60000)` |
| `QUIC Max Inbound Streams` | `(valid range 1-1000; default 100)` |
| `Listen Backlog` | `(default 100)` |
| `UDP Send Buffer Size` | `KB (valid range 8-65536; default 2048)` |
| `UDP Receive Buffer Size` | `KB (valid range 8-65536; default 2048)` |
| `Max Concurrent Resolutions` | `per CPU core (default 100)` |

## Las 10 secciones, con todo lo que llevan dentro

Cada control con **su** ayuda, no cerca de ella. Los textos van literales y enteros: es un
formulario denso, y aquí la ayuda **es** la superficie — resumirla es perderla.

### Local Parameters

- **`DNS Server Domain`** — _text_
  > The primary fully qualified domain name used by this DNS Server to identify itself.
- **`DNS Server Local End Points`** — _textarea_
  > Local End Points are the network interface IP addresses and ports you want the DNS Server to listen for requests. To explicitly bind the UDP sockets to interface device on Linux, specify the interface name as shown in these examples: 192.168.1.10%eth0:53 or [2001:db8::1%eth1]:53. For VRF, the interface name can be the VRF name.
- **`DNS Server IPv4 Source Addresses`** — _textarea_
  > The IPv4 source addresses that the DNS Server must use for making all outbound DNS requests when the server is connected to two or more networks. Network addresses are also accepted.
- **`DNS Server IPv6 Source Addresses`** — _textarea_
  > The IPv6 source addresses that the DNS Server must use for making all outbound DNS requests when the server is connected to two or more networks. Network addresses are also accepted. Note that this option will be used only when Prefer IPv6 option is enabled.

**Avisos de esta sección (2), literales:**

> Note! The DNS Server local end point changes will be automatically applied and so you do not need to manually restart the main service.
> Note! The source adddresses configured above must be the IP addresses that are configured on the local system's network interface. When using source addresses option, its also necessary to ensure that the system has a default route or a specific route for the source address to be able to reach the destination network. When source addresses are not configured, the IP address of the interface with a default route will be used as the source address.


### Default Parameters

- **`Default Record TTL`** — _text_ · sufijo `seconds (default 3600/1h)`
  > The default TTL value to use if not specified when adding or updating records in a Zone.
- **`Default NS Record TTL`** — _text_ · sufijo `seconds (default 14400/4h)`
  > The default TTL value to use if not specified when adding or updating NS records in a Primary Zone.
- **`Default SOA Record TTL`** — _text_ · sufijo `seconds (default 900/15m)`
  > The default TTL value to use if not specified when adding or updating SOA records in a Primary Zone.
- **`Default Responsible Person`** — _text_
  > The default SOA Responsible Person email address to use when adding a Primary Zone.
- **`Use SOA Serial Date Scheme`** — _checkbox_
  > The default SOA Serial option to use if not specified when adding a Primary Zone.
- **`Minimum SOA Refresh`** — _text_ · sufijo `seconds (default 300/5m)`
  > The minimum Refresh interval to be used by Secondary, Stub, Secondary Forwarder, and Secondary Catalog zones. This minimum value will be used if a zone's SOA Refresh value is less than it.
- **`Minimum SOA Retry`** — _text_ · sufijo `seconds (default 300/5m)`
  > The minimum Retry interval to be used by Secondary, Stub, Secondary Forwarder, and Secondary Catalog zones zones. This minimum value will be used if a zone's SOA Retry value is less than it.
- **`Zone Transfer Allowed Networks`** — _textarea_
  > Enter IP addresses or network addresses one below another that are allowed to perform zone transfer for all zones without any TSIG authentication.
- **`Notify Allowed Networks`** — _textarea_
  > Enter IP addresses or network addresses one below another that are allowed to Notify all Secondary Zones.

### Software Update

- **`Enable Check For Update`** — _checkbox_
  > Enables the DNS Server to check if an update is available when the Check For Update API is called which usually occurs after a user logs into the Web Console.
- **`Enable Automatic Update`** — _checkbox_
  > The DNS Server will check for DNS Apps update once every day and will automatically download and install the updates.

### IPv6

- **`Disable IPv6`** — _radio_
  > Disables IPv6 support such that the DNS Server uses only IPv4 for all outbound DNS and HTTP(s) requests.
- **`Enable IPv6`** — _radio_
  > Enables IPv6 support such that the DNS Server uses both IPv6 (whenever possible) and IPv4 with equal weightage for all outbound DNS and HTTP(s) requests.
- **`Prefer IPv6`** — _radio_
  > Enables IPv6 support such that the DNS Server prefers using IPv6 (whenever possible) for all outbound DNS and HTTP(s) requests and will use IPv4 only after exhausting all IPv6 attempts.

**Avisos de esta sección (1), literales:**

> Warning! Enable IPv6 support only if this DNS Server has native IPv6 Internet access otherwise it will affect performance. There are many name servers on the Internet that do not respond over IPv6 and thus using Prefer IPv6 option when you are running DNS Server in recursive resolver mode (i.e. without any forwarders) may cause frequent operational issues with resolution that may result increase in Server Failure responses.


### UDP Socket Pool

- **`Enable UDP Socket Pool`** — _checkbox_
  > The DNS Server will use UDP socket pool for all outbound DNS-over-UDP requests when enabled.
- **`UDP Socket Pool Excluded Ports`** — _textarea_ · **apagado por su maestro**
  > Enter port numbers one below other to be excluded from being used by the UDP socket pool.

**Avisos de esta sección (1), literales:**

> Note! Enabling UDP socket pool provides port randomization for all outbound DNS-over-UDP requests to mitigate spoofing attacks. It is recommended to enable UDP socket pool on Windows platform. On Linux, ports are fairly random and thus socket pool may be enabled if more randomization is desired. The DNS Server can detect DNS spoofing attack attempts based on ID mismatch and switch to TCP protocol automatically.


### EDNS

- **`EDNS UDP Payload Size`** — _number_ · sufijo `bytes (valid range 512-4096; default 1232)`
  > The maximum UDP payload size that can be used to avoid IP fragmentation.

### DNSSEC

- **`Enable DNSSEC Validation`** — _checkbox_
  > The DNS Server will validate all responses from name servers or forwarders when this option is enabled.

**Avisos de esta sección (3), literales:**

> Warning! Devices that do not have a real-time clock and rely on NTP when booting (e.g. Raspberry Pi), enabling DNSSEC validation will cause failure to resolve the NTP server domain name thus causing the DNS Server to fail to validate all other domain names too due to invalid system date/time. To fix this issue, just create a Conditional Forwarder zone for the NTP server domain name (e.g. ntp.org) with forwarder set to this-server and Enable DNSSEC Validation option unchecked. This conditional forwarder zone will disable DNSSEC validation for the NTP server domain name and allow the device to update its system data/time on boot.
> Warning! When forwarders are configured, DNSSEC validation will work only if the forwarders are security aware i.e. can respond to DNSSEC requests correctly.
> Note! Enabling DNSSEC may increase delays in resolving domain names when the cache is initially empty. As the cache fills up, the performance will be normal as expected.


### EDNS Client Subnet

- **`Enable EDNS Client Subnet`** — _checkbox_
  > The DNS Server will use the public IP address of the request with a prefix length, or the existing Client Subnet option from the request.
- **`ECS IPv4 Prefix Length`** — _number_ · sufijo `(valid range 0-32; default 24)` · **apagado por su maestro**
  > The IPv4 prefix length to define the client subnet.
- **`ECS IPv6 Prefix Length`** — _number_ · sufijo `(valid range 0-64; default 56)` · **apagado por su maestro**
  > The IPv6 prefix length to define the client subnet.
- **`ECS IPv4 Override`** — _text_ · **apagado por su maestro**
  > The IPv4 network address that must be used as ECS for all outbound requests overriding client's actual subnet.
- **`ECS IPv6 Override`** — _text_ · **apagado por su maestro**
  > The IPv6 network address that must be used as ECS for all outbound requests overriding client's actual subnet.

**Avisos de esta sección (3), literales:**

> Warning! EDNS Client Subnet (ECS) option when enabled will compromises user's privacy since the DNS Server will send the user's public IP network subnet to name servers or forwarders when resolving requests. When not using encrypted DNS protocols, this information can also be read passively by anyone on the network.
> Note! EDNS Client Subnet (ECS) option allows passing the user's client subnet information to name servers or forwarders so that the response may contain IP addresses of servers closer to the user's geographic region. EDNS Client Subnet (ECS) option thus is only useful when the DNS Server is hosted in a geographically different region compared to the users that are configured to use it.
> Note! Enabling EDNS Client Subnet (ECS) option will significantly increase the DNS Server's memory usage since the server will have to cache data for each client subnet separately. It will also increase cache misses since DNS Server will have to resolve requests and cache them for each client subnet separately.


### Rate Limiting

- **`QPM Sample Size`** — _number_ · sufijo `minutes (valid range 1-60; default 5)`
  > The sample size in minutes to sample latest data from Last Hour stats for limiting queries per client.
- **`QPM Limit UDP Truncation`** — _number_ · sufijo `% (valid range 0-100; default 50)`
  > The percentage of requests that are responded with a truncation (TC) response when QPM limit exceeds for DNS-over-UDP protocol service while the rest of the requests are dropped. A TC response will cause a real client to retry to DNS-over-TCP protocol service.
- **`QPM Limit Bypass List`** — _textarea_
  > Enter IP addresses or network addresses one below another that are allowed to bypass the QPM limit.
- **`Queries Per Minute (QPM) Limits (IPv4)`** — _lista editable_, columnas `IPv4 Prefix` · `UDP Limit` · `TCP Limit`
  (más la columna de borrado). En el harness trae 2 filas; **el número es dato, no superficie**.
  > The maximum queries an IPv4 client subnet can make to DNS-over-UDP and DNS-over-TCP protocol services per minute on average based on the sample size. Set limit value to 0 to allow unlimited queries for a specific protocol in an entry or delete the entry altogether to remove rate limiting for the prefix.
- **`Queries Per Minute (QPM) Limits (IPv6)`** — _lista editable_, columnas `IPv6 Prefix` · `UDP Limit` · `TCP Limit`
  (más la columna de borrado). En el harness trae 3 filas; **el número es dato, no superficie**.
  > The maximum queries an IPv6 client subnet can make to DNS-over-UDP and DNS-over-TCP protocol services per minute on average based on the sample size. Set limit value to 0 to allow unlimited queries for a specific protocol in an entry or delete the entry altogether to remove rate limiting for the prefix.

**Avisos de esta sección (2), literales:**

> Note! Queries Per Minute (QPM) feature will limit requests from a client subnet based on its IP address and the specified subnet prefix lengths except for loopback IP addresses. The QPM limit configured will be compared with the average count from the sample size which means a client may exceed the QPM limit for a given minute but won't exceed for the given sample size in minutes. Rate limited clients will be listed in orange color on the dashboard top clients table.
> Note! The configured TCP limits apply to the DNS-over-TCP protocol service as well as to the DNS-over-TLS, DNS-over-HTTPS and DNS-over-QUIC optional protocol services.


### Advanced Options

- **`Client Timeout`** — _number_ · sufijo `milliseconds (valid range 1000-10000; default 2000)`
  > The amount of time the DNS Server must wait before responding with a ServerFailure response to a client request when no answer is available.
- **`TCP Send Timeout`** — _number_ · sufijo `milliseconds (valid range 1000-90000; default 10000)`
  > The maximum amount of time the DNS Server will wait for the response to be sent. This option will apply for DNS requests being received by the DNS Server over TCP, TLS, TcpProxy, or HTTPS transports.
- **`TCP Receive Timeout`** — _number_ · sufijo `milliseconds (valid range 1000-90000; default 10000)`
  > The maximum amount of time the DNS Server will wait for receiving data. This option will apply for DNS requests being received by the DNS Server over TCP, TLS, TcpProxy, or HTTPS transports.
- **`QUIC Idle Timeout`** — _number_ · sufijo `milliseconds (valid range 1000-90000; default 60000)`
  > The time interval after which an idle QUIC connection will be closed. This option applies only to QUIC transport protocol.
- **`QUIC Max Inbound Streams`** — _number_ · sufijo `(valid range 1-1000; default 100)`
  > The max number of inbound bidirectional streams that can be accepted per QUIC connection. This option applies only to QUIC transport protocol.
- **`Listen Backlog`** — _number_ · sufijo `(default 100)`
  > The maximum number of pending inbound connections. This option applies to TCP, TLS, TcpProxy, and QUIC transport protocols.
- **`UDP Send Buffer Size`** — _number_ · sufijo `KB (valid range 8-65536; default 2048)`
  > The UDP listener socket send buffer size. This option applies to UDP and UdpProxy transport protocols.
- **`UDP Receive Buffer Size`** — _number_ · sufijo `KB (valid range 8-65536; default 2048)`
  > The UDP listener socket receive buffer size. This option applies to UDP and UdpProxy transport protocols.
- **`Max Concurrent Resolutions`** — _number_ · sufijo `per CPU core (default 100)`
  > The maximum number of concurrent async outbound resolutions that should be done per CPU core.

## Lo que este contrato NO dice

- **El orden.** Las secciones salen en el orden en que la página las pinta hoy. Es un hecho, no
  una recomendación: decidir el orden es parte de lo que se le pide al piloto.
- **Nada visual.** Ni color, ni espaciado, ni tipografía. Eso es lo que se está pidiendo cambiar.
- **Los otros ocho paneles.** `General` es el más denso de los nueve, y el que trae el vocabulario
  entero de una vez. Lo que se decida aquí lo heredan los otros ocho **y DHCP**, porque el kit de
  formulario (`ui/PanelForm.tsx`) es de las dos pantallas: son los dos formularios grandes de la
  consola.

## Lo que el lector no resuelve, dicho y no escondido

En `General`, **nada**: 0 sin resolver.

En los nueve paneles hay **uno**, y está en `Tsig.tsx`: el `aria-label={name}` del `<Select>` de
algoritmo dentro de `EditableList`, que la lista pone por fila. Es la misma familia que
`TSIG key name ${i+1}`, y su patrón —la fila repetible— **ya lo decidió el piloto 2**.

## Contra qué se comprueba al volver

- Los **39 controles**, por nombre.
- Sus **41 ayudas**: las 39 de los controles **y las 2 de las listas**, que tienen
  la suya propia. Exigir sólo las de los controles dejaría fuera dos párrafos que están en
  pantalla y en este contrato.
- Los **19 sufijos**, literales.
- Los **12 avisos**, literales, en su sección.
- Las **10 secciones** y las **2 listas** con sus columnas.
- Las **nueve subpestañas** y la **barra pegajosa** con sus cuatro botones.
- La relación de los **dos maestros** con sus **5 dependientes**.
- La **confirmación de `Flush Cache`** con su frase literal.
- Que `Save Settings` **guarda los nueve paneles** y que la validación **salta a la subpestaña**
  del campo que falla.

**Siete de esas cosas son re-comprobables con una orden**, y las demás no: `verify-evidencia.mjs`
compara contra la página, elemento a elemento y con el SHA-256 entero de cada cadena, los
**nombres, las ayudas, los avisos, los sufijos, las secciones, las listas y la barra**. Si el
panel cambia antes de que vuelva el piloto, eso lo dice en vez de dejarlo pasar:

```
node dev/verify-evidencia.mjs --snippet      # la función que se ejecuta en la consola del panel
node dev/verify-evidencia.mjs captura.json   # compara lo que devolvió
```

**Lo que no re-comprueba, y por qué** —dicho aquí para que nadie lea la lista de arriba como si
saliera entera de una orden—: las **nueve subpestañas** no están dentro de `<main>`, porque las
monta el panel lateral del Shell y llegan por prop (`Settings.tsx:38`); los **dos maestros y sus
cinco dependientes** exigirían pulsar la página, y un verificador que altera lo que comprueba es
peor que uno que declara un límite; y la **confirmación de `Flush Cache`**, el alcance de
`Save Settings` y el salto de validación se leen del fuente, donde `static-contract.mjs` y sus
pruebas ya los cubren. Están en el contrato porque se verificaron una vez, a mano y en el código.
