import { Gtk } from "ags/gtk4"
import Cairo from "gi://cairo"
import { drawSvgPath } from "../lib/svgPath"
import {
  SHELL_NORMAL,
  RING_NORMAL,
  FULL_NORMAL,
  FILL_X,
  FILL_Y,
  FILL_W,
  FILL_H,
  ICON_MIN_X,
  ICON_MIN_Y,
  ICON_W,
  ICON_H,
} from "../lib/batteryPaths"

export default function BatteryAlertIcon({
  percentage,
  color,
}: {
  percentage: number
  color: [number, number, number]
}) {
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
        self.set_draw_func((_area, cr: Cairo.Context) => {
          let fr = 1, fg = 1, fb = 1, fa = 1
          try {
            const c = self.get_color()
            fr = c.red; fg = c.green; fb = c.blue; fa = c.alpha
          } catch (_e) {  }

          cr.scale(SCALE, SCALE)
          cr.translate(-ICON_MIN_X, -ICON_MIN_Y)
          cr.setFillRule(Cairo.FillRule.EVEN_ODD)

          cr.newPath()
          drawSvgPath(cr, SHELL_NORMAL)
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()

          cr.newPath()
          drawSvgPath(cr, RING_NORMAL)
          cr.setSourceRGBA(fr, fg, fb, fa)
          cr.fill()

          cr.save()
          cr.newPath()
          drawSvgPath(cr, FULL_NORMAL)
          cr.clip()

          const p = Math.max(0, Math.min(1, percentage))
          const fillW = FILL_W * p
          const [r, g, b] = color

          cr.newPath()
          cr.rectangle(FILL_X, FILL_Y, fillW, FILL_H)
          cr.setSourceRGBA(r, g, b, 1)
          cr.fill()

          cr.restore()
        })
      }}
    />
  )
}

