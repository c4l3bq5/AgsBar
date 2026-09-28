import { ensurePairingAgent } from "./lib/pairingAgent"
import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import DynamicIsland from "./widget/DynamicIsland"
import PowerModal from "./widget/PowerModal"
import PairingModal from "./widget/PairingModal"
import ClockScreen from "./widget/ClockScreen"

PowerModal()

ensurePairingAgent()

ClockScreen()

app.start({
  css: style,
  main() {
    app.get_monitors().forEach((m)=>{
      Bar(m)
      PairingModal(m)
    })
    DynamicIsland()
  },
})