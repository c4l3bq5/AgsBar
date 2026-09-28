
import Notifd from "gi://AstalNotifd";
import GLib from "gi://GLib";

const CACHE_FILE = `${GLib.get_home_dir()}/.cache/ags/last-notification.txt`;

function writeCache(text: string) {
  GLib.mkdir_with_parents(`${GLib.get_home_dir()}/.cache/ags`, 0o755);
  GLib.file_set_contents(CACHE_FILE, text);
}

export function initNotifBridge() {
  const notifd = Notifd.get_default();

  notifd.connect("notified", (_src, id: number) => {
    const n = notifd.get_notification(id);
    if (!n) return;
    const summary = n.get_summary() ?? "";
    const body = (n.get_body() ?? "").replace(/\n/g, " ");
    writeCache(body ? `${summary} — ${body}` : summary);
  });

  notifd.connect("resolved", () => {
    // Si no quedan notificaciones activas, limpiamos la línea
    if (notifd.get_notifications().length === 0) writeCache("");
  });
}