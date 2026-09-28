import { Gtk } from "ags/gtk4"
import { createState, For } from "ags"
import { execAsync } from "ags/process"
import AstalNetwork from "gi://AstalNetwork"
import Pango from "gi://Pango"

import { drawSvgPaths } from "../lib/svgPath"

const ARC_1 = "M284.9,315.2l-29.9,29.9c-1.3,1.3-3.1,2.1-4.9,2.1s-3.6-0.7-4.9-2.1l-29.9-29.9c-1.4-1.4-2.2-3.4-2-5.4c0.1-2,1.1-3.8,2.6-5c8.3-6.4,18.2-10.4,28.6-11.4c3.8-0.4,7.6-0.4,11.3,0c10.4,1,20.3,5,28.6,11.4c1.5,1.2,2.5,3,2.6,5C287,311.8,286.3,313.8,284.9,315.2z"
const ARC_2 = "M319.5,282.1c0.1,2.3-0.9,4.6-2.5,6.2l-7.9,7.9c-1.6,1.6-3.8,2.5-6,2.5c-2,0-4-0.7-5.6-2.1c-10.6-9.4-23.7-15.4-37.7-17.4c-6.8-1.1-13.3-1.1-19.4,0l-0.1,0c-14.1,1.9-27.1,7.9-37.7,17.4c-3.4,3-8.4,2.8-11.6-0.4l-7.9-7.9c-1.6-1.6-2.6-3.9-2.5-6.2c0.1-2.3,1.1-4.5,2.8-6c15.7-14.2,35.2-22.8,56.2-25.1c6.9-0.7,14.3-0.7,21.2,0c21,2.2,40.4,10.9,56.1,25.1C318.5,277.6,319.5,279.8,319.5,282.1z"
const ARC_3 = "M350.7,249.6c0,2.6-1,5.2-2.8,7l-8.2,8.2c-1.9,1.9-4.4,2.8-6.8,2.8c-2.4,0-4.7-0.9-6.6-2.6c-18.2-16.9-41.8-27.4-66.5-29.5c-7.1-0.5-13.7-0.5-19.6,0c-24.7,2.1-48.3,12.6-66.5,29.5c-3.8,3.6-9.7,3.5-13.4-0.2l-8.2-8.2c-1.9-1.9-2.9-4.4-2.8-7c0.1-2.6,1.1-5.1,3.1-6.9c23.8-22.2,54.7-35.7,87-38.1c3.6-0.2,7.2-0.4,10.6-0.4s7,0.1,10.6,0.4c32.4,2.4,63.3,15.9,87.1,38.1C349.6,244.5,350.6,247,350.7,249.6z"
const ARC_4 = "M383.1,216.3l-15,14.9c-3.1,3.1-8.1,3.2-11.3,0.3c-25.9-23.5-59.5-38.5-96.6-40.9l0,0l-4.4-0.2c-1.9-0.1-3.9-0.1-5.9-0.1s-3.9,0-5.9,0.1l-4.4,0.2l0,0c-37.1,2.3-70.7,17.4-96.6,40.9c-3.2,2.9-8.2,2.8-11.3-0.3l-15-14.9c-3.3-3.3-3.2-8.7,0.3-11.9c35-32.1,81.6-51.7,132.8-51.7s97.8,19.6,132.8,51.7C386.2,207.6,386.4,213,383.1,216.3z"

const SIGNAL_ARCS = [ARC_1, ARC_2, ARC_3, ARC_4]

const NO_CONNECTED_PATHS = [
  "M383.1,216.3l-15,15c-3.1,3.1-8.1,3.2-11.3,0.3c-11.2-10.2-23.9-18.8-37.7-25.5l5.2-5.2c3.2-3.2,5-7.5,5-12.1c0-4.6-1.8-8.9-5-12.1l-1-1c-3.2-3.2-7.5-5-12.1-5c-4.6,0-8.9,1.8-12.1,5l-17.8,17.8c-6.9-1.4-13.9-2.3-21.1-2.8l-4.4-0.2c-1.9-0.1-3.9-0.1-5.8-0.1s-3.9,0-5.8,0.1l-4.4,0.2c-7.3,0.5-14.5,1.4-21.5,2.8L202.7,178c-3.2-3.2-7.5-5-12.1-5s-8.9,1.8-12.1,5c-3.3,3.3-5,7.5-5,12.1s1.8,8.9,5,12.1l3.4,3.4c-14.2,6.7-27.2,15.5-38.7,25.9c-3.2,3-8.2,2.8-11.3-0.3l-15-15c-3.3-3.3-3.2-8.7,0.3-11.9c35-32.1,81.6-51.7,132.8-51.7s97.8,19.6,132.8,51.7C386.2,207.6,386.4,213,383.1,216.3z",
  "M216.5,240.2c-15.8,5-30.6,13.4-42.8,24.8c-3.8,3.6-9.7,3.5-13.4-0.2l-8.2-8.2c-1.9-1.8-2.9-4.4-2.8-7c0-2.6,1.1-5.1,3.1-6.9c11.9-11.1,25.5-20,40.2-26.5L216.5,240.2z",
  "M269.3,205.5l-19.5,19.5l-19.5-19.5c3-0.4,6.1-0.8,9.1-1c3.6-0.2,7.2-0.4,10.6-0.4s7,0.1,10.6,0.4C263.5,204.8,266.4,205.1,269.3,205.5z",
  "M350.7,249.6c0,2.6-1,5.2-2.8,7l-8.2,8.2c-1.9,1.9-4.3,2.8-6.8,2.8c-2.4,0-4.7-0.9-6.6-2.6c-12-11.1-26.2-19.4-41.6-24.4l23.8-23.8c14.3,6.4,27.6,15.2,39.2,26C349.6,244.5,350.6,247,350.7,249.6z",
  "M286.9,310.6c-0.1,1.8-0.8,3.4-2,4.7l-29.9,29.9c-1.3,1.3-3.1,2-4.9,2s-3.6-0.7-4.9-2l-29.9-29.9c-0.9-0.9-1.6-2.1-1.8-3.3l14-14c5.4-2.4,11.2-3.9,17.1-4.5c3.8-0.4,7.6-0.4,11.3,0c7,0.7,13.8,2.7,20.1,5.9l0,0L286.9,310.6z",
  "M219.7,255.1l-34.9,34.9l-1.8-1.8c-1.6-1.6-2.5-3.9-2.5-6.2c0.1-2.3,1.1-4.5,2.8-6C193.9,266.5,206.3,259.4,219.7,255.1z",
  "M255,278.7c-2.8-0.2-5.6-0.3-8.3-0.2l4.1-4.1L255,278.7z",
  "M319.5,282.1c0.1,2.3-0.9,4.6-2.5,6.2l-2,2l-35.4-35.4c13.7,4.2,26.3,11.4,37.2,21.2C318.5,277.6,319.5,279.8,319.5,282.1z",
  "M317.8,301.5c4.3,4.3,4.3,11.4,0,15.7l-0.8,0.8c-0.3,0.2-0.6,0.5-0.9,0.7l-0.5,0.3c-0.5,0.3-1,0.5-1.5,0.7c-0.2,0.1-0.3,0.1-0.5,0.2c-1.2,0.4-2.4,0.6-3.7,0.6c-1.2,0-2.5-0.2-3.7-0.6c-0.2-0.1-0.3-0.1-0.5-0.2c-0.5-0.2-1-0.4-1.5-0.7c-0.2-0.1-0.3-0.2-0.5-0.3c-0.3-0.2-0.6-0.4-0.9-0.7c-0.3-0.2-0.6-0.5-0.9-0.8L265,280.2L250.8,266l-54.2,54.2c-0.3,0.3-0.5,0.5-0.8,0.8c-0.3,0.2-0.6,0.5-0.9,0.7c-0.2,0.1-0.4,0.3-0.7,0.4c-0.1,0-0.2,0.1-0.2,0.1c-0.4,0.2-0.8,0.4-1.3,0.6c0,0,0,0,0,0c-0.1,0-0.2,0.1-0.2,0.1c-0.2,0.1-0.3,0.1-0.5,0.2c-1,0.3-2.1,0.5-3.2,0.5c-1.2,0-2.5-0.2-3.7-0.6c-0.3-0.1-0.7-0.2-1-0.4c-1.1-0.5-2.2-1.3-3.2-2.2l-1-1c-4.3-4.3-4.3-11.4,0-15.7l9.1-9.1l42.1-42.1l3-3l-10.9-10.9l-24.6-24.6L187.8,203l-5-5c-4.3-4.3-4.3-11.4,0-15.7l0,0c0.3-0.3,0.5-0.5,0.8-0.8c0.3-0.2,0.6-0.5,0.9-0.7c0.5-0.3,0.9-0.6,1.4-0.8c0,0,0,0,0,0c0.5-0.2,1-0.4,1.5-0.6c1-0.3,2.1-0.5,3.2-0.5s2.1,0.1,3.2,0.5c0.2,0.1,0.3,0.1,0.5,0.2c0.1,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0c0,0,0,0,0,0c0.2,0.1,0.3,0.1,0.5,0.2c0,0,0,0,0,0c0,0,0.1,0,0.1,0c0.1,0,0.2,0.1,0.3,0.1c0.4,0.2,0.9,0.5,1.3,0.7c0.3,0.2,0.6,0.4,0.9,0.7s0.6,0.5,0.8,0.8l12.8,12.9l11.7,11.7l26.7,26.8l26.8-26.8l11.7-11.7l15.1-15.1c0.3-0.4,0.7-0.7,1.1-1c0.1-0.1,0.2-0.2,0.4-0.3c0.2-0.1,0.4-0.2,0.6-0.4c1.8-1.1,3.8-1.6,5.8-1.6c2,0,3.9,0.5,5.6,1.5c0.3,0.2,0.6,0.4,0.9,0.6c0,0,0,0,0,0c0.5,0.3,0.9,0.7,1.3,1.1l1,1c4.3,4.3,4.3,11.4,0,15.7l-6.8,6.8l-35.2,35.2l-11.6,11.6l44.3,44.3L317.8,301.5z",
]

const NO_NET_PATHS = [
  "M441.3,201.6l-21.5,21.5c-4.5,4.5-11.6,4.6-16.3,0.4c-37.2-33.8-85.5-55.4-138.8-58.8l-6.3-0.3c-2.8-0.1-5.6-0.2-8.4-0.2c-2.8,0-5.6,0.1-8.4,0.2l-6.3,0.3c-8.3,0.5-16.6,1.5-24.6,2.9l0.1-3.2c0.1-2.7-0.9-5.3-2.8-7.2c-1.9-1.9-4.4-3-7.2-3h-16.6c-2.7,0-5.3,1.1-7.2,3c-1.9,1.9-2.9,4.5-2.8,7.2l0.4,12.5c-5,1.7-9.9,3.6-14.7,5.7c-23.4,10.1-44.8,23.9-63.4,40.8c-4.7,4.2-11.8,4.1-16.3-0.4l-21.5-21.5c-4.8-4.8-4.6-12.6,0.4-17.1c50.3-46.1,117.3-74.3,190.9-74.3c73.6,0,140.7,28.2,190.9,74.3C445.9,189.1,446.1,196.8,441.3,201.6z",
  "M394.8,249.4c0,3.8-1.4,7.4-4.1,10.1L379,271.3c-2.7,2.7-6.3,4.1-9.8,4.1c-3.4,0-6.8-1.2-9.5-3.8c-26.2-24.3-60.1-39.4-95.6-42.4c-10.1-0.7-19.7-0.7-28.2,0c-9.2,0.8-18.3,2.4-27.2,4.8l1.3-45.9c8.1-1.6,16.4-2.7,24.7-3.4c5.2-0.4,10.3-0.5,15.2-0.5c4.9,0,10.1,0.2,15.2,0.5c46.6,3.4,91,22.9,125.2,54.8C393.2,242.1,394.7,245.6,394.8,249.4z",
  "M176.6,246.3c-13.1,6.7-25.4,15.2-36.2,25.3c-5.5,5.1-14,5-19.3-0.3l-11.7-11.7c-2.7-2.7-4.1-6.3-4.1-10.1c0.1-3.8,1.6-7.3,4.4-9.9c19.1-17.9,41.5-31.8,65.6-41.3L176.6,246.3z",
  "M300.1,343.8l-43,43c-1.9,1.9-4.4,3-7.1,3c-2.7,0-5.2-1-7.1-3l-33.4-33.4c0.8-2.2,1.3-4.7,1.3-7.4c0-8-3.9-14.3-10-17.3c11.9-9.2,26.2-14.9,41.2-16.4c5.5-0.5,10.9-0.5,16.2,0c15,1.5,29.2,7.2,41.2,16.4c2.2,1.7,3.6,4.4,3.8,7.2C303.3,338.9,302.2,341.8,300.1,343.8z",
  "M184.8,314.4c-1,0.9-2.1,1.7-3.1,2.6c-4.8,4.2-12.2,4-16.7-0.5l-11.4-11.4c-2.4-2.4-3.7-5.6-3.6-9c0.1-3.4,1.5-6.4,4-8.6c7.2-6.5,15-12.2,23.3-17.1l1,35C178.4,309.5,181.1,313,184.8,314.4z",
  "M350,296.1c0.1,3.3-1.2,6.6-3.6,9L335,316.5c-2.4,2.4-5.5,3.6-8.6,3.6c-2.9,0-5.8-1-8.1-3c-15.3-13.6-34.1-22.2-54.3-25c-9.8-1.6-19.1-1.6-27.9,0l-0.2,0c-10.2,1.4-20,4.3-29.2,8.5l1.3-43.7c8.6-2.6,17.6-4.4,26.7-5.4c10-1.1,20.5-1.1,30.5,0c30.2,3.2,58.1,15.6,80.7,36C348.5,289.7,349.9,292.8,350,296.1z",
  "M204.7,346.1c0,7.8-4.9,13-12.3,13c-7.2,0-12.3-5.4-12.3-13s5.1-13,12.3-13C199.9,333,204.7,338.1,204.7,346.1z",
  "M204.7,164.3l-4.1,140.9c-0.1,2.2-1.8,3.9-4,3.9h-8.4c-2.2,0-3.9-1.7-4-3.9l-4.1-140.9c0-1.1,0.4-2.1,1.1-2.9c0.8-0.8,1.8-1.2,2.9-1.2h16.6c1.1,0,2.1,0.4,2.9,1.2C204.4,162.1,204.8,163.2,204.7,164.3z",
]

const LOGIN_NEEDED_PATHS = [
  "M441.3,201.6l-21.5,21.5c-4.5,4.5-11.6,4.6-16.3,0.4c-37.2-33.8-85.5-55.4-138.8-58.8l-6.3-0.3c-2.8-0.1-5.6-0.2-8.4-0.2c-2.8,0-5.6,0.1-8.4,0.2l-6.3,0.3c-13.4,0.9-26.4,2.9-39.1,5.9h0c-3.7-0.6-7.7-0.9-11.9-0.9c-12.8,0-26.5,3.1-36.7,8.4c-5.5,2.8-8.5,8.7-7.9,14.5c-15.6,8.6-30.1,19-43.2,30.9c-4.7,4.2-11.8,4.1-16.3-0.4l-21.5-21.5c-4.8-4.8-4.6-12.6,0.4-17.1c50.3-46.1,117.3-74.3,191-74.3c73.6,0,140.7,28.2,190.9,74.3C445.9,189,446.1,196.8,441.3,201.6z",
  "M196.8,219.8c0,6.3-2.4,12.4-8.6,21.1c-17.6,7.3-33.9,17.7-47.9,30.7c-5.5,5.1-14,5-19.3-0.3l-11.7-11.7c-2.7-2.7-4.1-6.3-4.1-10.1c0.1-3.8,1.6-7.3,4.4-9.9c12.7-11.8,26.7-21.9,41.8-30.2h0c1.4,0.5,2.9,0.7,4.5,0.7c2.1,0,4.2-0.5,6.2-1.4c5.1-2.4,11.6-3.8,17.3-3.8C196.8,205.2,196.8,216.2,196.8,219.8z",
  "M394.8,249.4c0,3.8-1.4,7.4-4.1,10.1L379,271.2c-2.7,2.7-6.3,4.1-9.8,4.1c-3.4,0-6.8-1.2-9.5-3.8c-26.2-24.3-60.1-39.4-95.6-42.4c-10.1-0.7-19.7-0.7-28.2,0c-0.1,0-0.3,0-0.4,0c0.9-3.9,1.4-8,1.4-12.3c0-11.2-3.7-22.5-11.6-31.3c3.1-0.4,6.3-0.7,9.5-0.9c5.2-0.4,10.3-0.5,15.2-0.5c4.9,0,10.1,0.2,15.2,0.5c46.6,3.4,91,22.9,125.2,54.8C393.2,242.1,394.7,245.6,394.8,249.4z",
  "M300.1,343.8l-43,43c-1.9,1.9-4.4,3-7.1,3s-5.2-1-7.1-3l-43-43c-2.1-2.1-3.1-4.9-2.9-7.8c0.2-2.8,1.6-5.5,3.8-7.2c11.9-9.2,26.2-14.9,41.2-16.4c5.5-0.5,10.9-0.5,16.2,0c15,1.5,29.2,7.2,41.2,16.4c2.2,1.7,3.6,4.4,3.8,7.2C303.3,338.9,302.2,341.8,300.1,343.8z",
  "M350,296.1c0.1,3.3-1.2,6.6-3.6,9L335,316.5c-2.4,2.4-5.5,3.6-8.6,3.6c-2.9,0-5.8-1-8.1-3c-15.3-13.6-34.1-22.2-54.3-25c-9.8-1.6-19.1-1.6-27.9,0l-0.2,0c-13.3,1.8-26,6.2-37.4,12.8c0.1-0.8,0.2-1.7,0.1-2.6v-0.2c-0.7-11.9,3.2-21.6,13.4-33.6c4.5-5.3,8.6-10.4,12.2-15.6c3.5-0.6,7-1.1,10.5-1.5c10-1.1,20.5-1.1,30.5,0c30.2,3.2,58.1,15.6,80.7,36C348.5,289.7,349.9,292.8,350,296.1z",
  "M181.1,317.6c-4.8,3.7-11.7,3.3-16.1-1l-11.4-11.4c-2.4-2.4-3.7-5.6-3.6-9c0.1-3.4,1.5-6.4,4-8.6c3.3-3,6.7-5.8,10.2-8.4c-2.6,8.1-3.5,16.2-2.6,24.3l0.1,0.6c0.6,7.6,7,13.5,14.6,13.5L181.1,317.6L181.1,317.6z",
  "M180.3,330.1c-9.4,0-16,6.9-16,16.8c0,9.4,6.4,16.6,15.8,16.6c9.9,0,16-7.2,16-16.6C196,337.1,189.6,330.1,180.3,330.1z",
  "M205.9,263.4c-11.8,13.9-16,25.6-15.2,39.3l0,0c0.1,3.8-2.9,6.9-6.7,6.9h-7.7c-3.5,0-6.4-2.7-6.7-6.2l-0.1-0.8c-1.6-14.4,3.2-30.2,16.6-46.2c12-14.2,18.7-24.6,18.7-36.6c0-13.6-8.6-22.7-25.4-23c-7,0-14.6,1.7-20.7,4.6c-3.5,1.6-7.7-0.1-9.1-3.7l-1.6-4.3c-1.2-3.2,0.2-6.8,3.2-8.3c8.9-4.6,21.3-7.5,33-7.5c30.7,0,44.6,19,44.6,39.3C228.9,235,218.7,248.1,205.9,263.4z",
]

const VIEWBOX = 500
const SCALE = 30 / VIEWBOX
const MINI_SCALE = 16 / VIEWBOX

type WifiVisual =
  | { kind: "disconnected" }
  | { kind: "no-internet" }
  | { kind: "login-needed" }
  | { kind: "signal"; level: 1 | 2 | 3 | 4 }

type WifiSnapshot = {
  enabled: boolean
  ssid: string | null
  internet: AstalNetwork.Internet
  state: AstalNetwork.DeviceState
  strength: number
}



function strengthLevel(strength: number): 1 | 2 | 3 | 4 {
  return strength > 75 ? 4 : strength > 50 ? 3 : strength > 25 ? 2 : 1
}

function resolveWifiVisual(w: WifiSnapshot): WifiVisual {
  if (!w.enabled || !w.ssid) return { kind: "disconnected" }
  if (w.state === AstalNetwork.DeviceState.NEED_AUTH) return { kind: "login-needed" }
  if (w.internet !== AstalNetwork.Internet.CONNECTED) return { kind: "no-internet" }
  return { kind: "signal", level: strengthLevel(w.strength ?? 0) }
}

function signalQualityLabel(level: 1 | 2 | 3 | 4): string {
  switch (level) {
    case 4: return "Excelente"
    case 3: return "Buena"
    case 2: return "Navegable"
    case 1: return "Baja"
  }
}



function connectedStatusLabel(v: WifiVisual): string {
  switch (v.kind) {
    case "disconnected": return "Desconectado"
    case "no-internet": return "Sin internet"
    case "login-needed": return "Inicie sesión"
    case "signal": return signalQualityLabel(v.level)
  }
}




function wifiSignalIconName(v: WifiVisual): string {
  switch (v.kind) {
    case "disconnected": return "network-wireless-offline-symbolic"
    case "no-internet": return "network-wireless-no-route-symbolic"
    case "login-needed": return "network-wireless-symbolic"
    case "signal":
      switch (v.level) {
        case 4: return "network-wireless-signal-excellent-symbolic"
        case 3: return "network-wireless-signal-good-symbolic"
        case 2: return "network-wireless-signal-ok-symbolic"
        case 1: return "network-wireless-signal-weak-symbolic"
      }
  }
}

function buildWifiTooltip(v: WifiVisual, ssid: string | null): string {
  switch (v.kind) {
    case "disconnected":
      return "No conectado"
    case "login-needed":
      return `${ssid ?? "Red desconocida"} · Inicie sesión`
    case "no-internet":
      return `${ssid ?? "Red desconocida"} · Sin internet`
    case "signal":
      return `${ssid ?? "Red desconocida"} · Señal: ${signalQualityLabel(v.level)}`
  }
}

function parseRgb(css: string): [number, number, number] {
  const m = css.match(/(\d+(?:\.\d+)?)/g)
  if (!m || m.length < 3) return [1, 1, 1]
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255]
}





function disconnectWifi(ssid: string): Promise<void> {
  return execAsync(["nmcli", "connection", "down", "id", ssid])
    .then(() => {})
    .catch((e) => {
      console.error(">>> wifi disconnect:", e)
      throw e
    })
}

function forgetWifi(ssid: string): Promise<void> {
  return execAsync(["nmcli", "connection", "delete", "id", ssid])
    .then(() => {})
    .catch((e) => {
      console.error(">>> wifi forget:", e)
      throw e
    })
}







function MiniSignal({ level, active = true }: { level: 1 | 2 | 3 | 4; active?: boolean }) {
  return (
    <drawingarea
      widthRequest={16}
      heightRequest={16}
      valign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        self.set_draw_func((_area, cr: any, width: number, height: number) => {
          cr.save()
          cr.translate((width - VIEWBOX * MINI_SCALE) / 2, (height - VIEWBOX * MINI_SCALE) / 2)
          cr.scale(MINI_SCALE, MINI_SCALE)
          cr.setSourceRGBA(1, 1, 1, active ? 1 : 0.85)
          cr.newPath()
          drawSvgPaths(cr, SIGNAL_ARCS.slice(0, level))
          cr.fill()
          cr.restore()
        })
      }}
    />
  )
}





type ApInfo = {
  ap: AstalNetwork.AccessPoint
  ssid: string
  strength: number
  requiresPassword: boolean
  isActive: boolean
}

function buildApList(wifi: AstalNetwork.Wifi): ApInfo[] {
  const raw = (wifi.get_access_points() ?? []) as AstalNetwork.AccessPoint[]
  const active = wifi.get_active_access_point()
  const activeBssid = active ? active.get_bssid() : null

  const bySsid = new Map<string, ApInfo>()
  for (const ap of raw) {
    const ssid = ap.get_ssid()
    if (!ssid) continue
    const strength = ap.get_strength()
    const existing = bySsid.get(ssid)
    if (!existing || strength > existing.strength) {
      bySsid.set(ssid, {
        ap,
        ssid,
        strength,
        requiresPassword: ap.get_requires_password(),
        isActive: activeBssid !== null && ap.get_bssid() === activeBssid,
      })
    }
  }

  return [...bySsid.values()].sort((a, b) => b.strength - a.strength)
}

type RowStatus = "idle" | "connecting" | "need-password" | "error"

function NetworkRow({ info }: { info: ApInfo }) {
  const [status, setStatus] = createState<RowStatus>("idle")
  let pendingPassword = ""

  function tryConnect(password: string | null) {
    setStatus("connecting")
    info.ap.activate(password, (_source: unknown, res: unknown) => {
      try {

        info.ap.activate_finish(res)
        setStatus("idle")
      } catch (e) {
        console.error(">>> wifi ap.activate:", e)
        setStatus("error")
      }
    }, null)
  }

  function handleRowClick() {
    if (info.isActive || status.get() === "connecting") return
    if (!info.requiresPassword || info.ap.get_connections().length > 0) {
      tryConnect(null)
      return
    }
    setStatus("need-password")
  }

  return (
    <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["wifi-row"]}>
      <button cssClasses={["wifi-row-main"]} onClicked={handleRowClick}>
        <box spacing={8}>
          <MiniSignal level={strengthLevel(info.strength)} active={info.isActive} />
          <label
            label={info.ssid}
            hexpand
            halign={Gtk.Align.START}
            ellipsize={Pango.EllipsizeMode.END}
            cssClasses={info.isActive ? ["wifi-row-label", "wifi-row-active"] : ["wifi-row-label"]}
          />
          <image iconName="dialog-password-symbolic" pixelSize={12} visible={info.requiresPassword} />
          <Gtk.Spinner spinning={status.as((s) => s === "connecting")} visible={status.as((s) => s === "connecting")} />
          <image iconName="object-select-symbolic" pixelSize={14} visible={info.isActive} />
        </box>
      </button>

      <revealer
        revealChild={status.as((s) => s === "need-password")}
        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
      >
        <box spacing={6} cssClasses={["wifi-password-box"]}>
          <entry
            placeholderText="Contraseña"
            visibility={false}
            hexpand
            onActivate={() => tryConnect(pendingPassword)}
            $={(self: Gtk.Entry) => {
              self.connect("notify::text", () => { pendingPassword = self.get_text() })
            }}
          />
          <button label="Conectar" onClicked={() => tryConnect(pendingPassword)} />
        </box>
      </revealer>

      <label
        label="No se pudo conectar. Verificá la contraseña."
        cssClasses={["wifi-row-error"]}
        visible={status.as((s) => s === "error")}
        wrap
      />
    </box>
  )
}





type ConnectedInfo = { ssid: string; visual: WifiVisual } | null

function WifiPopoverContent({ network }: { network: AstalNetwork.Network }) {
  const [aps, setAps] = createState<ApInfo[]>([])
  const [scanning, setScanning] = createState(false)
  const [connected, setConnected] = createState<ConnectedInfo>(null)
  const [busy, setBusy] = createState(false)

  function refreshAps() {
    const wifi = network.wifi
    const list = wifi ? buildApList(wifi) : []

    setAps(list.filter((a) => !a.isActive))
  }

  function refreshConnected() {
    const wifi = network.wifi
    if (!wifi || !wifi.enabled || !wifi.ssid) {
      setConnected(null)
      return
    }
    const visual = resolveWifiVisual({
      enabled: wifi.enabled,
      ssid: wifi.ssid,
      internet: wifi.internet,
      state: wifi.state,
      strength: wifi.strength,
    })
    setConnected({ ssid: wifi.ssid, visual })
  }

  function refresh() {
    refreshAps()
    refreshConnected()
  }

  async function handleDisconnect() {
    const c = connected.get()
    if (!c) return
    setBusy(true)
    try {
      await disconnectWifi(c.ssid)
    } catch {

    }
    setBusy(false)
    refresh()
  }

  async function handleForget() {
    const c = connected.get()
    if (!c) return
    setBusy(true)
    try {
      await forgetWifi(c.ssid)
    } catch {

    }
    setBusy(false)
    refresh()
  }

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={4}
      cssClasses={["wifi-popover"]}
      $={(self: Gtk.Box) => {
        let apSignalId: number | null = null
        let extraIds: number[] = []
        let scanTimeoutId: number | null = null

        function detach() {
          const wifi = network.wifi
          if (wifi) {
            if (apSignalId !== null) wifi.disconnect(apSignalId)
            for (const id of extraIds) wifi.disconnect(id)
          }
          apSignalId = null
          extraIds = []
          if (scanTimeoutId !== null) { clearTimeout(scanTimeoutId); scanTimeoutId = null }
          setScanning(false)
        }

        function attach() {
          detach()
          const wifi = network.wifi
          if (wifi) {
            apSignalId = wifi.connect("notify::access-points", refreshAps)
            for (const prop of ["ssid", "strength", "internet", "state", "enabled"]) {
              extraIds.push(wifi.connect(`notify::${prop}`, refreshConnected))
            }
            try {
              wifi.scan()
              setScanning(true)


              scanTimeoutId = setTimeout(() => setScanning(false), 4000) as unknown as number
            } catch (e) {
              console.error(">>> wifi.scan:", e)
            }
          }
          refresh()
        }




        self.connect("map", attach)
        self.connect("unmap", detach)

        const networkSignalId = network.connect("notify::wifi", () => {
          if (self.get_mapped()) attach()
          else refresh()
        })

        self.connect("destroy", () => {
          detach()
          network.disconnect(networkSignalId)
        })
      }}
    >
      <label label="Conectada" halign={Gtk.Align.START} cssClasses={["wifi-popover-title"]} />

      {}
      <box
        cssClasses={["wifi-row-connected"]}
        spacing={8}
        visible={connected.as((c) => c !== null)}
      >
        <image
          iconName={connected.as((c) => (c ? wifiSignalIconName(c.visual) : "network-wireless-offline-symbolic"))}
          pixelSize={16}
        />
        <label
          label={connected.as((c) => c?.ssid ?? "")}
          hexpand
          halign={Gtk.Align.START}
          ellipsize={Pango.EllipsizeMode.END}
          cssClasses={["wifi-row-label", "wifi-row-active"]}
        />
        <label
          label={connected.as((c) => (c ? connectedStatusLabel(c.visual) : ""))}
          cssClasses={["wifi-row-quality"]}
        />
        <Gtk.Spinner spinning={busy} visible={busy} />
        <image
          iconName="media-eject-symbolic"
          pixelSize={14}
          cssClasses={["wifi-row-action"]}
          $={(self: Gtk.Image) => {
            const click = new Gtk.GestureClick()
            click.connect("released", (gesture: Gtk.GestureClick) => {
              gesture.set_state(Gtk.EventSequenceState.CLAIMED)
              handleDisconnect()
            })
            self.add_controller(click)
          }}
        />
        <image
          iconName="user-trash-symbolic"
          pixelSize={14}
          cssClasses={["wifi-row-action"]}
          $={(self: Gtk.Image) => {
            const click = new Gtk.GestureClick()
            click.connect("released", (gesture: Gtk.GestureClick) => {
              gesture.set_state(Gtk.EventSequenceState.CLAIMED)
              handleForget()
            })
            self.add_controller(click)
          }}
        />
      </box>

      {}
      <label
        label="No conectado"
        halign={Gtk.Align.START}
        cssClasses={["wifi-row-empty"]}
        visible={connected.as((c) => c === null)}
      />

      <box heightRequest={1} cssClasses={["wifi-separator"]} />

      <box spacing={6} cssClasses={["wifi-popover-header"]}>
        <label label="Redes disponibles" hexpand halign={Gtk.Align.START} cssClasses={["wifi-popover-title"]} />
        <Gtk.Spinner spinning={scanning} visible={scanning} />
      </box>

      <scrolledwindow heightRequest={220} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          <For each={aps}>
            {(info: ApInfo) => <NetworkRow info={info} />}
          </For>
        </box>
      </scrolledwindow>
    </box>
  )
}





export default function WifiIcon({ color = "rgb(226,226,230)" }: { color?: string } = {}) {
  const network = AstalNetwork.get_default()
  const [r, g, b] = parseRgb(color)

  return (
    <menubutton cssClasses={["wifi-menubutton"]}>
      <drawingarea
        widthRequest={30}
        heightRequest={30}
        valign={Gtk.Align.CENTER}
        $={(self: Gtk.DrawingArea) => {
          let currentVisual: WifiVisual = { kind: "disconnected" }
          let wifi: AstalNetwork.Wifi | null = null
          let wifiSignalIds: number[] = []

          const detachWifiSignals = () => {
            if (wifi) for (const id of wifiSignalIds) wifi.disconnect(id)
            wifiSignalIds = []
          }

          const recompute = () => {
            currentVisual = wifi
              ? resolveWifiVisual({
                  enabled: wifi.enabled,
                  ssid: wifi.ssid,
                  internet: wifi.internet,
                  state: wifi.state,
                  strength: wifi.strength,
                })
              : { kind: "disconnected" }

            self.set_tooltip_text(buildWifiTooltip(currentVisual, wifi?.ssid ?? null))
            self.queue_draw()
          }

          const attachWifi = (w: AstalNetwork.Wifi | null) => {
            detachWifiSignals()
            wifi = w
            if (wifi) {
              for (const prop of ["enabled", "ssid", "internet", "state", "strength"]) {
                wifiSignalIds.push(wifi.connect(`notify::${prop}`, recompute))
              }
            }
            recompute()
          }

          attachWifi(network.wifi)
          const networkSignalId = network.connect("notify::wifi", () => attachWifi(network.wifi))

          self.set_draw_func((_area, cr, width, height) => {
            cr.save()
            cr.translate((width - VIEWBOX * SCALE) / 2, (height - VIEWBOX * SCALE) / 2)
            cr.scale(SCALE, SCALE)
            cr.setSourceRGBA(r, g, b, 1)
            cr.newPath()
            switch (currentVisual.kind) {
              case "disconnected":
                drawSvgPaths(cr, NO_CONNECTED_PATHS)
                break
              case "no-internet":
                drawSvgPaths(cr, NO_NET_PATHS)
                break
              case "login-needed":
                drawSvgPaths(cr, LOGIN_NEEDED_PATHS)
                break
              case "signal":
                drawSvgPaths(cr, SIGNAL_ARCS.slice(0, currentVisual.level))
                break
            }
            cr.fill()
            cr.restore()
          })

          self.connect("destroy", () => {
            detachWifiSignals()
            network.disconnect(networkSignalId)
          })
        }}
      />

      <popover cssClasses={["wifi-popover-container"]}>
        <WifiPopoverContent network={network} />
      </popover>
    </menubutton>
  )
}

