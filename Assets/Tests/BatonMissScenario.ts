// Done criterion 3: When I fail to catch a baton, it disappears when it crosses the floor
// and the score doesn't change. Runs at the shipped fall speed (no overrides).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {
  batonBottomY,
  clickActionButton,
  ensureIdle,
  getGame,
  getPanel,
  waitForPlaced,
  waitUntil,
} from "./BatonCatchTestHelpers"

@component
export class BatonMissScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new DefaultLeafInteractor()
    const game = getGame()
    const panel = getPanel()
    try {
      await waitForPlaced()
      await ensureIdle(interactor)
      await clickActionButton(interactor) // real click on Start

      const falling = await waitUntil(() => game.getFallingBatons().length > 0, 6000)
      expect(falling).toBe(true)
      const baton = game.getFallingBatons()[0]
      const name = baton.name
      const scoreBefore = game.score
      const missedBefore = game.missedCount
      const floorY = findSceneObjectByName("VirtualFloor").getTransform().getWorldPosition().y
      const len = game.batonLengthCm
      const startBottom = batonBottomY(baton, len)

      // Track the baton in LateUpdate (after the game's Update moved it / checked the floor),
      // without touching it. On the miss frame the baton is disabled but not yet destroyed
      // (destroyed at the start of the next Update), so its final position is still readable.
      let lastVisibleBottom = startBottom // last frame it was still enabled
      let hiddenAtBottom: number | null = null // position on the frame it was hidden
      const sampler = this.createEvent("LateUpdateEvent")
      sampler.bind(() => {
        if (hiddenAtBottom !== null || isNull(baton)) return
        const b = batonBottomY(baton, len)
        if (baton.enabled) lastVisibleBottom = b
        else hiddenAtBottom = b
      })
      const t0 = getTime()
      await waitUntil(() => hiddenAtBottom !== null || isNull(baton), 5000)
      sampler.enabled = false
      const fallTime = getTime() - t0
      print(`[BatonCatchTest] ${name} start bottom ${startBottom.toFixed(1)}, last visible ${lastVisibleBottom.toFixed(1)}, hidden at ${hiddenAtBottom === null ? "n/a" : hiddenAtBottom.toFixed(1)}, floor ${floorY.toFixed(1)}, fell ${fallTime.toFixed(2)}s`)
      await nextFrame()

      // It disappeared (within the timeout)
      expect(hiddenAtBottom !== null).toBe(true)
      expect(isNull(baton) || !baton.enabled).toBe(true)
      expect(game.getBatonObjects().map((o) => o.name).indexOf(name)).toBe(-1)
      // It disappeared exactly when it crossed the floor: still above the floor on the
      // last visible frame, at/below the floor on the frame it was hidden.
      expect(startBottom).toBeGreaterThan(floorY + 50)
      expect(lastVisibleBottom).toBeGreaterThan(floorY)
      expect(hiddenAtBottom <= floorY + 0.01).toBe(true)
      // Score unchanged, counted as a miss
      expect(game.score).toBe(scoreBefore)
      expect(panel.valueText).toBe(`${scoreBefore}`)
      expect(game.missedCount).toBe(missedBefore + 1)
    } finally {
      await ensureIdle(interactor)
    }
  }
}
