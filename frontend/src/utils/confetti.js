import confetti from 'canvas-confetti'

export function celebratePredictionSaved() {
  const duration = 900
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 8,
      angle: 60,
      spread: 65,
      origin: { x: 0 },
      colors: ['#22c55e', '#eab308', '#3b82f6', '#ef4444'],
    })
    confetti({
      particleCount: 8,
      angle: 120,
      spread: 65,
      origin: { x: 1 },
      colors: ['#22c55e', '#eab308', '#3b82f6', '#ef4444'],
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}
