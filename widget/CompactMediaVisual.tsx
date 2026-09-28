import Gdk from "gi://Gdk"
import GdkPixbuf from "gi://GdkPixbuf"
import { Gtk } from "ags/gtk4"

const COVER_SIZE = 26
const ROTATION_MS = 8000 // una vuelta completa cada 8s, como un vinilo a velocidad lenta

const BAR_COUNT = 5
const BAR_WIDTH = 3
const BAR_GAP = 3
const BAR_MAX_HEIGHT = 18
const BAR_MIN_HEIGHT = 4
const BAR_RETARGET_MS = 220 // cada cuánto se elige una nueva altura objetivo
const BAR_LERP_SPEED = 0.25 // 0-1, qué tan rápido se acerca al objetivo cada frame

function CompactCover({ artUrl }: { artUrl: string | null }) {
  return (
    <drawingarea
      widthRequest={COVER_SIZE}
      heightRequest={COVER_SIZE}
      valign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        let pixbuf: GdkPixbuf.Pixbuf | null = null
        if (artUrl) {
          try {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
              artUrl, COVER_SIZE * 2, COVER_SIZE * 2, false,
            )
          } catch (e) {
            console.error(">>> CompactCover load error:", e)
          }
        }

        const t0 = Date.now()

        self.set_draw_func((_area, cr: any, width: number, height: number) => {
          const cx = width / 2
          const cy = height / 2
          const r = Math.min(width, height) / 2
          const angle = (((Date.now() - t0) % ROTATION_MS) / ROTATION_MS) * 2 * Math.PI

          cr.save()
          cr.newPath()
          cr.arc(cx, cy, r, 0, 2 * Math.PI)
          cr.clip()

          if (pixbuf) {
            const pw = pixbuf.get_width()
            const ph = pixbuf.get_height()
            const scale = (r * 2) / Math.min(pw, ph)

            cr.translate(cx, cy)
            cr.rotate(angle)
            cr.scale(scale, scale)
            Gdk.cairo_set_source_pixbuf(cr, pixbuf, -pw / 2, -ph / 2)
            cr.paint()
          } else {
            cr.setSourceRGBA(1, 1, 1, 0.15)
            cr.fill()
          }

          cr.restore()
        })

        const intervalId = setInterval(() => self.queue_draw(), 33) as unknown as number
        self.connect("destroy", () => clearInterval(intervalId))
      }}
    />
  )
}

const DOT_SIZE= 4

export function CompactBars({ playing }: { playing: boolean }) {
  const width = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP

  return (
    <drawingarea
      widthRequest={width}
      heightRequest={BAR_MAX_HEIGHT}
      valign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        const current = new Array(BAR_COUNT).fill(BAR_MIN_HEIGHT)
        const target = new Array(BAR_COUNT).fill(BAR_MIN_HEIGHT)
        let retargetId: number | null = null
        let drawId: number | null = null

        const retarget = () => {
          for (let i = 0; i < BAR_COUNT; i++) {
            target[i] = BAR_MIN_HEIGHT + Math.random() * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT)
          }
        }

        const drawBars = (cr: any) => {
          cr.setSourceRGBA(1, 1, 1, 0.95)
          for (let i = 0; i < BAR_COUNT; i++) {
            current[i] += (target[i] - current[i]) * BAR_LERP_SPEED
            const x = i * (BAR_WIDTH + BAR_GAP)
            const barHeight = current[i]
            const y = (BAR_MAX_HEIGHT - barHeight) / 2
            const radius = BAR_WIDTH / 2

            cr.newPath()
            cr.arc(x + radius, y + radius, radius, Math.PI, 2 * Math.PI)
            cr.arc(x + radius, y + barHeight - radius, radius, 0, Math.PI)
            cr.closePath()
            cr.fill()
          }
        }

        const drawDots = (cr: any) => {
          cr.setSourceRGBA(1, 1, 1, 0.6)
          const y = BAR_MAX_HEIGHT / 2
          for (let i = 0; i < BAR_COUNT; i++) {
            const x = i * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2
            cr.newPath()
            cr.arc(x, y, DOT_SIZE / 2, 0, 2 * Math.PI)
            cr.fill()
          }
        }

        const startAnimating = () => {
          if (retargetId !== null) return
          retarget()
          retargetId = setInterval(retarget, BAR_RETARGET_MS) as unknown as number
          drawId = setInterval(() => self.queue_draw(), 33) as unknown as number
        }

        const stopAnimating = () => {
          if (retargetId !== null) { clearInterval(retargetId); retargetId = null }
          if (drawId !== null) { clearInterval(drawId); drawId = null }
        }

        self.set_draw_func((_area, cr: any) => {
          if (playing) drawBars(cr)
          else drawDots(cr)
        })

        if (playing) startAnimating()
        self.queue_draw()

        self.connect("destroy", stopAnimating)
      }}
    />
  )
}

export default function CompactMediaVisual({ artUrl, playing }: { artUrl: string | null; playing: boolean }) {
  return (
    <box spacing={6} class="island-compact-media" valign={Gtk.Align.CENTER}>
      <CompactCover artUrl={artUrl} />
      <CompactBars playing={playing} />
    </box>
  )
}
