> # ⛔ NO USAR — documento retirado el 2026-09-02
>
> Este fichero se generó con `dev/screen-contract.mjs`, barriendo el DOM, y se
> **sabe incompleto**: `Zone Options` sale con una de sus cinco pestañas, los
> diálogos sin campos salen vacíos cuando su contrato entero es prosa, los quince
> `Confirm` no están, y el barrido dejó usuarios y grupos añadidos en
> `Zone Permissions` mientras lo medía.
>
> Se conserva **como pista, no como autoridad**. El contrato bueno se lee del
> fuente con `dev/static-contract.mjs` y se comprueba después contra el harness.
> Hasta que ese exista, **nada de aquí va a un prompt**.

# Piloto 2 — los contratos de los trece diálogos

Volcados el **2026-09-02** con `dev/screen-contract.mjs`, sello `2417e970b68f`,
contra la instancia `dev` del harness. Cada uno lleva sus campos con tipo, estado,
opciones y ayuda, su pie, su talla y **el barrido de variantes**: lo que cada
elección monta, que es lo que una foto sola no ve.

Los `Confirm` se volcaron y se **descartaron**, nunca se confirmaron: son diálogos
reales sobre un servidor real.

## Las cuatro tallas, y qué va en cada una

| Talla | Diálogos |
|---|---|
| `medium` | `AddZone` · `ZoneOptions` · `ImportZone` · `ZonePermissions` · `AddEditRecord` |
| `form` | `ConvertZone` · `CloneZone` · `UnsignZone` · `SignZone` |
| `compact` | `Confirm_DeleteZone` · `Confirm_DisableRecord` |
| `wide` | `ViewDs` · `DnssecProperties` |

Nadie las eligió a mano: son las que el código ya asigna. **Ninguna es fija** —
las cuatro son `min(ancho, calc(100vw - 32px))`, así que a 390 px encogen solas.

## Los pies, que es donde se decide qué hace cada diálogo

| Diálogo | Pie |
|---|---|
| `AddZone` | `Add` · `Close` |
| `ZoneOptions` | `Save` · `Close` |
| `ImportZone` | `Import` · `Close` |
| `ConvertZone` | `Convert Zone` · `Close` |
| `CloneZone` | `Clone Zone` · `Close` |
| `ZonePermissions` | `Save` · `Close` |
| `Confirm_DeleteZone` | `Delete` · `Cancel` |
| `AddEditRecord` | `Save` · `Close` |
| `UnsignZone` | `Unsign Zone` · `Close` |
| `ViewDs` | `Close` |
| `DnssecProperties` | `Close` |
| `SignZone` | `Sign Zone` · `Close` |
| `Confirm_DisableRecord` | `Disable` · `Cancel` |

Tres reglas que ya están y que el rediseño no puede perder: **el verbo primero y
el descarte después**, siempre; **el verbo se nombra**, no es un «OK» —`Delete`,
`Disable`, `Sign Zone`, `Convert Zone`—; y **`View DS Info` no tiene verbo**,
sólo `Close`, porque no hay nada que confirmar.

---

## `AddZone` — «Add Zone»

**Dónde se abre:** la lista, verbo de pantalla `Add Zone`. **Talla** `medium`. **Pie:** `Add` · `Close`.

### Campos (12)

- `Zone` — _text_
- `Primary Zone (default)` — _radio_
- `Secondary Zone` — _radio_
- `Stub Zone` — _radio_
- `Conditional Forwarder Zone` — _radio_
- `Secondary Conditional Forwarder Zone` — _radio_
- `Catalog Zone` — _radio_
- `Secondary Catalog Zone` — _radio_
- `Secondary ROOT Zone (RFC 8806)` — _radio_
- `Catalog Zone` — _combobox_ — ayuda: «Select a Catalog zone to register as its member zone.» — acciones: —
- `Import Zone File (Optional)` — _file_
- `Use SOA Serial Date Scheme` — _checkbox_

### Ayuda de grupo

> Help: How To Self Host Your Own Domain Name

### Enlaces salientes

- RFC 8806 → `https://datatracker.ietf.org/doc/rfc8806/`
- Help: How To Self Host Your Own Domain Name → `https://blog.technitium.com/2022/06/how-to-self-host-your-own-domain-name.html`

### Lo que cada elección monta

**`Zone`** (combobox, 2 opciones)

- `—` — sin campos propios
- `catalogo.test` — sin campos propios

_Comunes a todas:_ `Zone`, `Primary Zone (default)`, `Secondary Zone`, `Stub Zone`, `Conditional Forwarder Zone`, `Secondary Conditional Forwarder Zone`, `Catalog Zone`, `Secondary Catalog Zone`, `Secondary ROOT Zone (RFC 8806)`, `Catalog Zone`, `Import Zone File (Optional)`, `Use SOA Serial Date Scheme`

**`Primary Zone (default)`** (radios, 8 opciones)

- `Primary Zone (default)` — añade `Import Zone File (Optional)`, `Use SOA Serial Date Scheme`
- `Secondary Zone` — añade `Primary Name Server Addresses (Optional)`, `XFR-over-TCP (default)`, `XFR-over-TLS`, `XFR-over-QUIC`, `TSIG Key Name (Optional)`, `Use ZONEMD to Validate Zone`
- `Stub Zone` — añade `Primary Name Server Addresses (Optional)`
- `Conditional Forwarder Zone` — añade `Initialize Forwarder (FWD) Record`, `DNS-over-UDP (default)`, `DNS-over-TCP`, `DNS-over-TLS`, `DNS-over-HTTPS`, `DNS-over-QUIC`, `Forwarder`, `Use "This Server"`, `Enable DNSSEC Validation`, `No Proxy`, `Default Proxy (default)`, `HTTP Proxy`, `SOCKS5 Proxy`, `Proxy Server Address`, `Proxy Server Port`, `Proxy Server Username`, `Proxy Server Password`
- `Secondary Conditional Forwarder Zone` — añade `Primary Name Server Addresses`, `XFR-over-TCP (default)`, `XFR-over-TLS`, `XFR-over-QUIC`, `TSIG Key Name (Optional)`
- `Catalog Zone` — sin campos propios
- `Secondary Catalog Zone` — añade `Primary Name Server Addresses`, `XFR-over-TCP (default)`, `XFR-over-TLS`, `XFR-over-QUIC`, `TSIG Key Name (Optional)`
- `Secondary ROOT Zone (RFC 8806)` — sin campos propios

_Comunes a todas:_ `Zone`, `Primary Zone (default)`, `Secondary Zone`, `Stub Zone`, `Conditional Forwarder Zone`, `Secondary Conditional Forwarder Zone`, `Catalog Zone`, `Secondary Catalog Zone`, `Secondary ROOT Zone (RFC 8806)`, `Catalog Zone`

## `ZoneOptions` — «Zone Options - casa.test»

**Dónde se abre:** **las dos vistas** — botón de fila en la lista y menú de zona en registros. **Talla** `medium`. **Pie:** `Save` · `Close`.

### Campos (5)

- `Zone options` — _div_
- `Catalog Zone` — _combobox_ — opciones: `—` · `catalogo.test` — acciones: —
- `Override Query Access Option` — _checkbox_ — **disabled** — acciones: —
- `Override Zone Transfer Option` — _checkbox_ — **disabled** — acciones: —
- `Override Notify Option` — _checkbox_ — **disabled** — acciones: —

### Lo que cada elección monta

**`Catalog Zone`** (combobox, 2 opciones)

- `—` — sin campos propios
- `catalogo.test` — sin campos propios

_Comunes a todas:_ `Zone options`, `Catalog Zone`, `Override Query Access Option`, `Override Zone Transfer Option`, `Override Notify Option`

## `ImportZone` — «Import - casa.test»

**Dónde se abre:** menú de fila (lista) y menú de zona (registros) · sólo `Primary` y `Forwarder`. **Talla** `medium`. **Pie:** `Import` · `Close`.

### Campos (6)

- `Overwrite Existing Records` — _checkbox_
- `Overwrite Zone` — _checkbox_
- `Overwrite SOA Serial` — _checkbox_
- `Zone File` — _radio_
- `Text Editor` — _radio_
- `Zone File` — _file_

### Ayuda de grupo

> Enable this option to overwrite existing records for the record types being imported.
>
> Enable this option to delete all existing records from the zone before importing new records.
>
> Enable this option to overwrite existing SOA record serial with the imported SOA record serial.

### Lo que cada elección monta

**`Zone File`** (radios, 2 opciones)

- `Zone File` — sin campos propios
- `Text Editor` — sin campos propios

_Comunes a todas:_ `Overwrite Existing Records`, `Overwrite Zone`, `Overwrite SOA Serial`, `Zone File`, `Text Editor`, `Zone File`

## `ConvertZone` — «Convert Zone - casa.test»

**Dónde se abre:** menú de fila y menú de zona · todos menos `Stub` y `Catalog`. **Talla** `form`. **Pie:** `Convert Zone` · `Close`.

### Campos (3)

- `Primary Zone` — _radio_ — **disabled**
- `Conditional Forwarder Zone` — _radio_
- `Catalog Zone` — _radio_ — **disabled**

### Lo que cada elección monta

**`Primary Zone`** (radios, 3 opciones)

- `Primary Zone` — **presente y deshabilitada**
- `Conditional Forwarder Zone` — sin campos propios
- `Catalog Zone` — **presente y deshabilitada**

_Comunes a todas:_ `Primary Zone`, `Conditional Forwarder Zone`, `Catalog Zone`

## `CloneZone` — «Clone Zone - casa.test»

**Dónde se abre:** menú de fila y menú de zona · sólo `Primary` y `Forwarder`. **Talla** `form`. **Pie:** `Clone Zone` · `Close`.

### Campos (2)

- `Source Zone` — _text_ — **readonly**
- `New Zone` — _text_

## `ZonePermissions` — «Edit Permissions - Zones / casa.test»

**Dónde se abre:** menú de fila y menú de zona · siempre. **Talla** `medium`. **Pie:** `Save` · `Close`.

### Campos (11)

- `canView for admin` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canModify for admin` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canDelete for admin` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `Add User` — _combobox_ — opciones: `—` · `None` · `ana` · `luis` — acciones: —
- `canView for Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canModify for Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canDelete for Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canView for DNS Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canModify for DNS Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `canDelete for DNS Administrators` — _checkbox_ — acciones: Remove, —, Remove, Remove, —
- `Add Group` — _combobox_ — opciones: `—` · `None` · `DHCP Administrators` · `Everyone` · `Operadores` — acciones: —

### Tabla

Columnas: `Name` · `View` · `Modify` · `Delete` · `(sin título)`

### Tabla

Columnas: `Name` · `View` · `Modify` · `Delete` · `(sin título)`

### Lo que cada elección monta

**`Add User`** (combobox, 3 opciones)

- `—` — sin campos propios
- `None` — sin campos propios
- `ana` — añade `canView for ana`, `canModify for ana`, `canDelete for ana`

_Comunes a todas:_ `canView for admin`, `canModify for admin`, `canDelete for admin`, `Add User`, `canView for Administrators`, `canModify for Administrators`, `canDelete for Administrators`, `canView for DNS Administrators`, `canModify for DNS Administrators`, `canDelete for DNS Administrators`, `Add Group`

**`Add Group`** (combobox, 4 opciones)

- `—` — sin campos propios
- `None` — sin campos propios
- `DHCP Administrators` — añade `canView for DHCP Administrators`, `canModify for DHCP Administrators`, `canDelete for DHCP Administrators`
- `Everyone` — añade `canView for DHCP Administrators`, `canModify for DHCP Administrators`, `canDelete for DHCP Administrators`, `canView for Operadores`, `canModify for Operadores`, `canDelete for Operadores`

_Comunes a todas:_ `canView for admin`, `canModify for admin`, `canDelete for admin`, `canView for ana`, `canModify for ana`, `canDelete for ana`, `Add User`, `canView for Administrators`, `canModify for Administrators`, `canDelete for Administrators`, `canView for DNS Administrators`, `canModify for DNS Administrators`, `canDelete for DNS Administrators`, `Add Group`

## `Confirm_DeleteZone` — «Delete Zone»

**Dónde se abre:** las dos vistas, y otros trece sitios de Zones. **Talla** `compact`. **Pie:** `Delete` · `Cancel`.

### Campos

Ninguno: es un diálogo de sólo lectura o de confirmación.

## `AddEditRecord` — «Add Record»

**Dónde se abre:** **sólo registros** — verbo `Add Record` y `Edit Record` de cada fila. **Talla** `medium`. **Pie:** `Save` · `Close`.

### Campos (9)

- `Name` — _text_
- `Type` — _combobox_ — opciones: `A` · `NS` · `CNAME` · `PTR` · `MX` · `TXT` · `RP` · `AAAA` · `SRV` · `NAPTR` · `DNAME` · `DS` · `SSHFP` · `TLSA` · `SVCB` · `HTTPS` · `URI` · `CAA` · `Unknown` — acciones: A
- `TTL` — _text_
- `IPv4 Address` — _text_
- `Add reverse (PTR) record` — _checkbox_ — acciones: A
- `Create reverse zone if it does not exists` — _checkbox_ — acciones: A
- `Overwrite existing records` — _checkbox_ — acciones: A
- `Comments` — _textarea_
- `Expiry TTL` — _text_

### Ayuda de grupo

> Set to automatically delete the record when the value in seconds elapses since the record’s last modified time.

### Lo que cada elección monta

**`Type`** (combobox, 19 opciones)

- `A` — añade `IPv4 Address`, `Add reverse (PTR) record`, `Create reverse zone if it does not exists`
- `NS` — añade `Name Server`, `Glue Addresses`
- `CNAME` — añade `Canonical Name`
- `PTR` — añade `Domain Name`
- `MX` — añade `Preference`, `Exchange`
- `TXT` — añade `Text Data`, `Split text into multiple character strings`
- `RP` — añade `Mailbox`, `TXT Domain`
- `AAAA` — añade `IPv6 Address`, `Add reverse (PTR) record`, `Create reverse zone if it does not exists`
- `SRV` — añade `Priority`, `Weight`, `Port`, `Target`
- `NAPTR` — añade `Order`, `Preference`, `Flags`, `Services`, `Regular Expression`, `Replacement`
- `DNAME` — añade `Delegation Name`
- `DS` — añade `Key Tag`, `DNSSEC Algorithm`, `Digest Type`, `Digest`
- `SSHFP` — añade `Algorithm`, `Fingerprint Type`, `Fingerprint`
- `TLSA` — añade `Certificate Usage`, `Selector`, `Matching Type`, `Certificate Association Data`
- `SVCB` — añade `Priority`, `Target Name`, `Use Automatic IPv4 Hint`, `Use Automatic IPv6 Hint`
- `HTTPS` — añade `Priority`, `Target Name`, `Use Automatic IPv4 Hint`, `Use Automatic IPv6 Hint`
- `URI` — añade `Priority`, `Weight`, `URI`
- `CAA` — añade `Flags`, `Tag`, `Authority`
- `Unknown` — añade `RR Type`, `Value`

_Comunes a todas:_ `Name`, `Type`, `TTL`, `Overwrite existing records`, `Comments`, `Expiry TTL`

## `UnsignZone` — «Unsign Zone - casa.test»

**Dónde se abre:** **sólo registros**, menú `DNSSEC` · sólo si está firmada. **Talla** `form`. **Pie:** `Unsign Zone` · `Close`.

### Campos

Ninguno: es un diálogo de sólo lectura o de confirmación.

## `ViewDs` — «View DS Info - casa.test»

**Dónde se abre:** **sólo registros**, menú `DNSSEC` · sólo si está firmada. **Talla** `wide`. **Pie:** `Close`.

### Campos

Ninguno: es un diálogo de sólo lectura o de confirmación.

### Tabla

Columnas: `Digest Type` · `Digest`

## `DnssecProperties` — «DNSSEC Properties - casa.test»

**Dónde se abre:** **sólo registros**, menú `DNSSEC` · sólo si está firmada. **Talla** `wide`. **Pie:** `Close`.

### Campos (6)

- `Rollover days for 16958` — _text_ — acciones: Key Tag, Key Type, Algorithm, State, State Changed, Rollover (days), Activate, Rollover, Retire, Save, Rollover, Retire, Add Private Key, Publish All Keys, Change, Save
- `Next Secure (NSEC) (recommended)` — _radio_ — acciones: Key Tag, Key Type, Algorithm, State, State Changed, Rollover (days), Activate, Rollover, Retire, Save, Rollover, Retire, Add Private Key, Publish All Keys, Change, Save
- `Next Secure 3 (NSEC3)` — _radio_ — acciones: Key Tag, Key Type, Algorithm, State, State Changed, Rollover (days), Activate, Rollover, Retire, Save, Rollover, Retire, Add Private Key, Publish All Keys, Change, Save
- `NSEC3 Iterations` — _text_
- `NSEC3 Salt Length` — _text_
- `DNSKEY TTL` — _text_ — acciones: Save

### Ayuda de grupo

> The number of iterations used by NSEC3 for hashing the domain names. It is recommended to use 0 iterations since more iterations will increase computational costs for both the DNS Server and resolver while not providing much value against "zone walking" [RFC 9276].
>
> The number of bytes of random salt to generate to be used with the NSEC3 hash computation. It is recommended to not use salt by setting the length to 0 [RFC 9276].
>
> The TTL value to be used for DNSKEY records. A lower value will allow quicker addition or rollover to a new DNS Key at the cost of increased frequency of DNSKEY queries by resolvers.

### Tabla

Columnas: `Key Tag` · `Key Type` · `Algorithm` · `State` · `State Changed` · `Rollover (days)` · `(sin título)`

### Enlaces salientes

- RFC 9276 → `https://www.rfc-editor.org/rfc/rfc9276.html#name-iterations`
- RFC 9276 → `https://www.rfc-editor.org/rfc/rfc9276.html#name-salt`

### Lo que cada elección monta

**`Next Secure (NSEC) (recommended)`** (radios, 2 opciones)

- `Next Secure (NSEC) (recommended)` — sin campos propios
- `Next Secure 3 (NSEC3)` — añade `NSEC3 Iterations`, `NSEC3 Salt Length`

_Comunes a todas:_ `Rollover days for 16958`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`

## `SignZone` — «Sign Zone - example.net»

**Dónde se abre:** **sólo registros**, menú `DNSSEC` · sólo si la zona no está firmada. **Talla** `form`. **Pie:** `Sign Zone` · `Close`.

### Campos (12)

- `RSA` — _radio_
- `ECDSA (recommended)` — _radio_
- `EdDSA` — _radio_
- `ECDSA Curve` — _combobox_ — opciones: `P256 (default)` · `P384` — acciones: P256 (default)
- `Automatic Private Key Generation (default)` — _radio_ — acciones: P256 (default)
- `Use Specified Private Key` — _radio_ — acciones: P256 (default)
- `Automatic Private Key Generation (default)` — _radio_ — acciones: P256 (default)
- `Use Specified Private Key` — _radio_ — acciones: P256 (default)
- `Next Secure (NSEC) (recommended)` — _radio_
- `Next Secure 3 (NSEC3)` — _radio_
- `DNSKEY TTL` — _text_
- `ZSK Automatic Rollover` — _text_

### Ayuda de grupo

> With NSEC, all the records in your zone can be discovered by anyone using "zone walking" technique. NSEC3 makes it difficult since it uses hashing with a random salt.
>
> The TTL value to be used for DNSKEY records. A lower value will allow quicker addition or rollover to a new DNS Key at the cost of increased frequency of DNSKEY queries by resolvers.
>
> The frequency at which the DNS Server must automatically rollover the Zone Signing Key (ZSK).
>
> Help: How To Secure Your Domain Name With DNSSEC

### Enlaces salientes

- Help: How To Secure Your Domain Name With DNSSEC → `https://blog.technitium.com/2022/07/how-to-secure-your-domain-name-with-.html`

### Lo que cada elección monta

**`ECDSA Curve`** (combobox, 2 opciones)

- `P256 (default)` — sin campos propios
- `P384` — sin campos propios

_Comunes a todas:_ `RSA`, `ECDSA (recommended)`, `EdDSA`, `ECDSA Curve`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`, `ZSK Automatic Rollover`

**`RSA`** (radios, 3 opciones)

- `RSA` — añade `Hash Algorithm`, `KSK Size`, `ZSK Size`
- `ECDSA (recommended)` — añade `ECDSA Curve`
- `EdDSA` — añade `EdDSA Curve`

_Comunes a todas:_ `RSA`, `ECDSA (recommended)`, `EdDSA`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`, `ZSK Automatic Rollover`

**`Automatic Private Key Generation (default) › #1`** (radios, 2 opciones)

- `Automatic Private Key Generation (default)` — sin campos propios
- `Use Specified Private Key` — añade `KSK Private Key`

_Comunes a todas:_ `RSA`, `ECDSA (recommended)`, `EdDSA`, `ECDSA Curve`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`, `ZSK Automatic Rollover`

**`Automatic Private Key Generation (default) › #2`** (radios, 2 opciones)

- `Automatic Private Key Generation (default)` — sin campos propios
- `Use Specified Private Key` — añade `ZSK Private Key`

_Comunes a todas:_ `RSA`, `ECDSA (recommended)`, `EdDSA`, `ECDSA Curve`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`, `ZSK Automatic Rollover`

**`Next Secure (NSEC) (recommended)`** (radios, 2 opciones)

- `Next Secure (NSEC) (recommended)` — sin campos propios
- `Next Secure 3 (NSEC3)` — añade `NSEC3 Iterations`, `NSEC3 Salt Length`

_Comunes a todas:_ `RSA`, `ECDSA (recommended)`, `EdDSA`, `ECDSA Curve`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Automatic Private Key Generation (default)`, `Use Specified Private Key`, `Next Secure (NSEC) (recommended)`, `Next Secure 3 (NSEC3)`, `DNSKEY TTL`, `ZSK Automatic Rollover`

## `Confirm_DisableRecord` — «Disable Record»

**Dónde se abre:** sólo registros, acción de fila. **Talla** `compact`. **Pie:** `Disable` · `Cancel`.

### Campos

Ninguno: es un diálogo de sólo lectura o de confirmación.
