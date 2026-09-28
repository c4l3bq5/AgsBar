import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createBinding } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"

const hypr = Hyprland.get_default()

const CLOCK_WORKSPACE = 3

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

const pad = (n: number) => String(n).padStart(2, "0")

function greeting(hour: number): string {
  if (hour >= 6 && hour < 12) return "Buenos días"
  if (hour >= 12 && hour < 20) return "Buenas tardes"
  return "Buenas noches"
}

export default function ClockScreen() {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const user = GLib.get_user_name()


  const now = createPoll(new Date(), 1000, () => new Date())

  const time = now.as((d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`)
  const hello = now.as((d) => `${greeting(d.getHours())} ${user}`)
  const date = now.as((d) => `${pad(d.getDate())} - ${MESES[d.getMonth()]} - ${d.getFullYear()}`)



  const onClockWorkspace = createBinding(hypr, "focusedWorkspace").as(
    (w) => w?.id === CLOCK_WORKSPACE
  )

  return (
    <window
      visible={onClockWorkspace}
      name="clock-screen"
      class="clock-window"
      layer={Astal.Layer.BOTTOM}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        hexpand
        vexpand
        spacing={44}
      >
        <label label={hello} cssClasses={["clock-greeting"]} />

        <box halign={Gtk.Align.CENTER} spacing={28}>
          <box cssClasses={["clock-line"]} widthRequest={240} heightRequest={1} valign={Gtk.Align.CENTER} />
          {}
          <label label={time} cssClasses={["clock-time"]} widthRequest={210} xalign={0.5} />
          <box cssClasses={["clock-line"]} widthRequest={240} heightRequest={1} valign={Gtk.Align.CENTER} />
        </box>

        <label label={date} cssClasses={["clock-date"]} />
      </box>
    </window>
  )
}

