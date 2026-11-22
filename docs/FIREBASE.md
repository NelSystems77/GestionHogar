# Encuesta de interés con Firebase

La app incluye una encuesta voluntaria y anónima («¿Te gustaría una versión Pro?»). Se muestra con un ícono 💬 en la barra superior (hasta que el usuario responda), una tarjeta en el inicio a partir del 3.er día de uso y otra en Ajustes. Las respuestas se guardan en
Firestore, una por dispositivo. No se envía ningún dato de la app (montos, listas, productos…).

## Configuración (una sola vez)
1. **Firestore:** en https://console.firebase.google.com/project/gestionhogar-a4488/firestore crea la base de datos
   (modo producción, región cercana, por ejemplo `us-east1`).
2. **Reglas:** pestaña *Reglas* → pega el contenido de `firestore.rules` → *Publicar*.
3. **App web:** Configuración del proyecto (⚙️) → *General* → *Tus apps* → *</> Web* → registra la app (sin Hosting).
   Copia el valor de `apiKey` y pégalo en `js/firebase-config.js`.
4. **Restricción de la clave (recomendado):** en Google Cloud Console → *APIs y servicios* → *Credenciales* → la clave
   «Browser key» → *Restricciones de aplicaciones* → *Sitios web* → `https://nelsystems77.github.io/*`
   y en *Restricciones de API* deja solo *Cloud Firestore API*.

> La `apiKey` de Firebase no es un secreto: va en el navegador por diseño. Lo que protege los datos son las reglas.

## Ver los resultados
Firestore → colección `interest`. Cada documento es un voto (`answer`: si / tal_vez / no; `price`: na / lt2 / 2a5 / gt5).
Para contar usa el *Generador de consultas* con la agregación **Count**, filtrando por `answer`.
