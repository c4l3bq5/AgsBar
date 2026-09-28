import app from "ags/gtk4/app"
import ChargingBatteryIcon from "./ChargingBatteryIcon"
import { Astal, Gtk } from "ags/gtk4"
import { With, createState } from "ags"
import CompactMediaVisual from "./CompactMediaVisual"
import Cairo from "gi://cairo"
import GLib from "gi://GLib"
import { CompactBars } from "./CompactMediaVisual"
import BatteryAlertIcon from "./BatteryAlertIcon"
import Mpris from "gi://AstalMpris"
import {
  islandState,
  isSwitchingSlide,
  islandActive,
  isExpanded,
  setHovered,
  setIslandState,
  focusPlayer,
  focusIndexRelative,
  dismissPlayer,
  batteryAlert,
  IslandState,
  MediaPlayerInfo,
} from "../lib/islandState"

import ControlIcon from "./ControlIcon"
import {
  PLAY_PATH, PAUSE_PATH_1, PAUSE_PATH_2,
  NEXT_PATH, SHUFFLE_PATH_1, SHUFFLE_PATH_2, SHUFFLE_PATH_3,
  CLOSE_PATH,
} from "../lib/controlPaths"

function CompactContent({ state }: { state: IslandState }) {
  switch (state.kind) {
    case "charging":
      return <label class="island-compact-icon" label="⚡" />
    case "media": {
  const info = state.players[state.focusedIndex]
  return <CompactMediaVisual artUrl={info?.artUrl ?? null} playing={info?.playing ?? false} />
}
    default:
      return <box />
  }
}

function PlayPauseButton({ info }: { info: MediaPlayerInfo }) {
  const [isBtnHovered, setBtnHovered] = createState(false)

  return (
    <button
      class="island-btn island-btn-playpause"
      onClicked={() => {
        if (!info.player.can_control) return
        try {
          info.playing ? info.player.pause() : info.player.play()
        } catch (e) { console.error(">>> play/pause:", e) }
      }}
      $={(self: Gtk.Button) => {
        const motion = new Gtk.EventControllerMotion()
        motion.connect("enter", () => setBtnHovered(true))
        motion.connect("leave", () => setBtnHovered(false))
        self.add_controller(motion)
      }}
    >
      <box>
        <box visible={isBtnHovered.as((h) => !h)}>
          <CompactBars playing={info.playing} />
        </box>
        <box visible={isBtnHovered}>
          {info.playing
            ? <ControlIcon paths={[PAUSE_PATH_1, PAUSE_PATH_2]} size={22} />
            : <ControlIcon paths={[PLAY_PATH]} size={22} />}
        </box>
      </box>
    </button>
  )
}

function MediaControls({ info }: { info: MediaPlayerInfo }) {
  return (
    <box spacing={4} valign={Gtk.Align.CENTER}>
      <button
        class="island-btn"
        onClicked={() => {
          if (!info.player.can_go_previous) return
          try { info.player.previous() } catch (e) { console.error(">>> previous:", e) }
        }}
      >
        <ControlIcon paths={[NEXT_PATH]} size={20} />
      </button>

      <PlayPauseButton info={info} />

      <button
        class="island-btn"
        onClicked={() => {
          if (!info.player.can_go_next) return
          try { info.player.next() } catch (e) { console.error(">>> next:", e) }
        }}
      >
        <ControlIcon paths={[NEXT_PATH]} flipX size={20} />
      </button>
      <button
        class="island-btn"
        onClicked={() => {
          const next = info.shuffle === Mpris.Shuffle.ON
            ? Mpris.Shuffle.OFF
            : Mpris.Shuffle.ON
          try {
            info.player.set_shuffle_status(next)
            const current = islandState()
            if (current.kind === "media") {
              const players = current.players.map((p, i) =>
                i === current.focusedIndex ? { ...p, shuffle: next } : p
              )
              setIslandState({ ...current, players })
            }
          } catch (e) { console.error(">>> shuffle:", e) }
        }}
      >
        <ControlIcon
          paths={[SHUFFLE_PATH_1, SHUFFLE_PATH_2, SHUFFLE_PATH_3]}
          size={18}
          color={info.shuffle === Mpris.Shuffle.ON ? [0.4, 0.9, 0.5] : [1, 1, 1]}
        />
      </button>
    </box>
  )
}

function TrackProgress({ info }: { info: MediaPlayerInfo }) {
  const WIDTH = 200
  const HEIGHT = 20

  return (
    <drawingarea
      widthRequest={WIDTH}
      heightRequest={HEIGHT}
      halign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        let isSeeking = false
        let previewPercent: number | null = null

        const percentFromX = (x: number) => {
          const r = 4
          const usable = WIDTH - 2 * r
          return Math.min(1, Math.max(0, (x - r) / usable))
        }

        const seekTo = (percent: number) => {
          const length = info.player.length ?? 0
          if (length <= 0) return
          try {
            if (!info.player.can_seek) return


            info.player.set_position(percent * length)
          } catch (e) {
            console.error(">>> seek error:", e)
          }
        }

        self.set_draw_func((_area, cr: any) => {
          const length = info.player.length ?? 0
          const position = info.player.position ?? 0
          const percent = previewPercent !== null
            ? previewPercent
            : (length > 0 ? Math.min(1, Math.max(0, position / length)) : 0)

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
          self.queue_draw()
        })
        click.connect("released", (_g: unknown, _n: number, x: number) => {
          const percent = percentFromX(x)
          seekTo(percent)
          isSeeking = false
          previewPercent = null
          self.queue_draw()
        })
        self.add_controller(click)

        const motion = new Gtk.EventControllerMotion()
        motion.connect("motion", (_c: unknown, x: number) => {
          if (!isSeeking) return
          previewPercent = percentFromX(x)
          self.queue_draw()
        })
        self.add_controller(motion)

        const intervalId = setInterval(() => {
          if (!isSeeking) self.queue_draw()
        }, 1000) as unknown as number
        self.connect("destroy", () => clearInterval(intervalId))
      }}
    />
  )
}

function MediaDots({ players, focusedIndex }: { players: MediaPlayerInfo[]; focusedIndex: number }) {
  if (players.length < 2) return <box />

  const DOT_SIZE = 6
  const DOT_GAP = 12
  const count = players.length
  const width = DOT_GAP * count
  const height = DOT_SIZE + 6

  return (
    <drawingarea
      widthRequest={width}
      heightRequest={height}
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        self.set_draw_func((_area, cr: any) => {
          const r = DOT_SIZE / 2
          for (let i = 0; i < count; i++) {
            const cx = DOT_GAP * i + DOT_GAP / 2
            const cy = height / 2
            cr.newPath()
            cr.arc(cx, cy, r, 0, 2 * Math.PI)
            if (i === focusedIndex) {
              cr.setSourceRGBA(1, 1, 1, 0.95)
              cr.fill()
            } else {
              cr.setSourceRGBA(1, 1, 1, 0.5)
              cr.setLineWidth(1.3)
              cr.stroke()
            }
          }
        })

        const click = new Gtk.GestureClick()
        click.connect("released", (_g: unknown, _n: number, x: number) => {
          const idx = Math.floor(x / DOT_GAP)
          if (idx >= 0 && idx < count) focusPlayer(players[idx].player)
        })
        self.add_controller(click)
      }}
    />
  )
}

function ExpandedContent({ state }: { state: IslandState }) {
  switch (state.kind) {
    case "charging": {
  const alertLevel = batteryAlert()

  if (alertLevel !== null) {
    const color: [number, number, number] =
      alertLevel === 20 ? [0.95, 0.75, 0.2] : [0.95, 0.3, 0.3]

    return (
      <box
        class="island-content island-battery-alert"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
        halign={Gtk.Align.CENTER}
      >
        <BatteryAlertIcon percentage={state.percentage} color={color} />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
          <label
            label={`${Math.round(state.percentage * 100)}%`}
            cssClasses={["island-title"]}
          />
          {alertLevel === 5 && (
            <label label="¡Carga la batería ahora!" cssClasses={["island-alert-msg"]} />
          )}
        </box>
      </box>
    )
  }

  return (
    <box
      class="island-content island-charging"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      halign={Gtk.Align.CENTER}
    >
      <ChargingBatteryIcon />
      <label label={`Cargando · ${Math.round(state.percentage * 100)}%`} cssClasses={["island-title"]} />
    </box>
  )
}
    case "media": {
      const info = state.players[state.focusedIndex]
      if (!info) return <box />
      const hasMultiple = state.players.length >= 2
      return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            cssClasses={isSwitchingSlide.as((sw) =>
              sw ? ["island-content", "island-media", "switching"] : ["island-content", "island-media"]
            )}
            $={(self: Gtk.Box) => {
              const scroll = new Gtk.EventControllerScroll({
                flags: Gtk.EventControllerScrollFlags.BOTH_AXES,
              })
              scroll.connect("scroll", (_ctrl: unknown, dx: number, dy: number) => {
                const now = Date.now()
                if (now - lastSlideSwitchAt < SLIDE_SWITCH_COOLDOWN_MS) return true
                const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
                const THRESHOLD = 2.5
                if (Math.abs(delta) < THRESHOLD) return true
                lastSlideSwitchAt = now
                if (delta > 0) focusIndexRelative(1)
                else focusIndexRelative(-1)
                return true
              })
              self.add_controller(scroll)
            }}
          >
            <box spacing={10}>
              {hasMultiple && (
                <button class="island-nav-arrow" valign={Gtk.Align.CENTER} onClicked={() => focusIndexRelative(-1)}>
                  <label label="‹" />
                </button>
              )}

              {info.artUrl ? (
                <image file={info.artUrl} class="island-cover" pixelSize={48} />
              ) : (
                <box class="island-cover island-cover-fallback" widthRequest={48} heightRequest={48} />
              )}
              <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
                <box spacing={6}>
                  <label
                    label={info.title}
                    maxWidthChars={22}
                    ellipsize={3}
                    hexpand
                    halign={Gtk.Align.START}
                    cssClasses={["island-title"]}
                  />
                  <button
                    class="island-close-btn"
                    valign={Gtk.Align.CENTER}
                    tooltipText="Cerrar"
                    onClicked={() => dismissPlayer(info.player)}
                  >
                    <ControlIcon paths={[CLOSE_PATH]} size={14} />
                  </button>
                </box>
                <label
                  label={info.artist}
                  maxWidthChars={22}
                  ellipsize={3}
                  halign={Gtk.Align.START}
                  cssClasses={["island-artist"]}
                />
              </box>

              {hasMultiple && (
                <button class="island-nav-arrow" valign={Gtk.Align.CENTER} onClicked={() => focusIndexRelative(1)}>
                  <label label="›" />
                </button>
              )}
            </box>

            <TrackProgress info={info} />

            <box halign={Gtk.Align.CENTER}>
              <MediaControls info={info} />
            </box>
          </box>
          <MediaDots players={state.players} focusedIndex={state.focusedIndex} />
        </box>
      )
    }
    default:
      return <box />
  }
}

let inputShapeTimeout: number | null = null
let lastSlideSwitchAt = 0
const SLIDE_SWITCH_COOLDOWN_MS = 500

function scheduleInputShapeUpdate(win: Gtk.Window, box: Gtk.Widget, active: boolean) {
  if (inputShapeTimeout !== null) {
    clearTimeout(inputShapeTimeout)
    inputShapeTimeout = null
  }

  if (!active) {
    try {
      const surface = win.get_surface()
      if (surface) surface.set_input_region(new Cairo.Region())
    } catch (e) {
      console.error(">>> updateInputShape error:", e)
    }
    return
  }

  inputShapeTimeout = setTimeout(() => {
    inputShapeTimeout = null
    try {
      const surface = win.get_surface()
      if (!surface) return
      const [ok, rect] = box.compute_bounds(win)
      if (!ok) return

      const PADDING = 6
      const region = new Cairo.Region()
      region.unionRectangle(new Cairo.RectangleInt({
        x: Math.floor(rect.get_x()) - PADDING,
        y: Math.floor(rect.get_y()) - PADDING,
        width: Math.ceil(rect.get_width()) + PADDING * 2,
        height: Math.ceil(rect.get_height()) + PADDING * 2,
      }))
      surface.set_input_region(region)
    } catch (e) {
      console.error(">>> updateInputShape error:", e)
    }
  }, 100) as unknown as number
}

export default function DynamicIsland() {
  let boxRef: Gtk.Box

  return (
    <window
      visible
      name="dynamic-island"
      class="dynamic-island-window"
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      application={app}
      widthRequest={340}
      heightRequest={160}
      $={(self: Gtk.Window) => {
        const trigger = () => scheduleInputShapeUpdate(self, boxRef, islandActive.get())
        islandActive.subscribe(trigger)
        isExpanded.subscribe(trigger)
        self.connect("realize", trigger)
      }}
    >
      <revealer
        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
        transitionDuration={200}
        revealChild={islandActive}
      >
        <box
          cssClasses={isExpanded.as((e) => (e ? ["dynamic-island", "expanded"] : ["dynamic-island"]))}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.START}
          $={(self: Gtk.Box) => {
            boxRef = self
            const motion = new Gtk.EventControllerMotion()
            motion.connect("enter", () => setHovered(true))
            motion.connect("leave", () => setHovered(false))
            self.add_controller(motion)
          }}
        >
          <box visible={isExpanded.as((e) => !e)}>
            <With value={islandState}>
              {(s: IslandState) => <CompactContent state={s} />}
            </With>
          </box>
          <box visible={isExpanded}>
            <With value={islandState}>
              {(s: IslandState) => <ExpandedContent state={s} />}
            </With>
          </box>
        </box>
      </revealer>
    </window>
  )
}

