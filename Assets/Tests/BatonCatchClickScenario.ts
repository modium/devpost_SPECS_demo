// Done criterion 2: When I click a falling baton, it disappears and the score goes up by 1.
// Runtime-only override: fallSlowdown (config "fallSlowdown", default 8) so the scripted click
// lands before the baton reaches the floor. The Inspector value is restored at the end.
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
export class BatonCatchClickScenario extends Scenario {
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
      print(`[BatonCatchTest] fallSlowdown runtime override ${originalSlowdown} -> ${slowdown}`)

      await clickActionButton(interactor) // real click on Start
      expect(game.phase).toBe("countdown")

      // Wait for the first baton to start falling.
      const falling = await waitUntil(() => game.getFallingBatons().length > 0, 6000)
      expect(falling).toBe(true)
      const baton = game.getFallingBatons()[0]
      const name = baton.name
      const scoreBefore = game.score
      const caughtBefore = game.caughtCount
      const aliveBefore = game.activeBatonCount

      const res = await clickBaton(interactor, baton)
      print(`[BatonCatchTest] clicked ${name}: triggerStarted=${res.triggerStarted} triggerCompleted=${res.triggerCompleted}`)
      await sleep(100)

      expect(res.triggerStarted).toBe(true)
      // Disappears: hidden immediately, destroyed next frame, no longer listed
      expect(isNull(baton) || !baton.enabled).toBe(true)
      expect(game.getBatonObjects().map((o) => o.name).indexOf(name)).toBe(-1)
      expect(game.activeBatonCount).toBe(aliveBefore - 1)
      // Score +1 (delta), shown on the panel
      expect(game.score).toBe(scoreBefore + 1)
      expect(game.caughtCount).toBe(caughtBefore + 1)
      expect(panel.valueText).toBe(`${game.score}`)
      expect(panel.captionText).toBe("Score")
    } finally {
      game.fallSlowdown = originalSlowdown
      await ensureIdle(interactor)
    }
  }
}
