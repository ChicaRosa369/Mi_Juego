# Canopy Glide: The Lost Seeds

Aventura de plataformas **3D WebGL** para un jugador, creada con [Three.js](https://threejs.org/) y Vite. El proyecto no utiliza un mockup HTML: la selva, la ardilla, los enemigos, la cámara y las mecánicas se renderizan en tiempo real mediante una escena 3D con iluminación, sombras, niebla, bloom y geometría low-poly procedural.

## Jugar en línea

Cuando finalice el despliegue, el juego se abre directamente desde cualquier navegador moderno en:

**https://chicarosa369.github.io/Mi_Juego/**

## Jugar localmente

```bash
npm install
npm run dev
```

Vite imprimirá la URL local. Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Controles

| Acción | Teclado | Tablet / móvil |
| --- | --- | --- |
| Mover | `WASD` o flechas | Joystick izquierdo transparente |
| Mirar la cámara orbital | Arrastrar sobre la escena | Deslizar en la parte derecha libre |
| Saltar / desplegar patagios | Mantener `Espacio` en el aire | Mantener **SALTAR / PLANEAR** |
| Glide Dash / ataque en picado | `F` | **PICADO** |
| Giro de bellota de corto alcance | `Q` | **GIRO** |
| Lanzar una Bellota Pequeña hacia la cámara | `R` | **LANZAR** |
| Activar el altar | `E` | **ACTIVAR** |
| Ayuda | `P` | Botón `?` superior derecho |

> El juego muestra una indicación para usar la tablet en horizontal. Los controles táctiles usan Pointer Events y no dependen de teclado ni de ratón.

## Mecánicas incluidas

- Ardilla voladora low-poly con carrera, salto, escalada automática en troncos, patagios animados, inercia de vuelo, resistencia y Glide Dash.
- Corrientes térmicas verticales que impulsan el planeo hacia el dosel alto.
- Mundo vertical en tres estratos: suelo, dosel medio y copa alta; una ruta extendida de plataformas, lianas, puentes, térmicas, desvíos y una fortaleza mucho más lejana.
- Tres **Bellotas Solares** coleccionables (los objetivos de misión), frutos que recuperan resistencia y racimos de **Bellotas Pequeñas** que rellenan la munición.
- Vigías mapache que disparan con tirachinas, mapaches pesados protegidos por escudo y el Rey Mapache en su robot de chatarra.
- Combate accesible: el giro estilo arcade derrota vigías cercanos, las Bellotas Pequeñas hacen daño a distancia y un Glide Dash sigue siendo el golpe eficaz para el motor del jefe.
- Cámara de tercera persona suavizada con brazo elástico y detección de obstáculos.
- HUD con 3 corazones, contadores separados de Bellotas Solares y munición, resistencia de planeo, altitud/zona, avisos de misión, barra de jefe e interacción contextual.
- Condición de victoria: recuperar las tres bellotas, destruir el motor del Rey Mapache y activar el altar del Gran Árbol.

## Arquitectura

```text
src/
├── main.js
├── style.css
└── game/
    ├── Game.js       # bucle principal, render y cámara
    ├── World.js      # bioma procedural, plataformas y coleccionables
    ├── Player.js     # controlador de la ardilla y física arcade
    ├── Enemies.js    # IA, proyectiles y jefe
    ├── Input.js      # teclado, joystick, botones y cámara táctil
    ├── HUD.js        # interfaz accesible y estados de misión
    └── Sound.js      # respuesta sonora procedural con Web Audio
```

No se descargan modelos, texturas o audio de terceros durante la partida: los elementos estilizados se construyen de forma procedural dentro de la escena.
