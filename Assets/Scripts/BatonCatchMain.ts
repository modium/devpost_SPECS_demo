// BatonCatchMain — game controller for Reaction Baton Catch.
// Owns: round flow (idle → countdown → playing → finished), score, the random drop order and drop timer,
//       spawning a fresh arc of batons (on awake, Reset and Retry), the floor check, and destroying
//       batons once they are caught or cross the floor.
// Expects (@input): panel (BatonCatchPanelUI), batonArc (authored root at the arc's center — the player),
//       floor (authored VirtualFloor stand-in; its world Y is the miss line), batonMaterial.
// Must NOT: create text or UIKit widgets (all visible strings live in BatonCatchPanelUI).
//
// Test-facing state (read these from LEAF): phase, score, countdownText, activeBatonCount,
// droppedCount, caughtCount, missedCount, totalBatons, fallingBatonNames, getFallingBatons(),
// getBatonObjects(). Batons are named "Baton_01".."Baton_NN" (left → right) under the batonArc root.

import {BatonCatchPanelUI} from "./BatonCatchPanelUI"
import {BatonCatchBaton, BatonLook} from "./BatonCatchBaton"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

export type GamePhase = "idle" | "countdown" | "playing" | "finished"

const GRAVITY_CM_PER_S2 = 980

@component
export class BatonCatchMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BatonCatchMain – round flow, batons, score</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The center-bottom game panel (Start / countdown / score / Retry / Reset)")
  panel: BatonCatchPanelUI

  @input
  @hint("Arc center (the player's spot). Move/raise it to move the whole arc; its Y is the batons' bottom height")
  batonArc: SceneObject

  @input
  @hint("Virtual floor stand-in. A baton whose bottom crosses this object's world Y counts as dropped")
  floor: SceneObject

  @input
  @hint("Material cloned onto every baton (color is set per baton)")
  batonMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Game</span>')
  @ui.group_start("Game")
  @input
  @hint("On launch, move this whole experience (arc, panel, floor) to the user's start position and facing, so it appears in front of them and then stays fixed in the world")
  placeAtStart: boolean = true

  @input
  @hint("Number of batons in the arc")
  @widget(new SliderWidget(1, 20, 1))
  batonCount: number = 10

  @input
  @hint("Fall speed: gravity is divided by this. 1 = real gravity, 3 = default, higher = slower/easier")
  @widget(new SliderWidget(1, 10, 0.1))
  fallSlowdown: number = 3

  @input
  @hint("Seconds between baton drops")
  @widget(new SliderWidget(0.5, 5, 0.1))
  dropIntervalSeconds: number = 2

  @input
  @hint("Countdown length in seconds (shows 3, 2, 1 …)")
  @widget(new SliderWidget(1, 5, 1))
  countdownSeconds: number = 3
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Arc & Baton</span>')
  @ui.group_start("Arc & Baton")
  @input
  @hint("Arc width (chord) in cm. 52 keeps the end batons inside the SPECS view (~32° wide) at 100 cm")
  @widget(new SliderWidget(20, 120, 1))
  arcWidthCm: number = 52

  @input
  @hint("Distance from the player to the arc in cm")
  @widget(new SliderWidget(50, 200, 1))
  arcDistanceCm: number = 100

  @input
  @hint("Baton length in cm")
  @widget(new SliderWidget(20, 50, 0.5))
  batonLengthCm: number = 30

  @input
  @hint("Baton thickness in cm")
  @widget(new SliderWidget(1, 6, 0.1))
  batonDiameterCm: number = 3

  @input
  @hint("Extra grab area around each baton, per side, in cm")
  @widget(new SliderWidget(0, 3, 0.1))
  grabPaddingCm: number = 1.0

  @input("vec4", "{1, 0.62, 0.2, 1}")
  @hint("Baton color (light/bright — black is invisible on Specs)")
  @widget(new ColorWidget())
  batonColor: vec4 = new vec4(1, 0.62, 0.2, 1)

  @input("vec4", "{1, 0.95, 0.6, 1}")
  @hint("Baton color while aimed at")
  @widget(new ColorWidget())
  highlightColor: vec4 = new vec4(1, 0.95, 0.6, 1)
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Draw every baton's grab collider")
  debugColliders: boolean = false
  @ui.group_end

  // ── Public, test-facing state ─────────────────────────────────────────────
  phase: GamePhase = "idle"
  score = 0
  countdownText = ""
  droppedCount = 0
  caughtCount = 0
  missedCount = 0

  private batons: BatonCatchBaton[] = []
  private dropOrder: BatonCatchBaton[] = []
  private nextDropIndex = 0
  private phaseTime = 0
  private dropTimer = 0
  private pendingDestroy: BatonCatchBaton[] = []
  private framesSinceStart = 0
  placed = false

  get totalBatons(): number { return this.batons.length }
  get activeBatonCount(): number { return this.batons.filter((b) => b.isAlive).length }
  get fallingBatonNames(): string[] { return this.getFallingBatons().map((o) => o.name) }
  getFallingBatons(): SceneObject[] {
    return this.batons.filter((b) => b.state === "falling").map((b) => b.root)
  }
  getBatonObjects(): SceneObject[] {
    return this.batons.filter((b) => b.isAlive).map((b) => b.root)
  }

  onAwake(): void {
    if (!this.validateRefs()) return
    this.spawnFreshSet()
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.panel.onStart.add(() => this.startRound())
    this.panel.onReset.add(() => this.resetRound())
    this.panel.onRetry.add(() => this.retryRound())
    this.panel.showIdle()
  }

  // ── Round control (public so tests can drive it directly) ────────────────
  startRound(): void {
    if (this.phase !== "idle") return
    this.score = 0
    this.droppedCount = 0
    this.caughtCount = 0
    this.missedCount = 0
    this.dropOrder = this.shuffled(this.batons)
    this.nextDropIndex = 0
    this.phase = "countdown"
    this.phaseTime = 0
    this.updateCountdown()
    print(`[BatonCatch] Round started — drop order: ${this.dropOrder.map((b) => b.name).join(", ")}`)
  }

  resetRound(): void {
    this.spawnFreshSet()
    this.phase = "idle"
    this.score = 0
    this.countdownText = ""
    this.droppedCount = 0
    this.caughtCount = 0
    this.missedCount = 0
    this.panel.showIdle()
    print("[BatonCatch] Reset")
  }

  retryRound(): void {
    this.resetRound()
    this.startRound()
  }

  /** Test helper: simulate grabbing a baton by name. Returns true if it counted as a catch. */
  catchBatonByName(name: string): boolean {
    const b = this.batons.find((x) => x.name === name)
    return b ? b.tryCatch() : false
  }

  // ── Frame loop ────────────────────────────────────────────────────────────
  private onUpdate(): void {
    this.flushDestroyed()
    this.placeInFrontOfUser()
    const dt = getDeltaTime()

    if (this.phase === "countdown") {
      this.phaseTime += dt
      if (this.phaseTime >= this.countdownSeconds) {
        this.phase = "playing"
        this.countdownText = ""
        this.panel.showScore(this.score)
        this.dropTimer = 0
        this.dropNext()
      } else {
        this.updateCountdown()
      }
      return
    }

    if (this.phase !== "playing") return

    // Drop timer
    if (this.nextDropIndex < this.dropOrder.length) {
      this.dropTimer += dt
      if (this.dropTimer >= this.dropIntervalSeconds) {
        this.dropTimer -= this.dropIntervalSeconds
        this.dropNext()
      }
    }

    // Fall + floor check
    const gravity = GRAVITY_CM_PER_S2 / Math.max(0.01, this.fallSlowdown)
    const floorY = this.floor.getTransform().getWorldPosition().y
    for (const b of this.batons) {
      if (b.state !== "falling") continue
      if (b.step(dt, gravity, floorY)) {
        b.markMissed()
        this.missedCount++
        this.pendingDestroy.push(b)
        print(`[BatonCatch] Missed ${b.name} (score ${this.score})`)
      }
    }

    // Round end: every baton dropped and resolved.
    if (this.nextDropIndex >= this.dropOrder.length && this.activeBatonCount === 0) {
      this.phase = "finished"
      this.panel.showFinal(this.score, this.batons.length)
      print(`[BatonCatch] Finished — final score ${this.score} / ${this.batons.length}`)
    }
  }

  /** Places the experience root at the user's start pose (yaw only) once tracking has started. */
  private placeInFrontOfUser(): void {
    if (this.placed || !this.placeAtStart) return
    this.framesSinceStart++
    if (this.framesSinceStart < 3) return // let device tracking deliver a real head pose first
    this.placed = true
    const cam = WorldCameraFinderProvider.getInstance()
    const pos = cam.getWorldPosition()
    const fwd = cam.forward() // +Z of the camera = behind the view direction
    const yaw = Math.atan2(fwd.x, fwd.z)
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(pos)
    t.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    print(`[BatonCatch] Placed in front of user at ${pos} (yaw ${(yaw * 180 / Math.PI).toFixed(1)}°)`)
  }

  private dropNext(): void {
    const b = this.dropOrder[this.nextDropIndex++]
    if (!b) return
    b.drop()
    this.droppedCount++
    print(`[BatonCatch] Dropping ${b.name} (${this.droppedCount}/${this.dropOrder.length})`)
  }

  private onBatonCaught(b: BatonCatchBaton): void {
    if (this.phase !== "playing") return
    this.score++
    this.caughtCount++
    this.pendingDestroy.push(b)
    this.panel.showScore(this.score)
    print(`[BatonCatch] Caught ${b.name} — score ${this.score}`)
  }

  private updateCountdown(): void {
    const remaining = Math.max(1, Math.ceil(this.countdownSeconds - this.phaseTime))
    const text = `${remaining}`
    if (text !== this.countdownText) {
      this.countdownText = text
      this.panel.showCountdown(text)
    }
  }

  // ── Baton set ─────────────────────────────────────────────────────────────
  private spawnFreshSet(): void {
    for (const b of this.batons) b.destroy()
    this.batons = []
    this.pendingDestroy = []
    this.dropOrder = []
    this.nextDropIndex = 0

    const look: BatonLook = {
      lengthCm: this.batonLengthCm,
      diameterCm: this.batonDiameterCm,
      grabPaddingCm: this.grabPaddingCm,
      material: this.batonMaterial,
      color: this.batonColor,
      highlightColor: this.highlightColor,
      debugCollider: this.debugColliders,
    }

    const n = Math.max(1, Math.round(this.batonCount))
    const half = Math.asin(Math.min(1, (this.arcWidthCm / 2) / this.arcDistanceCm))
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const a = -half + t * half * 2
      // Arc around the player; local Y = half length so the arc root's Y is the batons' bottom height.
      const pos = new vec3(this.arcDistanceCm * Math.sin(a), this.batonLengthCm / 2, -this.arcDistanceCm * Math.cos(a))
      const name = `Baton_${(i + 1 < 10 ? "0" : "") + (i + 1)}`
      const baton = new BatonCatchBaton(this.batonArc, name, pos, look)
      baton.onCaught = (bb) => this.onBatonCaught(bb)
      this.batons.push(baton)
    }
  }

  private flushDestroyed(): void {
    if (this.pendingDestroy.length === 0) return
    for (const b of this.pendingDestroy) b.destroy()
    this.pendingDestroy = []
  }

  private shuffled<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }

  private validateRefs(): boolean {
    const missing: string[] = []
    if (!this.panel) missing.push("panel")
    if (!this.batonArc) missing.push("batonArc")
    if (!this.floor) missing.push("floor")
    if (!this.batonMaterial) missing.push("batonMaterial")
    if (missing.length > 0) {
      print(`[BatonCatch] ERROR: missing @input wiring: ${missing.join(", ")}`)
      return false
    }
    return true
  }
}
