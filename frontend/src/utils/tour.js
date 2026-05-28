import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Starts the onboarding tour.
 * @param {{ onDone?: () => void }} options
 */
export function startTour({ onDone } = {}) {
  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Atrás',
    doneBtnText: '¡Listo!',
    overlayColor: 'rgba(0,0,0,0.75)',
    smoothScroll: true,
    scrollIntoViewOptions: { behavior: 'smooth', block: 'center', inline: 'center' },
    onHighlightStarted: (element) => {
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    },
    popoverClass: 'tour-popover',
    steps: [
      {
        popover: {
          title: '¡Bienvenido al Concurso del Mundial 2026! 🏆',
          description:
            'Este es un juego de pronósticos. Predecís los resultados de los 104 partidos del Mundial, elegís al campeón, al goleador y más — y competís con amigos para ver quién sabe más de fútbol.',
          side: 'over',
          align: 'center',
        },
      },
      {
        element: '#tour-partidos',
        popover: {
          title: '⚽ Partidos',
          description:
            'Aquí predecís el resultado de cada partido <strong>antes de que empiece</strong>. Podés ganar hasta 5 puntos por partido si acertás el marcador exacto.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-grupos',
        popover: {
          title: '👥 Mis Grupos',
          description:
            'Creá un grupo privado o unite al de tus amigos para tener una tabla de posiciones propia y competir entre ustedes.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-ranking',
        popover: {
          title: '🏅 Ranking',
          description:
            'Seguí tu posición en el ranking global y mirá cómo van los demás participantes a medida que avanzan los partidos.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-torneo',
        popover: {
          title: '⭐ Torneo',
          description:
            'Antes de que arranque el torneo podés predecir el campeón, el goleador, el asistidor y más. ¡Estos pronósticos valen muchos puntos!',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-scoring',
        popover: {
          title: '📊 Sistema de puntuación',
          description:
            'Repasá cómo se puntúa. Un pronóstico perfecto (resultado exacto) vale 5 puntos. Los pronósticos del torneo pueden darte hasta 50 puntos extra.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-install',
        popover: {
          title: '📲 Instalá la app',
          description:
            'Instalalá a tu pantalla de inicio para acceder más rápido, igual que una app normal. Tocá <strong>Instalar app</strong> y seguí los pasos de tu navegador.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#nav-partidos',
        popover: {
          title: '⚽ Pestaña Predicciones',
          description:
            'Desde acá accedés a todos los partidos del torneo para hacer y ver tus pronósticos.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#nav-grupos',
        popover: {
          title: '👥 Pestaña Grupos',
          description:
            'Acá creás grupos privados o te unís al de tus amigos con un código de invitación.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#nav-inicio',
        popover: {
          title: '🏠 Pestaña Inicio',
          description:
            'Tu pantalla principal: resumen de pendientes, accesos rápidos y el sistema de puntuación.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#nav-ranking',
        popover: {
          title: '🏅 Pestaña Ranking',
          description:
            'La tabla de posiciones global. Ves tu posición y la de todos los participantes.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#nav-perfil',
        popover: {
          title: '👤 Pestaña Perfil',
          description:
            'Tu perfil: nombre, avatar, cambio de contraseña y estadísticas personales. ¡Ya sabés todo, a jugar!',
          side: 'top',
          align: 'center',
        },
      },
    ],
    onDestroyed: () => {
      localStorage.setItem('tour_done', '1')
      onDone?.()
    },
  })
  driverObj.drive()
}
