// Done criterion 1: When I click Start, a countdown appears going 3, 2, 1,
// and the first baton drops after it.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {clickActionButton, ensureIdle, getGame, getPanel, waitForPlaced} from "./BatonCatchTestHelpers"

@component
export class BatonCountdownScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new DefaultLeafInteractor()
    const game = getGame()
    const panel = getPanel()
    await waitForPlaced()
    await ensureIdle(interactor)

    expect(panel.actionButtonLabel).toBe("Start")
    expect(panel.isStartVisible).toBe(true)
    const droppedBefore = game.droppedCount

    // Real SIK click on Start. Sampling starts right after the click.
    await clickActionButton(interactor)
    expect(game.phase).toBe("countdown")
    expect(panel.actionButtonLabel).toBe("Reset") // Start hidden once the round starts

    const seq: string[] = []
    const seqTimes: number[] = []
    const t0 = getTime()
    let droppedDuringCountdown = false
    while (game.phase === "countdown" && getTime() - t0 < 6) {
      const v = panel.valueText
      if (seq.length === 0 || seq[seq.length - 1] !== v) {
        seq.push(v)
        seqTimes.push(getTime() - t0)
      }
      // Countdown on the panel must mirror the game state
      expect(panel.valueText).toBe(game.countdownText)
      if (game.droppedCount !== 0) droppedDuringCountdown = true
      await nextFrame()
    }
    print(`[BatonCatchTest] countdown seq=${JSON.stringify(seq)} times=${JSON.stringify(seqTimes.map((t) => t.toFixed(2)))}`)

    expect(seq.join(",")).toBe("3,2,1")
    expect(droppedDuringCountdown).toBe(false)
    // ~1 s per number (allow frame jitter; the click itself takes ~0.2 s)
    expect(seqTimes[2] - seqTimes[1]).toBeCloseTo(1.0, 0)

    // First baton drops as soon as the countdown ends.
    expect(game.phase).toBe("playing")
    expect(game.droppedCount).toBe(1)
    expect(game.fallingBatonNames.length + game.missedCount + game.caughtCount).toBe(1)
    expect(game.countdownText).toBe("")
    expect(panel.captionText).toBe("Score")
    print(`[BatonCatchTest] first baton: ${game.fallingBatonNames.join(",")} (droppedBefore=${droppedBefore})`)

    await sleep(200)
    await ensureIdle(interactor)
  }
}
