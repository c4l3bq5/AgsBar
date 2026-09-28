

type Point = { x: number; y: number }

const TOKEN_RE = /[MLHVCSZmlhvcsz]|-?\d*\.\d+(?:[eE][-+]?\d+)?|-?\d+(?:[eE][-+]?\d+)?/g

function tokenize(d: string): string[] {
  return d.match(TOKEN_RE) ?? []
}

export function drawSvgPath(cr: any, d: string) {
  const tokens = tokenize(d)
  let i = 0
  let cx = 0, cy = 0
  let startX = 0, startY = 0
  let lastCtrl: Point | null = null
  let lastCmd = ""

  const num = () => parseFloat(tokens[i++])

  while (i < tokens.length) {
    const tok = tokens[i]
    let cmd: string
    if (/^[MLHVCSZmlhvcsz]$/.test(tok)) {
      cmd = tok
      i++
    } else {
      cmd = lastCmd
    }

    switch (cmd) {
      case "M":
        cx = num(); cy = num()
        startX = cx; startY = cy
        cr.moveTo(cx, cy)
        lastCmd = "L"
        break
      case "m":
        cx += num(); cy += num()
        startX = cx; startY = cy
        cr.moveTo(cx, cy)
        lastCmd = "l"
        break
      case "L":
        cx = num(); cy = num()
        cr.lineTo(cx, cy)
        lastCmd = "L"
        break
      case "l":
        cx += num(); cy += num()
        cr.lineTo(cx, cy)
        lastCmd = "l"
        break
      case "H":
        cx = num()
        cr.lineTo(cx, cy)
        lastCmd = "H"
        break
      case "h":
        cx += num()
        cr.lineTo(cx, cy)
        lastCmd = "h"
        break
      case "V":
        cy = num()
        cr.lineTo(cx, cy)
        lastCmd = "V"
        break
      case "v":
        cy += num()
        cr.lineTo(cx, cy)
        lastCmd = "v"
        break
      case "C": {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
        cr.curveTo(x1, y1, x2, y2, x, y)
        lastCtrl = { x: x2, y: y2 }
        cx = x; cy = y
        lastCmd = "C"
        break
      }
      case "c": {
        const x1 = cx + num(), y1 = cy + num()
        const x2 = cx + num(), y2 = cy + num()
        const x = cx + num(), y = cy + num()
        cr.curveTo(x1, y1, x2, y2, x, y)
        lastCtrl = { x: x2, y: y2 }
        cx = x; cy = y
        lastCmd = "c"
        break
      }
      case "S": {
        const x2 = num(), y2 = num(), x = num(), y = num()
        const x1 = lastCtrl ? 2 * cx - lastCtrl.x : cx
        const y1 = lastCtrl ? 2 * cy - lastCtrl.y : cy
        cr.curveTo(x1, y1, x2, y2, x, y)
        lastCtrl = { x: x2, y: y2 }
        cx = x; cy = y
        lastCmd = "S"
        break
      }
      case "s": {
        const x2 = cx + num(), y2 = cy + num()
        const x = cx + num(), y = cy + num()
        const x1 = lastCtrl ? 2 * cx - lastCtrl.x : cx
        const y1 = lastCtrl ? 2 * cy - lastCtrl.y : cy
        cr.curveTo(x1, y1, x2, y2, x, y)
        lastCtrl = { x: x2, y: y2 }
        cx = x; cy = y
        lastCmd = "s"
        break
      }
      case "Z":
      case "z":
        cr.closePath()
        cx = startX; cy = startY
        lastCtrl = null
        lastCmd = cmd
        break
      default:
        i = tokens.length
    }
  }
}

export function drawSvgPaths(cr: any, paths: string[]) {
  for (const d of paths) drawSvgPath(cr, d)
}

