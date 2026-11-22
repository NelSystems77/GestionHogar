# GestionHogar 🏠

PWA para administrar el hogar en un solo lugar: finanzas, pagos recurrentes, supermercado y tareas. 100% local (IndexedDB), funciona offline y no requiere cuenta.

## Módulos
- **Inicio**: resumen del mes, pagos por vencer, tareas de hoy, presupuesto de súper y metas.
- **Finanzas**: ingresos/gastos (CRC/USD con tipo de cambio), categorías, metas de ahorro, exportar CSV y **reporte PDF con gráficos** (dona por categoría e ingresos vs gastos de 6 meses).
- **Pagos**: obligaciones recurrentes con alertas; al pagar se registra el gasto automáticamente.
- **Súper** (modo compra): listas pre-cargadas (semanal, quincenal, mensual, express, limpieza, frutas y verduras), plantillas propias y repetir la última compra. Cada artículo se edita (cantidad con +/−, unidad, precio). Un buscador siempre visible encuentra productos de la lista o del catálogo (también por voz); al comprarlos desaparecen de «Faltan» y pasan a «Comprados», con contador de comprados vs faltantes y totales en vivo. Al finalizar se registra el gasto y los pendientes pueden pasar a una nueva lista. Exporta la lista a PDF con gráfico.
- **Tareas**: limpieza, mantenimiento, vehículo, etc., con repetición (diaria, semanal, mensual, anual).
- **Accesibilidad**: botones **A−/A+** siempre visibles, tamaños Normal a Extra grande (90%–200%), ajuste fino, alto contraste y **modo fácil** para adultos mayores.
- **Ajustes**: moneda base, tipo de cambio, presupuesto, tema, respaldo JSON (exportar/importar).

## Origen
Combina lo mejor de [Finanzas-360](https://github.com/NelSystems77/Finanzas-360) (multi-moneda, metas, CSV), [mi-economia-pwa](https://github.com/NelSystems77/mi-economia-pwa) (IndexedDB, obligaciones, supermercado V2) y [Mi-Supermercado](https://github.com/NelSystems77/Mi-Supermercado) (listas, presupuesto, modo oscuro).

## Desarrollo
Vanilla JS con módulos ES, sin build. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Despliega en GitHub Pages, Vercel o Netlify tal cual. Al cambiar archivos, sube la versión de `CACHE` en `sw.js`.
