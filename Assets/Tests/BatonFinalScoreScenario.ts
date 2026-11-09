// Done criterion 4: After all batons have dropped, the final score shows along with a Retry button.
// Catches the first falling baton with a real click (runtime fallSlowdown override, config
// "fallSlowdown", default 8, restored after) so the final score is non-zero; the rest are missed.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {
  clickActionButton,
  clickBaton,
  ensureIdle,
  getGame,
  getPanel,
  waitForPlaced,
  waitUntil,
} from "./BatonCatchTestHelpers"

@component
export class BatonFinalScoreScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const interactor = new DefaultLeafInteractor()
    const game = getGame()
    const panel = getPanel()
    const originalSlowdown = game.fallSlowdown
    const slowdown = config?.getNumber("fallSlowdown") ?? 8
    try {
      await waitForPlaced()
      await ensureIdle(interactor)
      game.fallSlowdown = slowdown
      await clickActionButton(interactor) // real click on Start

      const falling = await waitUntil(() => game.getFallingBatons().length > 0, 6000)
      expect(falling).toBe(true)
      await clickBaton(interactor, game.getFallingBatons()[0])
      await sleep(100)
      expect(game.score).toBe(1)
      // Restore shipped speed for the rest of the round.
      game.fallSlowdown = originalSlowdown

      const total = game.totalBatons
      // Before every baton has dropped, no final score yet.
      expect(game.phase).toBe("playing")
      expect(panel.isRetryVisible).toBe(false)

      const timeoutMs = (game.dropIntervalSeconds * total + 5) * 1000
      const finished = await waitUntil(() => game.phase === "finished", timeoutMs)
      expect(finished).toBe(true)
      await sleep(100)

      expect(game.droppedCount).toBe(total)
      expect(game.caughtCount + game.missedCount).toBe(total)
      expect(game.activeBatonCount).toBe(0)
      expect(panel.captionText).toBe("Final score")
      expect(panel.valueText).toBe(`${game.score} / ${total}`)
      expect(panel.actionButtonLabel).toBe("Retry")
      expect(panel.isRetryVisible).toBe(true)
      print(`[BatonCatchTest] final panel: "${panel.captionText}" "${panel.valueText}" button="${panel.actionButtonLabel}"`)

      // Retry works with a real click: fresh set and a new countdown.
      await clickActionButton(interactor)
      expect(game.phase).toBe("countdown")
      expect(game.activeBatonCount).toBe(total)
      expect(game.score).toBe(0)
    } finally {
      game.fallSlowdown = originalSlowdown
      await ensureIdle(interactor)
    }
  }
}
