# Piloto 2 — reconciliación de nombres fuente ↔ DOM

Generado por `dev/reconciliation-doc.mjs` el **2026-09-02** a partir de dos
evidencias versionadas: `dialog-labels.json` (una apertura limpia por diálogo)
y `dialog-variants.json` (las ramas de los cinco diálogos variables).

```
node dev/reconcile-contract.mjs
```

## Resultado y límite

- **50 estados variantes** capturados, además de las once aperturas limpias.
- **0 nombres de control** del inventario sin observar en esas capturas.
- **0 nombres observados** sin correspondencia en el inventario.

Esto demuestra **cobertura de nombres en los estados capturados**. No demuestra
que el analizador haya entendido toda la lógica de ramas, ni que no exista una
forma de JSX que todavía no reconoce. Por eso no hay “ausencias explicadas por
condición”: se hizo que las ramas aparecieran en el navegador y se comparó lo
que apareció. Las etiquetas de grupo se enumeran aparte porque no son nombres
accesibles de controles.

Tampoco hay coincidencia genérica por prefijo. La única composición admitida
es explícita: `Secondary ROOT Zone` aparece como `Secondary ROOT Zone (RFC 8806)`.

## Estados capturados

- **AddZone (9):** `Primary` · `Secondary` · `Stub` · `Forwarder / initialize` · `Forwarder / do not initialize` · `SecondaryForwarder` · `Catalog` · `SecondaryCatalog` · `SecondaryRoot`
- **AddEditRecord (24):** `A` · `NS` · `CNAME` · `PTR` · `MX` · `TXT` · `RP` · `AAAA` · `SRV` · `NAPTR` · `DNAME` · `SVCB` · `SVCB / one parameter row` · `HTTPS` · `URI` · `CAA` · `ANAME` · `DS [signed Primary]` · `SSHFP [signed Primary]` · `TLSA [signed Primary]` · `FWD [Forwarder zone]` · `APP` · `Unknown` · `SOA [Edit Record]`
- **ZoneOptions (6):** `General` · `Query Access` · `Zone Transfer` · `Notify` · `Dynamic Updates (RFC 2136)` · `Dynamic Updates / one policy row`
- **SignZone (6):** `RSA / automatic` · `ECDSA / automatic` · `EdDSA / automatic` · `ECDSA / KSK specified` · `ECDSA / ZSK specified` · `ECDSA / NSEC3`
- **DnssecProperties (5):** `key form closed` · `RSA / automatic` · `ECDSA / automatic` · `EdDSA / automatic` · `ECDSA / specified`

## Los once, uno a uno

### `AddZone` — `AddZone.tsx`

9 estados variantes; 8 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `Zone Type` · `Conditional Forwarder` · `Zone Serial` · `Zone Transfer Protocol` · `Zone Validation` · `Protocol` · `DNSSEC` · `Network Proxy`.

Sin diferencias de nombres sin explicar.

### `ZoneOptions` — `ZoneOptions.tsx`

6 estados variantes; 1 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `Zone Transfer Protocol`.

Sin diferencias de nombres sin explicar.

### `ImportZone` — `ImportZone.tsx`

0 estados variantes; 2 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `Import Options` · `Import Type`.

Sin diferencias de nombres sin explicar.

### `ConvertZone` — `ConvertZone.tsx`

0 estados variantes; 1 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `Convert To`.

Sin diferencias de nombres sin explicar.

### `CloneZone` — `CloneZone.tsx`

0 estados variantes; 0 etiquetas de grupo fuera de la comparación de controles.

Sin diferencias de nombres sin explicar.

### `ZonePermissions` — `ZonePermissions.tsx`

0 estados variantes; 0 etiquetas de grupo fuera de la comparación de controles.

Sin diferencias de nombres sin explicar.

### `AddEditRecord` — `AddEditRecord.tsx`

24 estados variantes; 2 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `Protocol` · `Network Proxy`.

Sin diferencias de nombres sin explicar.

### `UnsignZone` — `UnsignZone.tsx`

0 estados variantes; 0 etiquetas de grupo fuera de la comparación de controles.

Sin diferencias de nombres sin explicar.

### `ViewDs` — `ViewDs.tsx`

0 estados variantes; 0 etiquetas de grupo fuera de la comparación de controles.

Sin diferencias de nombres sin explicar.

### `DnssecProperties` — `DnssecProperties.tsx`

5 estados variantes; 0 etiquetas de grupo fuera de la comparación de controles.

Sin diferencias de nombres sin explicar.

### `SignZone` — `SignZone.tsx`

6 estados variantes; 2 etiquetas de grupo fuera de la comparación de controles.

Etiquetas de grupo: `DNSKEY Algorithm` · `Proof of Non-Existence`.

Sin diferencias de nombres sin explicar.
