import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "ags"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { drawSvgPaths } from "../lib/svgPath"
import { VIEWBOX_SIZE } from "../lib/controlPaths"
import {
  LOCK_PATH,
  SUSPEND_PATH_1, SUSPEND_PATH_2,
  HIBERNATE_PATH_1, HIBERNATE_PATH_2, HIBERNATE_PATH_3,
  HIBERNATE_PATH_4, HIBERNATE_PATH_5, HIBERNATE_PATH_6,
  REBOOT_PATH_1, REBOOT_PATH_2, REBOOT_PATH_3,
  POWEROFF_PATH_1, POWEROFF_PATH_2, POWEROFF_PATH_3, POWEROFF_PATH_4,
} from "../lib/powerPaths"

export const [isPowerMenuOpen, setPowerMenuOpen] = createState(false)
export function togglePowerMenu() { setPowerMenuOpen(!isPowerMenuOpen.get()) }
export function closePowerMenu() { setPowerMenuOpen(false) }

type PowerAction = {
  id: string
  label: string
  paths: string[]
  command: string[]
  destructive?: boolean
}

function hasEnoughSwapForHibernate(): boolean {
  try {
    const [, out] = GLib.spawn_command_line_sync("cat /proc/meminfo")
    const text = new TextDecoder().decode(out)
    const memTotal = parseInt(text.match(/MemTotal:\s+(\d+)/)?.[1] ?? "0", 10)
    const swapTotal = parseInt(text.match(/SwapTotal:\s+(\d+)/)?.[1] ?? "0", 10)

    return swapTotal >= memTotal
  } catch (e) {
    console.error(">>> hasEnoughSwapForHibernate:", e)
    return false
  }
}

const ACTIONS: PowerAction[] = [
  { id: "lock", label: "Bloquear", paths: [LOCK_PATH], command: ["hyprlock"] },
  { id: "suspend", label: "Suspender", paths: [SUSPEND_PATH_1, SUSPEND_PATH_2], command: ["systemctl", "suspend"] },
  ...(hasEnoughSwapForHibernate()
    ? [{
        id: "hibernate",
        label: "Hibernar",
        paths: [HIBERNATE_PATH_1, HIBERNATE_PATH_2, HIBERNATE_PATH_3, HIBERNATE_PATH_4, HIBERNATE_PATH_5, HIBERNATE_PATH_6],
        command: ["systemctl", "hibernate"],
      } as PowerAction]
    : []),
  { id: "reboot", label: "Reiniciar", paths: [REBOOT_PATH_1, REBOOT_PATH_2, REBOOT_PATH_3], command: ["systemctl", "reboot"], destructive: true },
  { id: "poweroff", label: "Apagar", paths: [POWEROFF_PATH_1, POWEROFF_PATH_2, POWEROFF_PATH_3, POWEROFF_PATH_4], command: ["systemctl", "poweroff"], destructive: true },
]

const BASE_ICON_SIZE = 34
const HOVER_ICON_SIZE = 42
const SLOT_SIZE = 60
const GROW_LERP = 0.25

function PowerIcon({ paths }: { paths: string[] }) {
  return (
    <drawingarea
      widthRequest={SLOT_SIZE}
      heightRequest={SLOT_SIZE}
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        let target = BASE_ICON_SIZE
        let current = BASE_ICON_SIZE



        let intervalId: number | null = null

        self.set_draw_func((_area, cr: any, width: number, height: number) => {
          const scale = current / VIEWBOX_SIZE
          cr.save()
          cr.translate(width / 2, height / 2)
          cr.scale(scale, scale)
          cr.translate(-VIEWBOX_SIZE / 2, -VIEWBOX_SIZE / 2)
          cr.setSourceRGBA(1, 1, 1, 0.95)
          drawSvgPaths(cr, paths)
          cr.fill()
          cr.restore()
        })

        function startAnim() {
          if (intervalId !== null) return
          intervalId = setInterval(() => {
            if (Math.abs(target - current) > 0.1) {
              current += (target - current) * GROW_LERP
              self.queue_draw()
            } else {
              current = target
              self.queue_draw()
              if (intervalId !== null) {
                clearInterval(intervalId)
                intervalId = null
              }
            }
          }, 16) as unknown as number
        }

        const motion = new Gtk.EventControllerMotion()
        motion.connect("enter", () => { target = HOVER_ICON_SIZE; startAnim() })
        motion.connect("leave", () => { target = BASE_ICON_SIZE; startAnim() })
        self.add_controller(motion)

        self.connect("destroy", () => {
          if (intervalId !== null) clearInterval(intervalId)
        })
      }}
    />
  )
}

function PowerActionButton({ action }: { action: PowerAction }) {
  const [confirming, setConfirming] = createState(false)

  const run = () => {
    execAsync(action.command).catch((e) => console.error(`>>> power action ${action.id}:`, e))
    closePowerMenu()
  }

  const handleClick = () => {
    if (!action.destructive) { run(); return }
    if (confirming.get()) { run(); setConfirming(false); return }
    setConfirming(true)
    setTimeout(() => setConfirming(false), 2500)
  }

  return (
    <button class="power-modal-item" onClicked={handleClick}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
        <PowerIcon paths={action.paths} />
        <label label={confirming.as((c) => (c ? "¿Confirmar?" : action.label))} />
      </box>
    </button>
  )
}

export default function PowerModal() {
  let panelRef: Gtk.Widget

  return (
    <window
      visible={isPowerMenuOpen}
      name="power-modal"
      class="power-modal-window"
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
      $={(self: Gtk.Window) => {
        const keyCtrl = new Gtk.EventControllerKey()
        keyCtrl.connect("key-pressed", (_c: unknown, keyval: number) => {
          if (keyval === Gdk.KEY_Escape) { closePowerMenu(); return true }
          return false
        })
        self.add_controller(keyCtrl)
      }}
    >
      <box
        class="power-modal-backdrop"
        hexpand
        vexpand
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        $={(self: Gtk.Box) => {
          const click = new Gtk.GestureClick()
          click.connect("released", (_g: unknown, _n: number, x: number, y: number) => {
            if (!panelRef) { closePowerMenu(); return }
            const [ok, rect] = panelRef.compute_bounds(self)
            if (!ok) { closePowerMenu(); return }
            const inside =
              x >= rect.get_x() && x <= rect.get_x() + rect.get_width() &&
              y >= rect.get_y() && y <= rect.get_y() + rect.get_height()
            if (!inside) closePowerMenu()
          })
          self.add_controller(click)
        }}
      >
        <box
          orientation={Gtk.Orientation.VERTICAL}
          class="power-modal-panel"
          spacing={22}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          $={(self: Gtk.Box) => { panelRef = self }}
        >
          <box spacing={28} halign={Gtk.Align.CENTER}>
            {ACTIONS.slice(0, 2).map((action) => <PowerActionButton action={action} />)}
          </box>
          <box spacing={28} halign={Gtk.Align.CENTER}>
            {ACTIONS.slice(2).map((action) => <PowerActionButton action={action} />)}
          </box>
        </box>
      </box>
    </window>
  )
}

