import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { With } from "ags"
import { pairingRequest } from "../lib/pairingAgent"

function ConfirmContent({ device, passkey, respond }: { device: string; passkey: string; respond: (accept: boolean) => void }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssClasses={["pairing-modal-panel"]}>
      <label label="Confirmar emparejamiento" cssClasses={["pairing-title"]} />
      <label label={device} cssClasses={["pairing-device"]} wrap />
      <label label={passkey} cssClasses={["pairing-passkey"]} />
      <label label="¿Coincide con el código mostrado en el otro dispositivo?" cssClasses={["pairing-hint"]} wrap />
      <box spacing={8} halign={Gtk.Align.CENTER}>
        <button cssClasses={["pairing-btn", "pairing-btn-reject"]} onClicked={() => respond(false)}>
          <label label="Rechazar" />
        </button>
        <button cssClasses={["pairing-btn", "pairing-btn-accept"]} onClicked={() => respond(true)}>
          <label label="Confirmar" />
        </button>
      </box>
    </box>
  )
}

function DisplayContent({ device, passkey, dismiss }: { device: string; passkey: string; dismiss: () => void }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssClasses={["pairing-modal-panel"]}>
      <label label="Ingresá este código" cssClasses={["pairing-title"]} />
      <label label={device} cssClasses={["pairing-device"]} wrap />
      <label label={passkey} cssClasses={["pairing-passkey"]} />
      <label label="Escribilo en el otro dispositivo para completar el emparejamiento." cssClasses={["pairing-hint"]} wrap />
      <button cssClasses={["pairing-btn"]} halign={Gtk.Align.CENTER} onClicked={dismiss}>
        <label label="Listo" />
      </button>
    </box>
  )
}

function PinRequestContent({ device, respond }: { device: string; respond: (pin: string | null) => void }) {
  let pin = ""
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssClasses={["pairing-modal-panel"]}>
      <label label="Ingresá el PIN" cssClasses={["pairing-title"]} />
      <label label={device} cssClasses={["pairing-device"]} wrap />
      <entry
        placeholderText="PIN"
        cssClasses={["pairing-entry"]}
        onActivate={() => respond(pin || null)}
        $={(self: Gtk.Entry) => {
          self.connect("notify::text", () => { pin = self.get_text() })
        }}
      />
      <box spacing={8} halign={Gtk.Align.CENTER}>
        <button cssClasses={["pairing-btn", "pairing-btn-reject"]} onClicked={() => respond(null)}>
          <label label="Cancelar" />
        </button>
        <button cssClasses={["pairing-btn", "pairing-btn-accept"]} onClicked={() => respond(pin || null)}>
          <label label="Aceptar" />
        </button>
      </box>
    </box>
  )
}

function PasskeyRequestContent({ device, respond }: { device: string; respond: (passkey: number | null) => void }) {
  let value = ""
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssClasses={["pairing-modal-panel"]}>
      <label label="Ingresá el código numérico" cssClasses={["pairing-title"]} />
      <label label={device} cssClasses={["pairing-device"]} wrap />
      <entry
        placeholderText="123456"
        cssClasses={["pairing-entry"]}
        onActivate={() => {
          const n = parseInt(value, 10)
          respond(Number.isNaN(n) ? null : n)
        }}
        $={(self: Gtk.Entry) => {
          self.connect("notify::text", () => { value = self.get_text() })
        }}
      />
      <box spacing={8} halign={Gtk.Align.CENTER}>
        <button cssClasses={["pairing-btn", "pairing-btn-reject"]} onClicked={() => respond(null)}>
          <label label="Cancelar" />
        </button>
        <button
          cssClasses={["pairing-btn", "pairing-btn-accept"]}
          onClicked={() => {
            const n = parseInt(value, 10)
            respond(Number.isNaN(n) ? null : n)
          }}
        >
          <label label="Aceptar" />
        </button>
      </box>
    </box>
  )
}

function AuthorizeContent({ device, respond }: { device: string; respond: (accept: boolean) => void }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssClasses={["pairing-modal-panel"]}>
      <label label="Autorizar dispositivo" cssClasses={["pairing-title"]} />
      <label label={device} cssClasses={["pairing-device"]} wrap />
      <box spacing={8} halign={Gtk.Align.CENTER}>
        <button cssClasses={["pairing-btn", "pairing-btn-reject"]} onClicked={() => respond(false)}>
          <label label="Denegar" />
        </button>
        <button cssClasses={["pairing-btn", "pairing-btn-accept"]} onClicked={() => respond(true)}>
          <label label="Permitir" />
        </button>
      </box>
    </box>
  )
}

function PairingWindow(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible={pairingRequest.as((r) => r !== null)}
      name="pairing-modal"
      class="pairing-modal-window"
      gdkmonitor={gdkmonitor}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <box cssClasses={["pairing-modal-backdrop"]} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <With value={pairingRequest}>
          {(req) => {
            if (!req) return <box />
            switch (req.kind) {
              case "confirm":
                return <ConfirmContent device={req.device} passkey={req.passkey} respond={req.respond} />
              case "display":
                return <DisplayContent device={req.device} passkey={req.passkey} dismiss={req.dismiss} />
              case "pin-request":
                return <PinRequestContent device={req.device} respond={req.respond} />
              case "passkey-request":
                return <PasskeyRequestContent device={req.device} respond={req.respond} />
              case "authorize":
                return <AuthorizeContent device={req.device} respond={req.respond} />
            }
          }}
        </With>
      </box>
    </window>
  )
}

export default function PairingModal(gdkmonitor: Gdk.Monitor) {
  return PairingWindow(gdkmonitor)
}