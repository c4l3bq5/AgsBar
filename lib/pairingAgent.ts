import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { createState } from "ags"



export type PairingRequest =
  | { kind: "confirm"; device: string; passkey: string; respond: (accept: boolean) => void }
  | { kind: "display"; device: string; passkey: string; dismiss: () => void }
  | { kind: "pin-request"; device: string; respond: (pin: string | null) => void }
  | { kind: "passkey-request"; device: string; respond: (passkey: number | null) => void }
  | { kind: "authorize"; device: string; respond: (accept: boolean) => void }

const [pairingRequest, setPairingRequest] = createState<PairingRequest | null>(null)
export { pairingRequest }

function clear() {
  setPairingRequest(null)
}





const AGENT_XML = `
<node>
  <interface name="org.bluez.Agent1">
    <method name="Release"/>
    <method name="RequestPinCode">
      <arg type="o" name="device" direction="in"/>
      <arg type="s" name="pincode" direction="out"/>
    </method>
    <method name="DisplayPinCode">
      <arg type="o" name="device" direction="in"/>
      <arg type="s" name="pincode" direction="in"/>
    </method>
    <method name="RequestPasskey">
      <arg type="o" name="device" direction="in"/>
      <arg type="u" name="passkey" direction="out"/>
    </method>
    <method name="DisplayPasskey">
      <arg type="o" name="device" direction="in"/>
      <arg type="u" name="passkey" direction="in"/>
      <arg type="q" name="entered" direction="in"/>
    </method>
    <method name="RequestConfirmation">
      <arg type="o" name="device" direction="in"/>
      <arg type="u" name="passkey" direction="in"/>
    </method>
    <method name="RequestAuthorization">
      <arg type="o" name="device" direction="in"/>
    </method>
    <method name="AuthorizeService">
      <arg type="o" name="device" direction="in"/>
      <arg type="s" name="uuid" direction="in"/>
    </method>
    <method name="Cancel"/>
  </interface>
</node>
`

const AGENT_PATH = "/hypr/ags/BluetoothAgent"
const AGENT_CAPABILITY = "KeyboardDisplay"




function deviceLabel(devicePath: string): string {



  return devicePath
}

let registered = false
let regId: number | null = null
let exportedAgent: InstanceType<typeof Gio.DBusExportedObject> | null = null
let pendingInvocation: Gio.DBusMethodInvocation | null = null

export function ensurePairingAgent() {
  if (registered) return
  registered = true

  const impl: Record<string, (...args: any[]) => void> = {
  Release(invocation: Gio.DBusMethodInvocation) {
    clear()
  },

  RequestConfirmationAsync(params: [string, number], invocation: Gio.DBusMethodInvocation) {
    const [devicePath, passkey] = params
    console.log(">>> AGENTE: RequestConfirmation invocando", devicePath, passkey)
    setPairingRequest({
      kind: "confirm",
      device: deviceLabel(devicePath),
      passkey: String(passkey).padStart(6, "0"),
      respond: (accept: boolean) => {
        clear()
        if (accept) invocation.return_value(null)
        else invocation.return_dbus_error("org.bluez.Error.Rejected", "Rejected by user")
      },
    })
  },

  DisplayPasskey(devicePath: string, passkey: number, _entered: number) {
    console.log(">>> AGENTE: DisplayPasskey invocando", devicePath, passkey)
    setPairingRequest({
      kind: "display",
      device: deviceLabel(devicePath),
      passkey: String(passkey).padStart(6, "0"),
      dismiss: clear,
    })
  },

  RequestPinCodeAsync(params: [string], invocation: Gio.DBusMethodInvocation) {
    const [devicePath] = params
    setPairingRequest({
      kind: "pin-request",
      device: deviceLabel(devicePath),
      respond: (pin: string | null) => {
        clear()
        if (pin) invocation.return_value(new GLib.Variant("(s)", [pin]))
        else invocation.return_dbus_error("org.bluez.Error.Rejected", "Rejected by user")
      },
    })
  },

  RequestPasskeyAsync(params: [string], invocation: Gio.DBusMethodInvocation) {
    const [devicePath]=params
    setPairingRequest({
      kind: "passkey-request",
      device: deviceLabel(devicePath),
      respond: (passkey: number | null) => {
        clear()
        if (passkey !== null) invocation.return_value(new GLib.Variant("(u)", [passkey]))
        else invocation.return_dbus_error("org.bluez.Error.Rejected", "Rejected by user")
      },
    })
  },

  RequestAuthorizationAsync(params: [string], invocation: Gio.DBusMethodInvocation) {
    const [devicePath] = params
    setPairingRequest({
      kind: "authorize",
      device: deviceLabel(devicePath),
      respond: (accept: boolean) => {
        clear()
        if (accept) invocation.return_value(null)
        else invocation.return_dbus_error("org.bluez.Error.Rejected", "Rejected by user")
      },
    })
  },

  AuthorizeService(_devicePath: string, _uuid: string) {
  },

  Cancel(invocation: Gio.DBusMethodInvocation) {
    clear()
  },
}

  const nodeInfo = Gio.DBusNodeInfo.new_for_xml(AGENT_XML)
  const iface = nodeInfo.lookup_interface("org.bluez.Agent1")!

  const exported = Gio.DBusExportedObject.wrapJSObject(iface, impl)


  exportedAgent = exported

  const bus = Gio.DBus.system

  exported.export(bus, AGENT_PATH)

  bus.call(
    "org.bluez",
    "/org/bluez",
    "org.bluez.AgentManager1",
    "RegisterAgent",
    new GLib.Variant("(os)", [AGENT_PATH, AGENT_CAPABILITY]),
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    (_source, res) => {
      try {
        bus.call_finish(res)
        bus.call(
          "org.bluez",
          "/org/bluez",
          "org.bluez.AgentManager1",
          "RequestDefaultAgent",
          new GLib.Variant("(o)", [AGENT_PATH]),
          null,
          Gio.DBusCallFlags.NONE,
          -1,
          null,
          (_s2, res2) => {
            try {
              bus.call_finish(res2)
              console.log(">>> bluetooth agent registrado como default")
            } catch (e) {
              console.error(">>> RequestDefaultAgent falló:", e)
            }
          }
        )
      } catch (e) {
        console.error(">>> RegisterAgent falló:", e)
      }
    }
  )
}

