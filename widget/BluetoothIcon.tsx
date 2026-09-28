import { Gtk } from "ags/gtk4"
import { createState, createBinding, For } from "ags"
import Bluetooth from "gi://AstalBluetooth"
import Pango from "gi://Pango"
import Gio from "gi://Gio"

import { drawSvgPaths } from "../lib/svgPath"
import { BLUETOOTH_PATH } from "../lib/bluetoothPaths"

const VIEWBOX = 500
const SCALE = 30 / VIEWBOX

const ICON_FILL = 0.62
const EFFECTIVE_SCALE = SCALE * ICON_FILL

const bt = Bluetooth.get_default()

function parseRgb(css: string): [number, number, number] {
  const m = css.match(/(\d+(?:\.\d+)?)/g)
  if (!m || m.length < 3) return [1, 1, 1]
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255]
}

type RowInfo = {
  device: Bluetooth.Device
  name: string
  connected: boolean
  paired: boolean
  battery: number // -1 si el dispositivo no reporta
}

function toRow(d: Bluetooth.Device): RowInfo {
  return {
    device: d,
    name: d.name || d.address,
    connected: d.connected,
    paired: d.paired,
    battery: d.batteryPercentage ?? -1,
  }
}

function knownDevices(): RowInfo[] {
  const all = (bt.get_devices() ?? []) as Bluetooth.Device[]
  return all
    .filter(d => d.paired)
    .map(toRow)
    .sort((a, b) => (a.connected === b.connected ? a.name.localeCompare(b.name) : a.connected ? -1 : 1))
}

function discoveredDevices(): RowInfo[] {
  const all = (bt.get_devices() ?? []) as Bluetooth.Device[]
  return all.filter(d => !d.paired).map(toRow)
}

// ---------------------------------------------------------------------------
// Conectar / desconectar / emparejar
// ---------------------------------------------------------------------------

function connectDevice(device: Bluetooth.Device): Promise<void> {
  return new Promise((resolve, reject) => {
    device.connect_device((_source: unknown, res: unknown) => {
      try {
        // @ts-ignore -- *_finish no está tipado en los .gir actuales
        device.connect_device_finish(res)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
}

function disconnectDevice(device: Bluetooth.Device): Promise<void> {
  return new Promise((resolve, reject) => {
    device.disconnect_device((_source: unknown, res: unknown) => {
      try {
        // @ts-ignore
        device.disconnect_device_finish(res)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
}

// device.objectPath puede venir undefined en dispositivos recién anunciados
// por advertising (BlueZ a veces completa las propiedades del proxy en dos
// tiempos). Como fallback confiable, se reconstruye el path D-Bus a partir
// de la MAC, que siempre está disponible.
function devicePathFromAddress(address: string, adapterPath: string): string {
  const suffix = address.replace(/:/g, "_")
  return `${adapterPath}/dev_${suffix}`
}

function pairDeviceAsync(device: Bluetooth.Device): Promise<void> {
  return new Promise((resolve, reject) => {
    const adapterPath = bt.adapter?.objectPath ?? "/org/bluez/hci0"
    const devicePath =
      device.objectPath ?? devicePathFromAddress(device.address, adapterPath)

    const bus = Gio.DBus.system
    bus.call(
      "org.bluez",
      devicePath,
      "org.bluez.Device1",
      "Pair",
      null,
      null,
      Gio.DBusCallFlags.NONE,
      120000, // 2 minutos -- puede tardar en confirmar del otro lado
      null,
      (_source, res) => {
        try {
          bus.call_finish(res)
          resolve()
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Fila de dispositivo (conectado / emparejado / descubierto)
// ---------------------------------------------------------------------------

function DeviceRow({
  info,
  mode,
  onAction,
}: {
  info: RowInfo
  mode: "connected" | "paired" | "discover"
  onAction: (device: Bluetooth.Device) => void
}) {
  const [busy, setBusy] = createState(false)
  const connected = createBinding(info.device, "connected")
  const paired = createBinding(info.device, "paired")

  async function handleClick() {
    if (busy.get()) return
    setBusy(true)
    try {
      if (connected.get()) {
        await disconnectDevice(info.device)
      } else if (paired.get()) {
        await connectDevice(info.device)
      } else {
        await pairDeviceAsync(info.device)
        await connectDevice(info.device)
      }
    } catch (e) {
      console.error(">>> bt action:", e)
    }
    setBusy(false)
  }

  return (
    <box
      cssClasses={["bluetooth-row"]}
      $={(self: Gtk.Box) => {
        const rowClick = new Gtk.GestureClick()
        rowClick.connect("released", (gesture: Gtk.GestureClick) => {
          gesture.set_state(Gtk.EventSequenceState.CLAIMED)
          handleClick()
        })
        self.add_controller(rowClick)
      }}
    >
      <box spacing={8}>
        <label
          label={info.name}
          hexpand
          halign={Gtk.Align.START}
          ellipsize={Pango.EllipsizeMode.END}
          cssClasses={connected.as((c) => (c ? ["bluetooth-row-label", "bluetooth-row-active"] : ["bluetooth-row-label"]))}
        />
        {info.battery >= 0 && (
          <label label={`${Math.round(info.battery)}%`} cssClasses={["bluetooth-row-battery"]} />
        )}
        <Gtk.Spinner spinning={busy} visible={busy} />
        {mode === "connected" && (
          <image iconName="object-select-symbolic" pixelSize={14} />
        )}
        {mode !== "discover" && (
          <image
            iconName={mode === "connected" ? "media-eject-symbolic" : "user-trash-symbolic"}
            pixelSize={14}
            cssClasses={["bluetooth-row-forget"]}
            $={(self: Gtk.Image) => {
              const click = new Gtk.GestureClick()
              click.connect("released", (gesture: Gtk.GestureClick) => {
                gesture.set_state(Gtk.EventSequenceState.CLAIMED)
                onAction(info.device)
              })
              self.add_controller(click)
            }}
          />
        )}
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Sección "buscar dispositivos nuevos"
// ---------------------------------------------------------------------------

function DiscoverySection() {
  const [discovering, setDiscovering] = createState(false)
  const [discovered, setDiscovered] = createState<RowInfo[]>([])
  const [visibleSecondsLeft, setVisibleSecondsLeft] = createState<number | null>(null)

  function refresh() {
    setDiscovered(discoveredDevices())
  }

  function toggleScan() {
    const adapter = bt.adapter
    if (!adapter) return
    try {
      if (adapter.discovering) {
        adapter.stop_discovery()
        setDiscovering(false)
      } else {
        adapter.start_discovery()
        setDiscovering(true)
      }
    } catch (e) {
      console.error(">>> bt toggleScan:", e)
    }
  }

  function toggleVisible() {
    const adapter = bt.adapter
    if (!adapter) return
    if (adapter.discoverable) {
      adapter.set_discoverable(false)
    } else {
      adapter.set_discoverable(true)
    }
  }

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={4}
      $={(self: Gtk.Box) => {
        let addedId: number | null = null
        let discoverableId: number | null = null
        let countdownInterval: number | null = null

        function stopCountdown() {
          if (countdownInterval !== null) {
            clearInterval(countdownInterval)
            countdownInterval = null
          }
          setVisibleSecondsLeft(null)
        }

        function startCountdown() {
          const adapter = bt.adapter
          if (!adapter) return
          let remaining = adapter.discoverableTimeout || 180
          setVisibleSecondsLeft(remaining)
          if (countdownInterval !== null) clearInterval(countdownInterval)
          countdownInterval = setInterval(() => {
            remaining -= 1
            if (remaining <= 0 || !adapter.discoverable) {
              stopCountdown()
            } else {
              setVisibleSecondsLeft(remaining)
            }
          }, 1000) as unknown as number
        }

        function attach() {
          refresh()
          addedId = bt.connect("device-added", refresh)

          const adapter = bt.adapter
          if (adapter) {
            if (adapter.discoverable) startCountdown()
            discoverableId = adapter.connect("notify::discoverable", () => {
              if (adapter.discoverable) startCountdown()
              else stopCountdown()
            })
          }
        }

        function detach() {
          if (addedId !== null) bt.disconnect(addedId)
          addedId = null
          const adapter = bt.adapter
          try {
            if (adapter?.discovering) adapter.stop_discovery()
          } catch (e) {
            console.error(">>> bt stop_discovery (safe):", e)
          }
          if (discoverableId !== null) adapter?.disconnect(discoverableId)
          discoverableId = null
          stopCountdown()
          setDiscovering(false)
        }

        self.connect("map", attach)
        self.connect("unmap", detach)
      }}
    >
      <box spacing={6}>
        <label label="Dispositivos disponibles" hexpand halign={Gtk.Align.START} cssClasses={["bluetooth-popover-title"]} />
      </box>

      <box spacing={6}>
        <button cssClasses={["bluetooth-action-btn"]} hexpand onClicked={toggleVisible}>
          <label
            label={visibleSecondsLeft.as((s) => (s !== null ? `Visible · ${s}s` : "Hacer visible"))}
          />
        </button>
        <button cssClasses={["bluetooth-action-btn"]} hexpand onClicked={toggleScan}>
          <label label={discovering.as((d) => (d ? "Detener" : "Buscar"))} />
        </button>
      </box>

      <For each={discovered}>
        {(info: RowInfo) => <DeviceRow info={info} mode="discover" onAction={() => {}} />}
      </For>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Popover completo
// ---------------------------------------------------------------------------

function BluetoothPopoverContent() {
  const [connectedRows, setConnectedRows] = createState<RowInfo[]>([])
  const [pairedRows, setPairedRows] = createState<RowInfo[]>([])

  function refresh() {
    const all = knownDevices() // todos los paired, connected primero
    setConnectedRows(all.filter((d) => d.connected))
    setPairedRows(all.filter((d) => !d.connected))
  }

  async function handleDisconnectAction(device: Bluetooth.Device) {
    try {
      await disconnectDevice(device)
    } catch (e) {
      console.error(">>> bt disconnect (icon) error:", e)
    }
    refresh() // no depender solo de la señal
  }

  function handleForget(device: Bluetooth.Device) {
    try {
      bt.adapter?.remove_device(device)
    } catch (e) {
      console.error(">>> bt forget error:", e)
    }
    refresh() // no depender solo de la señal
  }

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      cssClasses={["bluetooth-popover"]}
      $={(self: Gtk.Box) => {
        let addedId: number | null = null
        let removedId: number | null = null

        function attach() {
          refresh()
          addedId = bt.connect("device-added", refresh)
          removedId = bt.connect("device-removed", refresh)
        }
        function detach() {
          if (addedId !== null) bt.disconnect(addedId)
          if (removedId !== null) bt.disconnect(removedId)
          addedId = removedId = null
        }

        self.connect("map", attach)
        self.connect("unmap", detach)
      }}
    >
      <label label="Conectados" halign={Gtk.Align.START} cssClasses={["bluetooth-popover-title"]} />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <For each={connectedRows}>
          {(info: RowInfo) => <DeviceRow info={info} mode="connected" onAction={handleDisconnectAction} />}
        </For>
      </box>

      <box heightRequest={1} cssClasses={["bluetooth-separator"]} />

      <label label="Emparejados" halign={Gtk.Align.START} cssClasses={["bluetooth-popover-title"]} />
      <scrolledwindow heightRequest={140} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          <For each={pairedRows}>
            {(info: RowInfo) => <DeviceRow info={info} mode="paired" onAction={handleForget} />}
          </For>
        </box>
      </scrolledwindow>

      <box heightRequest={1} cssClasses={["bluetooth-separator"]} />
      <DiscoverySection />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Ícono de la barra
// ---------------------------------------------------------------------------

export default function BluetoothIcon({ color = "rgb(226,226,230)" }: { color?: string } = {}) {
  const [r, g, b] = parseRgb(color)

  return (
    <menubutton cssClasses={["bluetooth-menubutton"]}>
      <drawingarea
        widthRequest={30}
        heightRequest={30}
        valign={Gtk.Align.CENTER}
        $={(self: Gtk.DrawingArea) => {
          const recompute = () => {
            self.set_tooltip_text(
              bt.isConnected ? "Bluetooth · conectado" : bt.isPowered ? "Bluetooth" : "Bluetooth apagado"
            )
            self.queue_draw()
          }

          const poweredId = bt.connect("notify::is-powered", recompute)
          const connectedId = bt.connect("notify::is-connected", recompute)
          recompute()

          self.set_draw_func((_area, cr, width, height) => {
            cr.save()
            cr.translate((width - VIEWBOX * EFFECTIVE_SCALE) / 2, (height - VIEWBOX * EFFECTIVE_SCALE) / 2)
            cr.scale(EFFECTIVE_SCALE, EFFECTIVE_SCALE)
            cr.setSourceRGBA(r, g, b, bt.isPowered ? 1 : 0.35)
            cr.newPath()
            drawSvgPaths(cr, [BLUETOOTH_PATH])
            cr.fill()
            cr.restore()

            // Puntito de "conectado" dibujado directo en el mismo canvas,
            // NO como un widget aparte, para no sumar altura al contenedor.
            if (bt.isConnected) {
              const dotRadius = 3
              const dotX = width / 2
              const dotY = height - dotRadius - 1
              cr.newPath()
              cr.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI)
              cr.setSourceRGBA(r, g, b, 1)
              cr.fill()
            }
          })

          self.connect("destroy", () => {
            bt.disconnect(poweredId)
            bt.disconnect(connectedId)
          })
        }}
      />

      <popover cssClasses={["bluetooth-popover-container"]}>
        <BluetoothPopoverContent />
      </popover>
    </menubutton>
  )
}