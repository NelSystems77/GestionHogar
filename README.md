# GestionHogar 🏠

PWA para administrar el hogar en un solo lugar: finanzas, pagos recurrentes, supermercado y tareas. 100% local (IndexedDB), funciona offline y no requiere cuenta.

## Módulos
- **Inicio**: resumen del mes, pagos por vencer, tareas de hoy, presupuesto de súper y metas.
- **Finanzas**: ingresos/gastos (CRC/USD con tipo de cambio), categorías, metas de ahorro, exportar CSV.
- **Pagos**: obligaciones recurrentes con alertas; al pagar se registra el gasto automáticamente.
- **Súper**: listas de compra, catálogo, tiendas, historial y comparación de precios; al finalizar se registra el gasto.
- **Tareas**: limpieza, mantenimiento, vehículo, etc., con repetición (diaria, semanal, mensual, anual).
- **Ajustes**: moneda base, tipo de cambio, presupuesto, tema, respaldo JSON (exportar/importar).

## Origen
Combina lo mejor de [Finanzas-360](https://github.com/NelSystems77/Finanzas-360) (multi-moneda, metas, CSV), [mi-economia-pwa](https://github.com/NelSystems77/mi-economia-pwa) (IndexedDB, obligaciones, supermercado V2) y [Mi-Supermercado](https://github.com/NelSystems77/Mi-Supermercado) (listas, presupuesto, modo oscuro).

## Desarrollo
Vanilla JS con módulos ES, sin build. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Despliega en GitHub Pages, Vercel o Netlify tal cual. Al cambiar archivos, sube la versión de `CACHE` en `sw.js`.
