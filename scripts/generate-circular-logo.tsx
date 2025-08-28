// Script para generar el logo circular de Barna Gestoría
export const generateCircularBarnaLogoSVG = () => {
  const logoSVG = `
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barnaCircularGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2D5A3D;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1F4A2A;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Círculo principal -->
      <circle cx="20" cy="20" r="18" fill="url(#barnaCircularGradient)" stroke="#1F4A2A" strokeWidth="2"/>
      
      <!-- Hoja orgánica en el lado izquierdo -->
      <path d="M12 15 C10 17, 10 20, 12 22 C14 24, 16 23, 17 21 C18 19, 17 17, 15 16 C14 15, 13 15, 12 15 Z" 
            fill="#F0FDF4" opacity="0.9"/>
      
      <!-- Barras de crecimiento (3 barras de diferentes alturas) -->
      <rect x="20" y="22" width="3" height="12" fill="#F0FDF4" opacity="0.9" rx="1"/>
      <rect x="24" y="18" width="3" height="16" fill="#F0FDF4" opacity="0.9" rx="1"/>
      <rect x="28" y="25" width="3" height="9" fill="#F0FDF4" opacity="0.9" rx="1"/>
      
      <!-- Círculo interior sutil para profundidad -->
      <circle cx="20" cy="20" r="16" fill="none" stroke="#1F4A2A" strokeWidth="0.5" opacity="0.3"/>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(logoSVG)}`
}

// Función para crear el logo circular como imagen en canvas
export const createCircularBarnaLogoImage = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 40
  canvas.height = 40
  const ctx = canvas.getContext("2d")

  if (!ctx) return null

  // Fondo circular con gradiente verde oscuro
  const gradient = ctx.createLinearGradient(0, 0, 40, 40)
  gradient.addColorStop(0, "#2D5A3D")
  gradient.addColorStop(1, "#1F4A2A")

  // Círculo principal
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(20, 20, 18, 0, 2 * Math.PI)
  ctx.fill()

  // Borde del círculo
  ctx.strokeStyle = "#1F4A2A"
  ctx.lineWidth = 2
  ctx.stroke()

  // Hoja orgánica (lado izquierdo)
  ctx.fillStyle = "rgba(240, 253, 244, 0.9)"
  ctx.beginPath()
  ctx.moveTo(12, 15)
  ctx.bezierCurveTo(10, 17, 10, 20, 12, 22)
  ctx.bezierCurveTo(14, 24, 16, 23, 17, 21)
  ctx.bezierCurveTo(18, 19, 17, 17, 15, 16)
  ctx.bezierCurveTo(14, 15, 13, 15, 12, 15)
  ctx.closePath()
  ctx.fill()

  // Barras de crecimiento (3 barras)
  ctx.fillStyle = "rgba(240, 253, 244, 0.9)"

  // Barra 1 (más baja)
  ctx.beginPath()
  ctx.roundRect(20, 22, 3, 12, 1)
  ctx.fill()

  // Barra 2 (más alta)
  ctx.beginPath()
  ctx.roundRect(24, 18, 3, 16, 1)
  ctx.fill()

  // Barra 3 (mediana)
  ctx.beginPath()
  ctx.roundRect(28, 25, 3, 9, 1)
  ctx.fill()

  // Círculo interior sutil para profundidad
  ctx.strokeStyle = "rgba(31, 74, 42, 0.3)"
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.arc(20, 20, 16, 0, 2 * Math.PI)
  ctx.stroke()

  return canvas.toDataURL("image/png")
}

// Función para generar un logo circular usando solo CSS/HTML
export const generateCircularCSSLogo = () => {
  return `
    <div style="
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #2D5A3D 0%, #1F4A2A 100%);
      border-radius: 50%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #1F4A2A;
    ">
      <!-- Hoja -->
      <div style="
        position: absolute;
        left: 8px;
        top: 12px;
        width: 8px;
        height: 10px;
        background: rgba(240, 253, 244, 0.9);
        border-radius: 50% 0 50% 50%;
        transform: rotate(-20deg);
      "></div>
      
      <!-- Barras -->
      <div style="
        position: absolute;
        right: 8px;
        bottom: 6px;
        display: flex;
        align-items: end;
        gap: 1px;
      ">
        <div style="width: 2px; height: 8px; background: rgba(240, 253, 244, 0.9); border-radius: 1px;"></div>
        <div style="width: 2px; height: 12px; background: rgba(240, 253, 244, 0.9); border-radius: 1px;"></div>
        <div style="width: 2px; height: 6px; background: rgba(240, 253, 244, 0.9); border-radius: 1px;"></div>
      </div>
    </div>
  `
}
