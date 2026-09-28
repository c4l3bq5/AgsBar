import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { togglePowerMenu } from "./PowerModal"
import ControlIcon from "./ControlIcon"
import { POWEROFF_PATH_1, POWEROFF_PATH_2, POWEROFF_PATH_3, POWEROFF_PATH_4 } from "../lib/powerPaths"
import { islandActive } from "../lib/islandState"
import { createBinding, createMemo, For, With } from "ags"

import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"

import BatteryIcon from "./BatteryIcon"
import WifiIcon from "./Wifiicon"
import BluetoothIcon from "./BluetoothIcon"
import AudioIcon from "./AudioIcon"

const hypr = Hyprland.get_default()
const battery = Battery.get_default()
const network = Network.get_default()

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  const time = createPoll("", 1000, "date +'%H:%M'")

  const workspaces = createBinding(hypr, "workspaces").as(wss =>
    wss.filter(ws => ws.id > 0).sort((a, b) => a.id - b.id)
  )
  const focused = createBinding(hypr, "focusedWorkspace")

  const battPercent = createBinding(battery, "percentage")
  const charging = createBinding(battery, "charging")

  const primary = createBinding(network, "primary")

  return (
    <window
      visible
      name="bar"
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox">
        <box $type="start" halign={Gtk.Align.START} widthRequest={220} spacing={0}>
          <For each={workspaces}>
  {ws => (
    <box
      cssClasses={focused.as(fw =>
        fw?.id === ws.id ? ["workspace", "workspace-active"] : ["workspace", "workspace-inactive"]
      )}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
      hexpand={false}
      vexpand={false}
      $={self => {
        self.set_cursor(Gdk.Cursor.new_from_name("pointer", null))
        const gesture = new Gtk.GestureClick()
        gesture.connect("pressed", () => {
          gesture.set_state(Gtk.EventSequenceState.CLAIMED)
          ws.focus()
        })
        self.add_controller(gesture)
      }}
    >
      <label
  label={`${ws.id}`}
  visible={focused.as(fw => fw?.id === ws.id)}
  hexpand
  vexpand
  halign={Gtk.Align.CENTER}
  valign={Gtk.Align.CENTER}
  justify={Gtk.Justification.CENTER}
/>
    </box>
  )}
</For>
        </box>

        {}
        <box
          $type="center"
          cssClasses={["bar-pill"]}
          halign={Gtk.Align.CENTER}
          visible={islandActive.as((a) => !a)}
        >
          <label label={time} cssClasses={["clock"]} />
        </box>

        <box $type="end" halign={Gtk.Align.END} spacing={6}>
          {}
          <box cssClasses={["bar-pill"]} spacing={8}>
            <button
              cssClasses={["battery-shell"]}
              valign={Gtk.Align.CENTER}
              tooltipText={createMemo(() => {
                const p = Math.round(battPercent() * 100)
                return charging() ? `${p}% · cargando` : `${p}% restante`
              })}
              onClicked={() => execAsync(["xfce4-power-manager-settings"]).catch(console.error)}
            >
              <BatteryIcon />
            </button>

            <With value={primary}>
              {() =>
                network.wifi ? (
                  <WifiIcon />
                ) : (
                  <image iconName="network-wired-symbolic" />
                )
              }
            </With>

            <BluetoothIcon />

            <AudioIcon />
          </box>

          {}
          <box cssClasses={["bar-pill"]} visible={islandActive}>
            <label label={time} cssClasses={["clock", "clock-small"]} />
          </box>

          {}
          <box cssClasses={["bar-pill"]}>
            <button class="icon-only-btn" onClicked={togglePowerMenu}>
              <ControlIcon paths={[POWEROFF_PATH_1, POWEROFF_PATH_2, POWEROFF_PATH_3, POWEROFF_PATH_4]} size={18} />
            </button>
          </box>
        </box>
      </centerbox>
    </window>
  )
}

