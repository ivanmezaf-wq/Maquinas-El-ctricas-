# Máquinas Eléctricas 3D

Modelos 3D paramétricos y detallados de motores eléctricos, pieza por pieza (hasta la tornillería), con despiece interactivo, menú de piezas y aislamiento de cada componente.

## Motores incluidos

| Motor | Archivo |
|---|---|
| Inducción trifásico jaula de ardilla (TEFC, IEC 132M) | `js/motors/induccion-jaula.js` |
| Inducción de rotor devanado (anillos rozantes) | `js/motors/induccion-rotor-devanado.js` |
| Síncrono de polos salientes (devanado amortiguador) | `js/motors/sincrono.js` |
| CC de campo devanado (compound, con interpolos) | `js/motors/cc-campo-devanado.js` |
| CC de imán permanente (PMDC) | `js/motors/cc-iman-permanente.js` |
| CC sin escobillas (BLDC, sensores Hall) | `js/motors/bldc.js` |

## Uso

Es un sitio estático (HTML + módulos ES, three.js desde CDN). Hay que servirlo por HTTP; abrir `index.html` con doble clic no funciona porque el navegador bloquea los módulos en `file://`.

```bash
python serve.py
```

Abre http://localhost:5173 en el navegador. `serve.py` desactiva la caché para que cada cambio se vea al recargar. También funciona tal cual en GitHub Pages.

### Simulación

Pestaña **Simulación** del panel derecho (o botón **▶ Arrancar**):

- **Frecuencia** 50 Hz (380 V) o 60 Hz (440 V) para los motores de CA; en los de CC no aplica.
- **Carga** de 0 a 150 % del par nominal, de par constante o cuadrático (bomba/ventilador).
- Mando propio de cada motor: reóstato rotórico, corriente de excitación, reóstato de campo, tensión PWM o ciclo de trabajo del inversor.
- Integración de `J·dω/dt = Te(ω) − TL − Tf`: el rotor 3D gira exactamente a la velocidad calculada, con escala de tiempo ajustable (tiempo real o cámara lenta).
- Lecturas: velocidad síncrona y real, deslizamiento, par, potencias, rendimiento, factor de potencia y la corriente de cada bobina comparada con su capacidad térmica (densidad de corriente admisible).
- Gráficas par–velocidad (con el punto de operación) y velocidad–tiempo (arranque y frenado).

Las ecuaciones de cada máquina están en `js/app/sim.js`.

### Visor

- **Arrastrar**: girar · **clic derecho**: desplazar · **rueda**: zoom hacia el cursor · **doble clic**: centra la órbita en ese punto.
- **Despiece** (tecla `E`) y deslizador de separación.
- **Menú de piezas** (derecha): clic en una pieza para aislarla (el resto del motor desaparece); `Esc` o "Mostrar todo" para volver. El ojo oculta o muestra piezas individuales.
- **Cortes**: tres planos de sección independientes (vertical, horizontal y transversal) con posición ajustable, botón para invertir el lado y "Cuarto de corte". Las secciones se ven macizas: cada pieza cortada se rellena con su color (tapas por buffer de stencil, `js/app/caps.js`).

## Estructura

```
index.html            catálogo en grid con vistas previas 3D en vivo
viewer.html           visor de un motor (?m=<id>)
css/styles.css
js/core/geo.js        generadores: chapas ranuradas, devanados, tornillos, rodamientos, colectores…
js/core/materials.js  materiales PBR
js/core/model.js      ensamble: piezas, categorías y vectores de despiece
js/motors/common.js   carcasa, estator, escudos, ventilador y caja de bornes de motores CA
js/motors/*.js        un archivo por motor (exporta `info` y `build`)
js/app/               grid, visor y catálogo
```

Para agregar un motor: crea `js/motors/<nombre>.js` exportando `info` y `build()` y regístralo en `js/app/catalog.js`.

Unidades en milímetros. El eje del motor es Z (LA = +Z, LOA = −Z).
