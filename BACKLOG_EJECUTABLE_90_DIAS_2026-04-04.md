# Backlog Ejecutable 90 Dias

Fecha: 2026-04-04

Base:
- [ANALISIS_CHAIRMAN_COUNCIL_2026-04-04.md](/Users/jnolasco/Desktop/PROYECTOS/Debt%20Control/app/ANALISIS_CHAIRMAN_COUNCIL_2026-04-04.md)

Objetivo:
- Convertir el analisis completo en un plan de ejecucion secuenciado para 90 dias.

Criterio de priorizacion:
1. Riesgo real para usuarios o negocio
2. Reduccion de incertidumbre
3. Impacto en confianza, conversion y retencion
4. Dependencias tecnicas
5. Esfuerzo

## Orden Maestro

1. EPIC-01 Hardening y accesibilidad base
2. EPIC-02 Cobertura automatizada y calidad de release
3. EPIC-03 Confiabilidad y explicabilidad del motor
4. EPIC-04 Observabilidad de producto y errores
5. EPIC-05 UX de onboarding, plan y conversion
6. EPIC-06 Workspaces como feature de producto
7. EPIC-07 Diferenciadores de coaching y retencion

## EPIC-01 Hardening y accesibilidad base

Objetivo:
- Cerrar riesgos P0/P1 que afectan seguridad percibida, cumplimiento basico y confianza.

### RC-001 Corregir bloqueo de zoom y validar reflow

Tipo:
- Frontend

Problema:
- El layout raiz bloquea zoom en mobile.

Aceptacion:
- Se elimina `maximumScale: 1`.
- Se elimina `userScalable: false`.
- La app funciona a 200% zoom sin perdida critica de contenido.
- Se documenta checklist de validacion manual mobile y desktop.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- S

### RC-002 Volver fail-secure el MFA admin

Tipo:
- Seguridad

Aceptacion:
- En `production`, si `ADMIN_MFA_TOTP_SECRET` no existe, login admin falla.
- Se registra evento de seguridad y mensaje de configuracion incompleta.
- Hay test unitario/integracion para este comportamiento.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- S

### RC-003 Endurecer middleware admin

Tipo:
- Seguridad/backend

Aceptacion:
- Middleware valida sesion admin firmada o marker seguro verificable.
- No basta con presencia de cookie.
- Hay test para acceso anonimo, cookie invalida y cookie valida.

Dependencias:
- RC-002

Riesgo:
- Medio

Esfuerzo:
- M

### RC-004 Enmascarar PII en soporte admin

Tipo:
- Seguridad/privacidad

Aceptacion:
- Roles no `SUPER_ADMIN` ven email parcialmente enmascarado.
- Existe override controlado solo donde sea estrictamente necesario.
- Se documenta politica de minimizacion de PII.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- S

### RC-005 Reemplazar checklist de accesibilidad por enforcement real

Tipo:
- Accesibilidad

Aceptacion:
- Se definen reglas base a11y para componentes de formulario, dialogos y navegacion.
- Existe al menos una suite automatizada con `axe` o equivalente.
- Se agregan skip link y validaciones de foco/teclado.

Dependencias:
- RC-001

Riesgo:
- Medio

Esfuerzo:
- M

## EPIC-02 Cobertura automatizada y calidad de release

Objetivo:
- Reducir riesgo de regresion en funcionalidades financieras y multi-tenant.

### RC-006 E2E de flujos criticos de usuario

Tipo:
- QA

Aceptacion:
- E2E para onboarding.
- E2E para crear deudas y generar plan.
- E2E para cambio de workspace.
- E2E para checkout/cancelacion.

Dependencias:
- RC-001

Riesgo:
- Medio

Esfuerzo:
- L

### RC-007 Integracion RLS por tablas criticas

Tipo:
- Seguridad/BD

Aceptacion:
- Pruebas de aislamiento por `tenant_id` y `user_id` para `debts`, `payments`, `plans`, `subscriptions`, `support_tickets`.
- Se valida que un usuario no pueda leer ni mutar datos de otro workspace.

Dependencias:
- Ninguna

Riesgo:
- Alto

Esfuerzo:
- M

### RC-008 Contratos del motor de planes

Tipo:
- Backend/QA

Aceptacion:
- Tests sobre avalanche, snowball, hybrid.
- Tests de invariantes: pagos nunca negativos, deuda total decreciente, no loops infinitos, errores explicitos de presupuesto.
- Fixtures realistas con deuda GTQ/USD.

Dependencias:
- Ninguna

Riesgo:
- Alto

Esfuerzo:
- M

### RC-009 Gate de release unico

Tipo:
- DX

Aceptacion:
- `npm run check` incluye suites minimas obligatorias.
- Se define politica de merge: sin verde no hay avance.
- README tecnico actualizado con matriz de pruebas.

Dependencias:
- RC-006
- RC-007
- RC-008

Riesgo:
- Bajo

Esfuerzo:
- S

## EPIC-03 Confiabilidad y explicabilidad del motor

Objetivo:
- Hacer que las recomendaciones sean entendibles, defendibles y medibles.

### RC-010 Score de confianza del plan

Tipo:
- Producto/backend

Aceptacion:
- Cada plan expone score `ALTO|MEDIO|BAJO`.
- El score depende de completitud de datos, estabilidad de ingresos, buffer y calidad del input.
- El usuario ve por que su score es el que es.

Dependencias:
- RC-008

Riesgo:
- Medio

Esfuerzo:
- M

### RC-011 Explicacion personalizada del por que de la estrategia

Tipo:
- Producto/UX

Aceptacion:
- La pantalla `/plan` explica por que una deuda va primero.
- Se muestra tradeoff: ahorro matematico vs velocidad psicologica.
- Se muestran al menos 2 escenarios de pago extra.

Dependencias:
- RC-010

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-012 Sustituir errores encoded por contratos tipados

Tipo:
- Backend

Aceptacion:
- `BUDGET_TOO_LOW:...` deja de usarse como string encoded.
- Se reemplaza por resultado tipado o error estructurado.
- Frontend consume estructura estable.

Dependencias:
- Ninguna

Riesgo:
- Medio

Esfuerzo:
- M

### RC-013 Telemetria de precision del motor

Tipo:
- Producto/datos

Aceptacion:
- Se registran eventos anonimizados de:
  - plan generado
  - plan adoptado
  - plan abandonado
  - desviacion vs comportamiento esperado
- Existe dashboard interno de calidad del motor.

Dependencias:
- RC-014

Riesgo:
- Medio

Esfuerzo:
- L

## EPIC-04 Observabilidad de producto y errores

Objetivo:
- Entender errores reales, abandono y conversion.

### RC-014 Instrumentar analytics de producto

Tipo:
- Producto/frontend/backend

Aceptacion:
- Eventos de onboarding, login, plan, checkout, upgrade, workspace switch.
- Se define taxonomia minima de eventos.
- Se evita registrar PII innecesaria.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-015 Instrumentar error tracking de frontend y backend

Tipo:
- Operacion

Aceptacion:
- Excepciones de UI y API llegan a un sistema central.
- Se puede filtrar por release, ruta y workspace.
- Existe alertado para errores P0.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-016 Limpiar `console.*` y unificar logging

Tipo:
- Calidad

Aceptacion:
- Se remueven logs ruidosos de cliente.
- Se centraliza logging de servidor con `logger`.
- Se documenta cuando usar event log vs observability event.

Dependencias:
- RC-014
- RC-015

Riesgo:
- Bajo

Esfuerzo:
- S

## EPIC-05 UX de onboarding, plan y conversion

Objetivo:
- Mejorar activacion y valor percibido.

### RC-017 Rediseñar onboarding con captura de intencion

Tipo:
- UX/producto

Aceptacion:
- Onboarding pregunta objetivo principal del usuario.
- Captura preferencia entre alivio rapido y ahorro total.
- Captura estabilidad de ingresos y tolerancia a riesgo.

Dependencias:
- RC-014

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-018 Dashboard con siguiente mejor accion

Tipo:
- UX/producto

Aceptacion:
- Dashboard muestra una accion prioritaria clara.
- La accion cambia por contexto: pago cercano, deuda critica, plan desactualizado, onboarding incompleto.
- Se mide CTR de esa accion.

Dependencias:
- RC-014
- RC-017

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-019 Revisar claims del landing y pricing

Tipo:
- Marketing/producto

Aceptacion:
- Se eliminan claims sin soporte.
- La propuesta de valor queda centrada en confianza, claridad y deuda-first.
- Pricing explica mejor el valor de PRO.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- S

### RC-020 Checkout y upgrade con mejor justificacion de valor

Tipo:
- Conversion

Aceptacion:
- Antes del checkout, el usuario entiende que gana con PRO.
- Hay comparacion clara free vs pro basada en valor, no solo listado de features.
- Se mide tasa de paso pricing -> checkout -> success.

Dependencias:
- RC-014
- RC-019

Riesgo:
- Bajo

Esfuerzo:
- M

## EPIC-06 Workspaces como feature de producto

Objetivo:
- Convertir multi-tenant en una experiencia clara y no solo tecnica.

### RC-021 Clarificar naming y modelo mental de workspace

Tipo:
- UX

Aceptacion:
- El usuario entiende para que sirve un workspace.
- Se explica que billing y datos estan separados por workspace.
- Se agrega copy contextual en selector y settings.

Dependencias:
- Ninguna

Riesgo:
- Bajo

Esfuerzo:
- S

### RC-022 Resumen por workspace

Tipo:
- Producto

Aceptacion:
- Cada workspace muestra estado de plan, deuda total y suscripcion.
- Cambiar de workspace no genera confusion de contexto.

Dependencias:
- RC-021

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-023 Guardrails al cambiar de workspace

Tipo:
- UX/seguridad

Aceptacion:
- Hay feedback claro al cambiar.
- Los datos visibles y caches se refrescan correctamente.
- Se previenen inconsistencias de UI por contexto previo.

Dependencias:
- RC-022

Riesgo:
- Medio

Esfuerzo:
- M

## EPIC-07 Diferenciadores de coaching y retencion

Objetivo:
- Hacer que RutaCero ayude activamente, no solo calcule.

### RC-024 Nudges contextuales semanales

Tipo:
- Producto/retencion

Aceptacion:
- Se generan recomendaciones semanales segun riesgo de pago, progreso y caja.
- El usuario recibe mensajes accionables y no genericos.
- Existe control para apagar o graduar intensidad.

Dependencias:
- RC-010
- RC-014

Riesgo:
- Medio

Esfuerzo:
- L

### RC-025 Plan semanal de accion

Tipo:
- Producto

Aceptacion:
- El usuario ve una lista corta de acciones para los proximos 7 dias.
- Las acciones se basan en deudas, fechas de pago y flujo de caja.

Dependencias:
- RC-024

Riesgo:
- Bajo

Esfuerzo:
- M

### RC-026 Importacion CSV de deudas y pagos

Tipo:
- Activacion

Aceptacion:
- El usuario puede importar CSV validado.
- Hay preview, errores por fila y confirmacion antes de guardar.

Dependencias:
- RC-006

Riesgo:
- Medio

Esfuerzo:
- L

## Secuencia recomendada por sprint

### Sprint 1

- RC-001
- RC-002
- RC-004
- RC-019

Objetivo:
- Cerrar riesgos visibles y ganar confianza inmediata.

### Sprint 2

- RC-003
- RC-005
- RC-007
- RC-016

Objetivo:
- Subir piso de seguridad y accesibilidad.

### Sprint 3

- RC-006
- RC-008
- RC-009
- RC-012

Objetivo:
- Volver la release pipeline mas confiable.

### Sprint 4

- RC-014
- RC-015
- RC-017
- RC-018

Objetivo:
- Medir comportamiento real y mejorar activacion.

### Sprint 5

- RC-010
- RC-011
- RC-020
- RC-021

Objetivo:
- Mejorar confianza en plan y conversion a PRO.

### Sprint 6

- RC-022
- RC-023
- RC-024
- RC-025
- RC-026

Objetivo:
- Diferenciacion, retencion y madurez de workspaces.

## Riesgos de ejecucion

- Si no se implementa RC-014 temprano, seguiras tomando decisiones de producto a ciegas.
- Si no se implementa RC-008, cualquier mejora del motor seguira siendo opinion y no evidencia.
- Si no se implementa RC-005, seguiras con una accesibilidad "declarada" mas que real.
- Si no se implementa RC-019, el marketing puede seguir prometiendo mas de lo que el producto hoy demuestra.

## KPIs a seguir

- Tasa de onboarding completado
- Tiempo a primer plan generado
- Tasa de adopcion del plan activo
- Conversion Free -> PRO
- Churn por tenant
- Error rate frontend/backend por release
- % de usuarios con score de confianza alto
- Retencion semana 1 y semana 4

## Decision final

No recomiendo abrir trabajo grande de nuevas features antes de cerrar:
- RC-001
- RC-002
- RC-005
- RC-006
- RC-008
- RC-014

Ese es el piso minimo para que el producto crezca sin aumentar deuda y sin debilitar la confianza del usuario.
