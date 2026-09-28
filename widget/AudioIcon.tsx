import { Gtk } from "ags/gtk4"
import { createState } from "ags"
import Wp from "gi://AstalWp"

import { drawSvgPaths } from "../lib/svgPath"
import { SPEAKER_BASE, VOLUME_ARCS, MUTED_PATHS, NO_DEVICE_PATHS, VIEWBOX_SIZE } from "../lib/audioPaths"

// AstalWp no viene tipado en los .gir que estás usando (igual que
// AstalNetwork.AccessPoint.activate_finish en Wifiicon.tsx), así que el
// endpoint del parlante se maneja como `any` en vez de forzar un tipo.
type Speaker = any

const SCALE = 30 / VIEWBOX_SIZE

type AudioVisual =
  | { kind: "no-device" }
  | { kind: "muted" }
  | { kind: "level"; level: 1 | 2 | 3 }

// Mismo criterio que strengthLevel() en Wifiicon.tsx, pero acá SÍ puede
// llegar a "0 arcos": ese caso ya no es un nivel, es directamente "muted".
function volumeLevel(volume: number): 1 | 2 | 3 {
  return volume > 0.66 ? 3 : volume > 0.33 ? 2 : 1
}

function resolveAudioVisual(speaker: Speaker | null): AudioVisual {
  if (!speaker) return { kind: "no-device" }
  if (speaker.mute || speaker.volume <= 0) return { kind: "muted" }
  return { kind: "level", level: volumeLevel(speaker.volume) }
}

function volumeQualityLabel(level: 1 | 2 | 3): string {
  switch (level) {
    case 3: return "Alto"
    case 2: return "Medio"
    case 1: return "Bajo"
  }
}

function buildAudioTooltip(v: AudioVisual, speaker: Speaker | null): string {
  switch (v.kind) {
    case "no-device": return "Sin dispositivo de audio"
    case "muted": return "Silenciado"
    case "level": return `${Math.round((speaker?.volume ?? 0) * 100)}% · ${volumeQualityLabel(v.level)}`
  }
}

function parseRgb(css: string): [number, number, number] {
  const m = css.match(/(\d+(?:\.\d+)?)/g)
  if (!m || m.length < 3) return [1, 1, 1]
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255]
}

// ---------------------------------------------------------------------------
// Popover: label + slider, reactivo al parlante activo (que puede cambiar o
// desaparecer en caliente). Mismo patrón map/unmap que WifiPopoverContent.
// ---------------------------------------------------------------------------

type AudioSnapshot = { hasSpeaker: boolean; volume: number; muted: boolean }

function VolumeBar({ wp }: { wp: Wp.Wp }) {
  const WIDTH = 140
  const HEIGHT = 20

  return (
    <drawingarea
      widthRequest={WIDTH}
      heightRequest={HEIGHT}
      halign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        let isSeeking = false
        let previewPercent: number | null = null
        let speaker: Speaker | null = null
        let speakerSignalId: number | null = null

        const percentFromX = (x: number) => {
          const r = 4
          const usable = WIDTH - 2 * r
          return Math.min(1, Math.max(0, (x - r) / usable))
        }

        const applyVolume = (percent: number) => {
          const sp = wp.audio.default_speaker
          if (sp) sp.volume = percent
        }

        self.set_draw_func((_area, cr: any) => {
          const sp = wp.audio.default_speaker
          const actual = sp ? sp.volume : 0
          const percent = previewPercent !== null ? previewPercent : Math.min(1, Math.max(0, actual))

          const y = HEIGHT / 2
          const r = 4

          cr.setLineWidth(2)
          cr.setSourceRGBA(1, 1, 1, 0.3)
          cr.moveTo(r, y)
          cr.lineTo(WIDTH - r, y)
          cr.stroke()

          cr.setSourceRGBA(1, 1, 1, 0.95)
          cr.moveTo(r, y)
          cr.lineTo(r + (WIDTH - 2 * r) * percent, y)
          cr.stroke()

          cr.newPath()
          cr.arc(r + (WIDTH - 2 * r) * percent, y, isSeeking ? r + 1.5 : r, 0, 2 * Math.PI)
          cr.fill()
        })

        const click = new Gtk.GestureClick()
        click.connect("pressed", (_g: unknown, _n: number, x: number) => {
          isSeeking = true
          previewPercent = percentFromX(x)
          applyVolume(previewPercent)
          self.queue_draw()
        })
        click.connect("released", (_g: unknown, _n: number, x: number) => {
          previewPercent = percentFromX(x)
          applyVolume(previewPercent)
          isSeeking = false
          previewPercent = null
          self.queue_draw()
        })
        self.add_controller(click)

        const motion = new Gtk.EventControllerMotion()
        motion.connect("motion", (_c: unknown, x: number) => {
          if (!isSeeking) return
          previewPercent = percentFromX(x)
          applyVolume(previewPercent)
          self.queue_draw()
        })
        self.add_controller(motion)

        // Redibuja si el volumen cambia por fuera (teclas multimedia, otra app)
        const attachSpeaker = () => {
          if (speaker && speakerSignalId !== null) speaker.disconnect(speakerSignalId)
          speaker = wp.audio.default_speaker ?? null
          speakerSignalId = speaker
            ? speaker.connect("notify::volume", () => { if (!isSeeking) self.queue_draw() })
            : null
        }
        attachSpeaker()
        const audioSignalId = wp.audio.connect("notify::default-speaker", attachSpeaker)

        self.connect("destroy", () => {
          if (speaker && speakerSignalId !== null) speaker.disconnect(speakerSignalId)
          wp.audio.disconnect(audioSignalId)
        })
      }}
    />
  )
}

function AudioPopoverContent({ wp }: { wp: Wp.Wp }) {
  const [snapshot, setSnapshot] = createState<AudioSnapshot>({
    hasSpeaker: false,
    volume: 0,
    muted: false,
  })

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      widthRequest={160}
      cssClasses={["audio-popover"]}
      $={(self: Gtk.Box) => {
        let speaker: Speaker | null = null
        let signalIds: number[] = []

        const detach = () => {
          if (speaker) for (const id of signalIds) speaker.disconnect(id)
          signalIds = []
        }

        const refresh = () => {
          speaker = wp.audio.default_speaker ?? null
          setSnapshot({
            hasSpeaker: speaker !== null,
            volume: speaker?.volume ?? 0,
            muted: speaker?.mute ?? false,
          })
        }

        const attach = () => {
          detach()
          refresh()
          if (speaker) {
            for (const prop of ["volume", "mute"]) {
              signalIds.push(speaker.connect(`notify::${prop}`, refresh))
            }
          }
        }

        self.connect("map", attach)
        self.connect("unmap", detach)

        const audioSignalId = wp.audio.connect("notify::default-speaker", () => {
          if (self.get_mapped()) attach()
          else refresh()
        })

        self.connect("destroy", () => {
          detach()
          wp.audio.disconnect(audioSignalId)
        })
      }}
    >
      <label
        cssClasses={["audio-popover-label"]}
        label={snapshot.as((s) =>
          !s.hasSpeaker ? "Sin dispositivo" : s.muted ? "Silenciado" : `${Math.round(s.volume * 100)}%`
        )}
      />
      <VolumeBar wp={wp} />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Ícono principal de la barra
// ---------------------------------------------------------------------------

export default function AudioIcon({ color = "rgb(226,226,230)" }: { color?: string } = {}) {
  const wp = Wp.get_default()
  const [r, g, b] = parseRgb(color)

  return (
    <menubutton cssClasses={["audio-menubutton"]}>
      <drawingarea
        widthRequest={30}
        heightRequest={30}
        valign={Gtk.Align.CENTER}
        $={(self: Gtk.DrawingArea) => {
          let currentVisual: AudioVisual = { kind: "no-device" }
          let speaker: Speaker | null = null
          let speakerSignalIds: number[] = []

          const detachSpeakerSignals = () => {
            if (speaker) for (const id of speakerSignalIds) speaker.disconnect(id)
            speakerSignalIds = []
          }

          const recompute = () => {
            currentVisual = resolveAudioVisual(speaker)
            self.set_tooltip_text(buildAudioTooltip(currentVisual, speaker))
            self.queue_draw()
          }

          const attachSpeaker = (sp: Speaker | null) => {
            detachSpeakerSignals()
            speaker = sp
            if (speaker) {
              for (const prop of ["volume", "mute"]) {
                speakerSignalIds.push(speaker.connect(`notify::${prop}`, recompute))
              }
            }
            recompute()
          }

          attachSpeaker(wp.audio.default_speaker ?? null)
          const audioSignalId = wp.audio.connect("notify::default-speaker", () =>
            attachSpeaker(wp.audio.default_speaker ?? null)
          )

          self.set_draw_func((_area, cr: any, width: number, height: number) => {
            cr.save()
            cr.translate((width - VIEWBOX_SIZE * SCALE) / 2, (height - VIEWBOX_SIZE * SCALE) / 2)
            cr.scale(SCALE, SCALE)
            cr.setSourceRGBA(r, g, b, 1)
            cr.newPath()
            switch (currentVisual.kind) {
              case "no-device":
                drawSvgPaths(cr, NO_DEVICE_PATHS)
                break
              case "muted":
                drawSvgPaths(cr, MUTED_PATHS)
                break
              case "level":
                drawSvgPaths(cr, [...SPEAKER_BASE, ...VOLUME_ARCS.slice(0, currentVisual.level)])
                break
            }
            cr.fill()
            cr.restore()
          })

          self.connect("destroy", () => {
            detachSpeakerSignals()
            wp.audio.disconnect(audioSignalId)
          })
        }}
      />

      <popover cssClasses={["audio-popover-container"]}>
        <AudioPopoverContent wp={wp} />
      </popover>
    </menubutton>
  )
}