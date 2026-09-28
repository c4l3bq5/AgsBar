import { Gtk } from "ags/gtk4"
import Cairo from "gi://cairo"
import { drawSvgPath, drawSvgPaths } from "../lib/svgPath"
import {
  SHELL_CHARGING_MAIN,
  SHELL_CHARGING_TAB,
  RING_CHARGING,
  FULL_CHARGING,
  FILL_X,
  FILL_Y,
  FILL_W,
  FILL_H,
  ICON_MIN_X,
  ICON_MIN_Y,
  ICON_W,
  ICON_H,
  boltPath,
} from "../lib/batteryPaths"

// Tiempo que tarda en ir de vacío a lleno (el regreso tarda lo mismo).
const ANIM_DURATION_MS = 1800
const ANIM_FRAME_MS = 33 // ~30fps

export default function ChargingBatteryIcon() {
  const SIZE = 68
  const SCALE = SIZE / 500

  return (
    <drawingarea
      widthRequest={Math.round(ICON_W * SCALE) + 2}
      heightRequest={Math.round(ICON_H * SCALE) + 2}
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      hexpand={false}
      vexpand={false}
      $={(self: Gtk.DrawingArea) => {
        const t0 = Date.now()

        self.set_draw_func((_area, cr: Cairo.Context) => {
          const elapsed = (Date.now() - t0) % ANIM_DURATION_MS   // sin el "* 2"
const p = elapsed / ANIM_DURATION_MS

          let fr = 1, fg = 1, fb = 1, fa = 1
          try {
            const c = self.get_color()
            fr = c.red; fg = c.green; fb = c.blue; fa = c.alpha
          } catch (_e) { /* usa el fallback blanco */ }

          cr.scale(SCALE, SCALE)
          cr.translate(-ICON_MIN_X, -ICON_MIN_Y)
          cr.setFillRule(Cairo.FillRule.EVEN_ODD)

          cr.newPath()
          drawSvgPaths(cr, [SHELL_CHARGING_MAIN, SHELL_CHARGING_TAB])
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()

          cr.newPath()
          drawSvgPath(cr, RING_CHARGING)
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()

          cr.save()
          cr.newPath()
          drawSvgPath(cr, FULL_CHARGING)
          cr.clip()

          const fillW = FILL_W * p
          cr.newPath()
          cr.rectangle(FILL_X, FILL_Y, fillW, FILL_H)
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()

          const bsize = FILL_H * 0.85
          const bx = FILL_X + (FILL_W - bsize * 0.85) / 2
          const by = FILL_Y + (FILL_H - bsize) / 2

          cr.save()
          cr.newPath()
          cr.rectangle(FILL_X, FILL_Y, fillW, FILL_H)
          cr.clip()
          cr.newPath()
          boltPath(cr, bx, by, bsize)
          cr.setSourceRGBA(0.12, 0.12, 0.16, 1)
          cr.fill()
          cr.restore()

          cr.save()
          cr.newPath()
          cr.rectangle(FILL_X + fillW, FILL_Y, FILL_W - fillW, FILL_H)
          cr.clip()
          cr.newPath()
          boltPath(cr, bx, by, bsize)
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()
          cr.restore()

          cr.restore()
        })

        const intervalId = setInterval(() => {
          self.queue_draw()
        }, ANIM_FRAME_MS) as unknown as number

        self.connect("destroy", () => {
          clearInterval(intervalId)
        })
      }}
    />
  )
}