# Política de emisión de Factura Electrónica En Línea (FEL) — RutaCero

## 1. Resumen ejecutivo

RutaCero S.A. cobrará Q49 mensuales por la suscripción PRO y, al ser contribuyente
inscrito en SAT, está obligada a emitir Factura Electrónica En Línea (FEL) por cada
cobro al usuario final. Hasta contar con un certificador FEL integrado, las facturas
se emiten **manualmente** desde la Agencia Virtual SAT o el portal del certificador,
operadas por el founder. La automatización vía certificador (recomendado: INFILE) se
contratará antes del primer cobro live por canal Recurrente. El founder es el
responsable directo hasta que se incorpore un contador externo.

## 2. Marco legal

- **Decreto 6-2022** (Ley para la Simplificación de Requisitos y Trámites
  Administrativos) y la normativa SAT derivada obligan a todos los contribuyentes
  inscritos a emitir FEL como único régimen de facturación válido.
- **RutaCero S.A.** percibe ingresos por suscripción de usuarios en Guatemala; por lo
  tanto es contribuyente del cobro al usuario final y debe emitir la factura.
- **Recurrente** opera como Procesador de Servicios de Pago (PSP). Procesa el cobro,
  cobra su comisión y deposita el neto a RutaCero. **No es el contribuyente del
  servicio cobrado al usuario final** y, salvo acuerdo explícito con un certificador,
  no emite la factura por cuenta de RutaCero.
- Fuentes públicas de referencia:
  - Portal SAT FEL: <https://portal.sat.gob.gt/portal/efactura/>
  - Recurrente — guía FEL Guatemala:
    <https://www.recurrente.com/blog/factura-electronica-fel-guatemala>
  - Decreto 6-2022 (Diario de Centro América).

## 3. Decisión: ¿Quién emite la factura?

| Escenario | Quién emite | Cómo | Estado en RutaCero |
|---|---|---|---|
| Cobro vía Recurrente (web) | RutaCero S.A. (vía certificador conectado al flujo Recurrente) | Automático tras cobro exitoso | **Pendiente: contratar certificador** |
| Cobro vía Google Play (Android) | Google Pay actúa como reseller: Google emite factura al usuario final; RutaCero recibe el payout neto y emite factura B2B por servicios a Google | Manual mensual o trimestral | **Pendiente: confirmar acuerdo con Google Play LATAM** |
| Cobro por transferencia bancaria (`/pago-manual`) | RutaCero S.A. directamente | Manual hasta que el volumen justifique automatización | **Operativo manual hoy** |

## 4. Certificador FEL recomendado

Comparativa breve para SaaS pequeños operando en Guatemala:

- **INFILE** — el certificador más utilizado por SaaS GT, con API documentada y
  ambiente de pruebas. Recomendado para arranque por baja fricción de integración.
- **Megaprint** — alternativa establecida, también con soporte API.
- **G&T FEL** — orientado a clientes enterprise; fee mensual mayor y onboarding más
  pesado.
- **Cofidi / Digifact** — opciones secundarias, válidas si surge bloqueo con las
  anteriores.

**Recomendación:** iniciar con **INFILE** mientras el volumen sea bajo (consultar
cotización directa, no se publican precios fijos). Reevaluar migración o renegociación
cuando el MRR supere Q10,000/mes.

## 5. Inscripción a SAT como emisor FEL

Pasos secuenciales que el founder debe ejecutar **antes del primer cobro live**:

1. Verificar que RutaCero S.A. (o nombre comercial registrado) tiene **RTU vigente**
   y actividad económica acorde al servicio cobrado.
2. Inscribirse al **régimen FEL** desde la Agencia Virtual SAT
   (<https://portal.sat.gob.gt> → "Factura Electrónica En Línea").
3. Obtener el **código de establecimiento** asignado para emisión.
4. Contratar al certificador seleccionado (ver sección 4) y firmar contrato.
5. Emitir una **factura de prueba** contra el ambiente TEST del certificador y
   verificar la respuesta SAT.
6. Emitir la **primera factura real** y archivar XML + PDF firmados.

## 6. Flujo operativo manual (hasta automatización)

Mientras no haya certificador integrado al backend, las primeras facturas se emiten
manualmente. Procedimiento:

1. El admin recibe la notificación del cobro (webhook de Recurrente → email a
   `admin@rutacero.gt`, o canal Slack si está configurado).
2. El admin entra a la Agencia Virtual SAT o al portal del certificador.
3. Genera la factura con los siguientes datos:
   - **NIT del receptor** si el usuario lo proporcionó; en caso contrario, **CF**
     (Consumidor Final).
   - **Monto:** Q49.00, **IVA incluido (12%)**.
   - **Descripción:** "Suscripción RutaCero PRO mensual".
4. Descarga el XML y el PDF firmados por el certificador y SAT.
5. Reenvía el PDF al usuario por email (usando el template existente de notificación
   de pago).
6. Registra el folio en la hoja de cálculo interna o en la futura tabla
   `manual_invoices`.

**Umbral de automatización:** aproximadamente **50 cobros/mes**. Por debajo de ese
volumen, el costo del certificador y la integración suele superar el ahorro
operativo.

## 7. Contingencia — si SAT no inscribe a tiempo

Si por bloqueo administrativo no se logra la inscripción FEL antes del primer cobro:

- **NO cobrar** hasta resolverlo. Cobrar sin emitir FEL constituye sanción
  tributaria y expone a RutaCero a multas por SAT.
- **Plan B:** posponer el lanzamiento del plan pagado. Los usuarios pueden seguir
  utilizando el plan FREE sin interrupción.
- **Plan C (último recurso):** si existe urgencia comercial, evaluar con el contador
  si se puede emitir factura simple no-FEL **únicamente** durante el periodo de
  gracia que SAT otorga en trámites de inscripción nueva, y solo si SAT ya emitió
  constancia formal de "inscripción en trámite". Validar plazo y alcance con
  contador antes de aplicar.

## 8. Responsables y revisión

- **Founder:** dueño de la decisión, firma del contrato con el certificador y
  responsable operativo de las facturas manuales mientras dure el flujo.
- **Contador externo (a contratar si aún no existe):** valida la calidad de las
  primeras facturas FEL antes del primer cobro live y revisa el cumplimiento mensual.
- **Revisión de la política:** cada 6 meses, o de inmediato cuando el MRR supere
  Q10,000/mes (umbral para reconsiderar certificador y modelo operativo).

## 9. Referencias

- Portal SAT FEL: <https://portal.sat.gob.gt/portal/efactura/>
- Recurrente — Factura Electrónica (FEL) en Guatemala:
  <https://www.recurrente.com/blog/factura-electronica-fel-guatemala>
- Decreto 6-2022 (consultar texto oficial en el Diario de Centro América).
