# Hoja de ruta de comercialización

## Posicionamiento
Juego de fiesta en persona, de 2 a 8 personas, **un solo móvil**, sin registros ni conexión. Competencia directa: juegos de mesa de "adivinar el espectro". Ventaja: instantáneo (sin instalar si se quiere), gratis para probar, sin anuncios durante el juego.

## Fases
| Fase | Qué | Criterio de salida |
|---|---|---|
| 0. Pulido (2 sem) | Arte final de icono y capturas, revisión nativa de EN, prueba en 10 móviles reales, Lighthouse | Sin bugs críticos; Lighthouse ≥ 95 |
| 1. Beta web (2 sem) | PWA pública con enlace compartible; analítica anónima opt-in; 50–100 jugadores | ≥ 60 % completan una partida; retención D7 ≥ 15 % |
| 2. Lanzamiento tiendas (4 sem) | Android (Play) primero, iOS después con Capacitor | Aprobación sin rechazos; valoración ≥ 4,5 |
| 3. Monetización | Activar `MONETIZATION_ENABLED`, packs premium y quitar anuncios | Conversión ≥ 3 % de usuarios activos |
| 4. Contenido (continuo) | Un pack nuevo cada 4–6 semanas, ediciones de temporada | Compras recurrentes por pack |

## Precios sugeridos (compra única, sin suscripción)
| Producto | Precio | Contenido |
|---|---|---|
| Gratis | 0 € | General, Familia, Fiesta (120 categorías), modo 2–8 jugadores, categorías propias |
| Packs premium | 2,99 € | Cine y series, Mundo y curiosidades, Adultos 18+ (118 categorías) y todos los futuros packs del año |
| Quitar anuncios | 1,99 € | Solo afecta a anuncios en el menú; nunca hay anuncios al adivinar ni al revelar |
| Pack suelto (futuro) | 0,99–1,49 € | Packs temáticos independientes |

Regla de producto inviolable: **sin anuncios en las fases `guess` y `reveal`** (la capa `canShowAds` solo admite `setup`). Los anuncios, si se activan, serán un banner discreto en el menú o un intersticial al terminar una partida, nunca antes de una ronda.

## Packs de contenido futuros
Deportes · Música por décadas · Viajes y ciudades · Comida y cocina · Trabajo y oficina · Parejas · Terror · Navidad · Verano · Gaming · Fútbol (por país) · Packs de marca/colaboraciones con creadores. Idiomas adicionales: catalán, portugués, francés, italiano, alemán (cada uno con packs adaptados, no traducidos).

## Funciones candidatas
Modo equipos con marcador compartido · Temporizador opcional de pista · Estadísticas personales locales · Logros ligeros · Compartir resultado como imagen · Modo "bola extra" (2.º intento) · Accesibilidad: voz que lee la fase.

## Métricas a medir (anónimas y con consentimiento)
| Métrica | Por qué | Evento |
|---|---|---|
| Partidas iniciadas / terminadas | Embudo principal | `game_start`, `game_end` |
| Rondas por partida y duración | Engagement | `round_end` |
| % que completan el tutorial | Calidad del onboarding | `tutorial_done` |
| Packs más usados | Qué producir | `pack_selected` |
| Distribución de puntos (0/2/3/4) | Equilibrio de dificultad | `round_end.points` |
| Retención D1/D7/D30 | Salud del producto | Tiendas / PWA |
| Conversión a premium, ARPPU, reembolsos | Negocio | Panel de tiendas |
| Valoración y reseñas | Reputación | Tiendas |

Los eventos solo llevan números/booleanos (nunca nombres ni textos). Sin endpoint configurado no se envía nada.

## Riesgos
- **Contenido 18+:** mantener opt-in, clasificación coherente y sin promoción en la ficha principal.
- **Copias del formato:** diferenciar con marca, contenido propio y calidad de ejecución.
- **Retención:** juego social ocasional; apoyarse en packs nuevos y modo fiesta.
