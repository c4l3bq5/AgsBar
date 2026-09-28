import { createState, createMemo } from "ags"
import Battery from "gi://AstalBattery"
import Mpris from "gi://AstalMpris"

export type MediaPlayerInfo = {
  player: Mpris.Player
  title: string
  artist: string
  artUrl: string
  playing: boolean
  shuffle: Mpris.Shuffle
}

export type BatteryAlertLevel = 20 | 10 | 5

export type IslandState =
  | { kind: "idle" }
  | { kind: "charging"; percentage: number }
  | { kind: "media"; players: MediaPlayerInfo[]; focusedIndex: number }

const battery = Battery.get_default()
const mpris = Mpris.get_default()

const CHARGING_PULSE_MS = 3000
const HOVER_COLLAPSE_DEBOUNCE_MS = 250

const BATTERY_ALERT_THRESHOLDS: BatteryAlertLevel[] = [20, 10, 5]
const BATTERY_ALERT_PULSE_MS = 3000

const [islandState, setIslandState] = createState<IslandState>({ kind: "idle" })
export { islandState, setIslandState }

let backgroundState: IslandState = { kind: "idle" }
let chargingPulseTimeout: number | null = null

// Reproductor actualmente enfocado en el carousel.
let focusedPlayer: Mpris.Player | null = null
// true si el usuario navegó manualmente (deslizó/tocó un dot).
// Se resetea cuando aparece un player nuevo o cuando Spotify toma prioridad.
let userOverride = false

const dismissed = new Map<Mpris.Player, boolean>()

function visiblePlayers(): Mpris.Player[] {
  return (mpris.get_players() ?? []).filter((p) => !dismissed.has(p))
}

let armedThresholds = new Set<BatteryAlertLevel>(BATTERY_ALERT_THRESHOLDS)
let batteryAlertTimeout: number | null = null

const [batteryAlert, setBatteryAlert] = createState<BatteryAlertLevel | null>(null)
export { batteryAlert }

function triggerBatteryAlert(level: BatteryAlertLevel) {
  setBatteryAlert(level)
  setIslandState({ kind: "charging", percentage: battery.percentage }) // reutilizamos el pulso visual
  if (batteryAlertTimeout !== null) clearTimeout(batteryAlertTimeout)
  batteryAlertTimeout = setTimeout(() => {
    batteryAlertTimeout = null
    setBatteryAlert(null)
    setIslandState(backgroundState)
  }, BATTERY_ALERT_PULSE_MS) as unknown as number
}

battery.connect("notify::percentage", () => {
  const pct = Math.round(battery.percentage * 100)

  // Re-armamos umbrales que ya quedaron atrás al volver a subir (cargando).
  for (const threshold of BATTERY_ALERT_THRESHOLDS) {
    if (pct > threshold + 1) armedThresholds.add(threshold) // +1 como margen anti-parpadeo
  }

  // Si NO está cargando, evaluamos si cruzamos algún umbral hacia abajo.
  if (!battery.charging) {
    for (const threshold of BATTERY_ALERT_THRESHOLDS) {
      if (pct <= threshold && armedThresholds.has(threshold)) {
        armedThresholds.delete(threshold)
        triggerBatteryAlert(threshold)
        break // solo el umbral más alto que cruzamos en este tick
      }
    }
  }

  if (chargingPulseTimeout !== null) {
    setIslandState({ kind: "charging", percentage: battery.percentage })
  }
})

function autoFocusCandidate(players: Mpris.Player[]): Mpris.Player | null {
  const spotify = players.find(p => p.identity === "Spotify")
  if (spotify && spotify.playbackStatus === Mpris.PlaybackStatus.PLAYING) return spotify

  const anyPlaying = players.find(p => p.playbackStatus === Mpris.PlaybackStatus.PLAYING)
  if (anyPlaying) return anyPlaying

  return null
}

function toInfo(player: Mpris.Player): MediaPlayerInfo {
  return {
    player,
    title: player.title ?? "",
    artist: player.artist ?? "",
    artUrl: player.get_cover_art() ?? player.art_url ?? "",
    playing: player.playbackStatus === Mpris.PlaybackStatus.PLAYING,
    shuffle: player.shuffleStatus,
  }
}

function computeBackground(players: Mpris.Player[]): IslandState {
  if (players.length === 0) return { kind: "idle" }

  const infos = players.map(toInfo)
  let idx = focusedPlayer ? players.indexOf(focusedPlayer) : -1
  if (idx < 0) idx = 0

  return { kind: "media", players: infos, focusedIndex: idx }
}

export function refreshBackground(players: Mpris.Player[] = visiblePlayers()) {
  backgroundState = computeBackground(players)
  if (chargingPulseTimeout === null) {
    setIslandState(backgroundState)
  }
}

function reevaluate() {
  const players = visiblePlayers()
  const candidate = autoFocusCandidate(players)

  if (players.length === 0) {
    focusedPlayer = null
    userOverride = false
  } else if (candidate && (!userOverride || candidate.identity === "Spotify")) {
    // Hay un candidato "fuerte" (algo sonando) y o bien no estás
    // navegando manualmente, o el candidato es Spotify (que siempre gana).
    focusedPlayer = candidate
    userOverride = false
  } else if (!focusedPlayer || !players.includes(focusedPlayer)) {
    // No hay candidato fuerte, y el foco actual ya no existe: fallback.
    focusedPlayer = candidate ?? players[players.length - 1]
    userOverride = false
  }
  // En cualquier otro caso, se respeta userOverride y no tocamos focusedPlayer.

    if (focusedPlayer && focusedPlayer !== lastPeekedPlayer) {
    lastPeekedPlayer = focusedPlayer
    triggerMediaPeek()
  } else if (!focusedPlayer) {
    lastPeekedPlayer = null
  }

  refreshBackground(players)
}

// --- Navegación manual del carousel ---
export function focusPlayer(player: Mpris.Player) {
  focusedPlayer = player
  userOverride = true
  pulseSwitching()
  refreshBackground()
}

export function focusIndexRelative(delta: number) {
  const players = visiblePlayers()
  if (players.length === 0) return
  const current = focusedPlayer ? players.indexOf(focusedPlayer) : 0
  let next = (current < 0 ? 0 : current) + delta
  if (next < 0) next = players.length - 1
  if (next >= players.length) next = 0
  focusPlayer(players[next])
}

//cerrar
export function dismissPlayer(player: Mpris.Player) {
  const idx = visiblePlayers().indexOf(player)

  const wasPlaying = player.playbackStatus === Mpris.PlaybackStatus.PLAYING
  if (wasPlaying) {
    try {
      if (player.can_pause) player.pause()
    } catch (e) {
      console.error(">>> dismiss/pause:", e)
    }
  }
  // Si estaba sonando, queda "sin armar" hasta ver el paused
  dismissed.set(player, !wasPlaying)

  if (focusedPlayer === player) {
    // El foco pasa al vecino que ocupa su lugar en el carrusel.
    const after = visiblePlayers()
    focusedPlayer = after.length > 0 ? after[Math.min(Math.max(idx, 0), after.length - 1)] : null
    userOverride = false
  }
  pulseSwitching()
  reevaluate()
}

//accion manual de "reproducir"
function updateDismissed(player: Mpris.Player) {
  if (!dismissed.has(player)) return
  if (player.playbackStatus !== Mpris.PlaybackStatus.PLAYING) {
    dismissed.set(player, true)
  } else if (dismissed.get(player)) {
    dismissed.delete(player)
    userOverride = false // vuelve y puede reclamar el foco
  }
}

const MEDIA_PEEK_MS = 3000
const [isMediaPeek, setMediaPeek] = createState(false)
let mediaPeekTimeout: number | null = null
let lastPeekedPlayer: Mpris.Player | null = null

const [isSwitchingSlide, setSwitchingSlide] = createState(false)
export { isSwitchingSlide }
let switchingTimeout: number | null = null

function pulseSwitching() {
  setSwitchingSlide(true)
  if (switchingTimeout !== null) clearTimeout(switchingTimeout)
  switchingTimeout = setTimeout(() => {
    switchingTimeout = null
    setSwitchingSlide(false)
  }, 150) as unknown as number
}

function triggerMediaPeek() {
  setMediaPeek(true)
  if (mediaPeekTimeout !== null) clearTimeout(mediaPeekTimeout)
  mediaPeekTimeout = setTimeout(() => {
    mediaPeekTimeout = null
    setMediaPeek(false)
  }, MEDIA_PEEK_MS) as unknown as number
}

function triggerChargingPulse() {
  setIslandState({ kind: "charging", percentage: battery.percentage })
  if (chargingPulseTimeout !== null) clearTimeout(chargingPulseTimeout)
  chargingPulseTimeout = setTimeout(() => {
    chargingPulseTimeout = null
    setIslandState(backgroundState)
  }, CHARGING_PULSE_MS) as unknown as number
}

let wasCharging = battery.charging
battery.connect("notify::charging", () => {
  const isCharging = battery.charging
  if (isCharging && !wasCharging) triggerChargingPulse()
  wasCharging = isCharging
})
battery.connect("notify::percentage", () => {
  if (chargingPulseTimeout !== null) {
    setIslandState({ kind: "charging", percentage: battery.percentage })
  }
})

function watchPlayer(player: Mpris.Player) {
  player.connect("notify::playback-status", () => {
  updateDismissed(player)
  reevaluate()
})
  player.connect("notify::title", () => refreshBackground())
  player.connect("notify::artist", () => refreshBackground())
  player.connect("notify::art-url", () => refreshBackground())
  player.connect("notify::cover-art", () => refreshBackground())
  player.connect("notify::shuffle", () => refreshBackground())
}

mpris.connect("player-added", (_mpris, player) => {
  watchPlayer(player)
  userOverride = false // un player nuevo siempre puede reclamar el foco
  reevaluate()
})

mpris.connect("player-closed", (_mpris, player) => {
  dismissed.delete(player)
  reevaluate()
})

mpris.get_players()?.forEach(watchPlayer)
reevaluate()

// --- Hover ---
const [isHovered, setIsHoveredState] = createState(false)
export { isHovered }
let collapseDebounce: number | null = null
export function setHovered(hovered: boolean) {
  if (hovered) {
    if (collapseDebounce !== null) { clearTimeout(collapseDebounce); collapseDebounce = null }
    setIsHoveredState(true)
    return
  }
  if (collapseDebounce !== null) clearTimeout(collapseDebounce)
  collapseDebounce = setTimeout(() => {
    collapseDebounce = null
    setIsHoveredState(false)
  }, HOVER_COLLAPSE_DEBOUNCE_MS) as unknown as number
}

// --- Derivados ---
export const islandActive = createMemo(() => islandState().kind !== "idle")
export const isExpanded = createMemo(() => {
  const s = islandState()
  if (s.kind === "idle") return false
  if (s.kind === "charging") return true
  return isHovered() || isMediaPeek()
})
export const isCompact = createMemo(() => !isExpanded())

export const islandView = createMemo(() => ({
  expanded: isExpanded(),
  state: islandState(),
}))

//only for testing purpouses
export function debugTriggerBatteryAlert(level: BatteryAlertLevel) {
  triggerBatteryAlert(level)
}