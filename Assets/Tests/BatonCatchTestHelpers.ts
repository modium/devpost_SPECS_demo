// Shared helpers for the Reaction Baton Catch LEAF scenarios.
// Test-only code: reads game state from BatonCatchMain / BatonCatchPanelUI and drives
// real SIK interactions through a DefaultLeafInteractor. Never edits game code or Inspector defaults.

import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {BatonCatchMain} from "../Scripts/BatonCatchMain"
import {BatonCatchPanelUI} from "../Scripts/BatonCatchPanelUI"

export const ROOT_NAME = "ReactionBatonCatch"
export const PANEL_NAME = "GamePanel"
export const ACTION_BUTTON_NAME = "ActionButton"

export function getGame(): BatonCatchMain {
  const root = findSceneObjectByName(ROOT_NAME)
  if (!root) throw new Error(`SceneObject "${ROOT_NAME}" not found`)
  const game = root.getComponent(BatonCatchMain.getTypeName()) as BatonCatchMain
  if (!game) throw new Error(`BatonCatchMain not found on "${ROOT_NAME}"`)
  return game
}

export function getPanel(): BatonCatchPanelUI {
  const so = findSceneObjectByName(PANEL_NAME)
  if (!so) throw new Error(`SceneObject "${PANEL_NAME}" not found`)
  const panel = so.getComponent(BatonCatchPanelUI.getTypeName()) as BatonCatchPanelUI
  if (!panel) throw new Error(`BatonCatchPanelUI not found on "${PANEL_NAME}"`)
  return panel
}

export function getActionButton(): Interactable {
  const btn = findInteractableByName(ACTION_BUTTON_NAME, undefined, true)
  if (!btn) throw new Error(`Interactable "${ACTION_BUTTON_NAME}" not found or not enabled`)
  return btn
}

/** Polls `cond` each frame until true or timeout. Returns true if met. */
export async function waitUntil(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = getTime()
  while (!cond()) {
    if ((getTime() - start) * 1000 > timeoutMs) return false
    await nextFrame()
  }
  return true
}

/** Waits for the game to finish placing itself in front of the user. */
export async function waitForPlaced(): Promise<void> {
  const game = getGame()
  const ok = await waitUntil(() => game.placed, 5000)
  if (!ok) throw new Error("BatonCatchMain never set placed=true")
  await sleep(300)
}

/** Real SIK click on the panel's ActionButton. */
export async function clickActionButton(interactor: DefaultLeafInteractor): Promise<void> {
  await interactor.trigger(getActionButton())
  await sleep(200)
}

/**
 * Brings the game back to "idle" using real clicks on the ActionButton
 * (Reset while countdown/playing; Retry then Reset when finished).
 */
export async function ensureIdle(interactor: DefaultLeafInteractor): Promise<void> {
  const game = getGame()
  for (let i = 0; i < 4 && game.phase !== "idle"; i++) {
    await clickActionButton(interactor)
    await sleep(200)
  }
  if (game.phase !== "idle") throw new Error(`Could not reach idle; phase=${game.phase}`)
}

/**
 * Real SIK click on a baton's Interactable. The game disables the baton inside onTriggerStart,
 * so SIK may never deliver onTriggerEnd to it; LEAF's trigger() would then wait forever.
 * We race the trigger against "baton is no longer alive" and a timeout.
 */
export async function clickBaton(
  interactor: DefaultLeafInteractor,
  batonRoot: SceneObject,
  timeoutMs: number = 2000,
): Promise<{triggerStarted: boolean; triggerCompleted: boolean}> {
  const interactable = batonRoot.getComponent(Interactable.getTypeName()) as Interactable
  if (!interactable) throw new Error(`No Interactable on ${batonRoot.name}`)
  let triggerStarted = false
  let triggerCompleted = false
  interactable.onTriggerStart.add(() => {
    triggerStarted = true
  })
  interactor
    .trigger(interactable)
    .then(() => {
      triggerCompleted = true
    })
    .catch((e) => print(`[BatonCatchTest] baton trigger error: ${e}`))
  await waitUntil(
    () => triggerCompleted || isNull(batonRoot) || !batonRoot.enabled,
    timeoutMs,
  )
  return {triggerStarted, triggerCompleted}
}

/** Bottom Y of a baton root (root is at the baton's center). */
export function batonBottomY(root: SceneObject, lengthCm: number): number {
  return root.getTransform().getWorldPosition().y - lengthCm / 2
}
