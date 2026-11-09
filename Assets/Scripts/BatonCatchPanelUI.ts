// BatonCatchPanelUI — the center-bottom game panel (passive view).
// Owns: the BackPlate panel, a caption line, a big value line (countdown / score / final score),
//       and one action button whose label/icon/action follow the phase: Start (idle) → Reset (countdown /
//       playing) → Retry (finished). The button SceneObject is named "ActionButton".
// Expects: nothing wired — icons and the image-free button faces are built in code.
// Must NOT: hold game state or make game decisions. BatonCatchMain pushes state in via
//           showIdle / showCountdown / showScore / showFinal and listens to onStart / onReset / onRetry.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

// ── Type scale — single source of truth (see specs-build-ui patterns.md → Typography)
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const IMAGE_MATERIAL: Material = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_PLAY: Texture = requireAsset("../Icons/play_arrow.png") as Texture
const ICON_REPLAY: Texture = requireAsset("../Icons/replay.png") as Texture
const ICON_RESET: Texture = requireAsset("../Icons/restart_alt.png") as Texture

const PAD = 1.2
const GAP = 0.5
const CAPTION_H = 2.2
const VALUE_H = 4.2
const BUTTON_W = 10
const BUTTON_H = 3.0
const CONTENT_Z = 0.6
const BUTTON_LABEL_Z = 0.08
const ICON_CM = 1.8
const LABEL_W = 4.5

export type PanelMode = "idle" | "countdown" | "playing" | "finished"

@component
export class BatonCatchPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BatonCatchPanelUI – center-bottom game panel</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel width in cm")
  @widget(new SliderWidget(14, 40, 0.5))
  panelWidth: number = 20

  @input
  @hint("Caption shown before the round starts")
  idleCaption: string = "Reaction Baton Catch"

  @input
  @hint("Big line shown before the round starts")
  idleValue: string = "Ready?"

  @input("vec4", "{1, 1, 1, 0.8}")
  @hint("Caption text color (keep it light — the display is additive)")
  @widget(new ColorWidget())
  captionColor: vec4 = new vec4(1, 1, 1, 0.8)

  @input("vec4", "{0.7, 0.95, 1, 1}")
  @hint("Big value text color (countdown / score)")
  @widget(new ColorWidget())
  valueColor: vec4 = new vec4(0.7, 0.95, 1, 1)
  @ui.group_end

  private caption!: Text
  private value!: Text
  private actionLabel!: Text
  private actionIconMat!: Material

  private mode: PanelMode = "idle"
  private ready = false

  private _onStart = new Event<void>()
  private _onReset = new Event<void>()
  private _onRetry = new Event<void>()
  get onStart(): PublicApi<void> { return this._onStart.publicApi() }
  get onReset(): PublicApi<void> { return this._onReset.publicApi() }
  get onRetry(): PublicApi<void> { return this._onRetry.publicApi() }

  // ── Read-only state for tests ─────────────────────────────────────────────
  get captionText(): string { return this.caption ? this.caption.text : "" }
  get valueText(): string { return this.value ? this.value.text : "" }
  get currentMode(): PanelMode { return this.mode }
  /** Label currently shown on the action button: "Start", "Reset" or "Retry". */
  get actionButtonLabel(): string { return this.actionLabel ? this.actionLabel.text : "" }
  get isStartVisible(): boolean { return this.mode === "idle" }
  get isResetVisible(): boolean { return this.mode === "countdown" || this.mode === "playing" }
  get isRetryVisible(): boolean { return this.mode === "finished" }

  onAwake(): void {
    this.buildPanel()
    this.ready = true
    this.applyMode()
  }

  /** Same as tapping the action button — for tests and tools. */
  pressActionButton(): void {
    if (this.mode === "idle") this._onStart.invoke()
    else if (this.mode === "finished") this._onRetry.invoke()
    else this._onReset.invoke()
  }

  // ── Public API (Main → UI) ────────────────────────────────────────────────
  showIdle(): void {
    this.mode = "idle"
    this.setTexts(this.idleCaption, this.idleValue)
    this.applyMode()
  }

  showCountdown(text: string): void {
    this.mode = "countdown"
    this.setTexts("Get ready", text)
    this.applyMode()
  }

  showScore(score: number): void {
    this.mode = "playing"
    this.setTexts("Score", `${score}`)
    this.applyMode()
  }

  showFinal(score: number, total: number): void {
    this.mode = "finished"
    this.setTexts("Final score", `${score} / ${total}`)
    this.applyMode()
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  private buildPanel(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "default"

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.panelWidth
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = GAP
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const innerW = this.panelWidth - PAD * 2
    this.caption = this.addColumnText(content, "CaptionText", this.idleCaption, "Subheadline", innerW, CAPTION_H, this.captionColor)
    this.value = this.addColumnText(content, "ValueText", this.idleValue, "Title2", innerW, VALUE_H, this.valueColor)

    this.addActionButton(content)
  }

  private addColumnText(parent: SceneObject, name: string, text: string, role: TextRole,
                        widthCM: number, heightCM: number, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role)
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -heightCM / 2, heightCM / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = heightCM
    item.alignSelf = FlexAlignSelf.Stretch
    return t
  }

  private addActionButton(parent: SceneObject): void {
    const so = global.scene.createSceneObject("ActionButton")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    btn.onInitialized.add(() => {
      btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    })
    btn.onTriggerUp.add(() => this.pressActionButton())
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = BUTTON_W
    item.overrideHeight = BUTTON_H
    item.alignSelf = FlexAlignSelf.Center

    // Button face: icon + label in a centered FlexLayout row, lifted in front of the button face.
    const face = global.scene.createSceneObject("Face")
    face.setParent(so)
    face.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const row = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.width = BUTTON_W
    row.height = BUTTON_H
    row.direction = FlexDirection.Row
    row.justifyContent = FlexJustify.Center
    row.alignItems = FlexAlign.Center
    row.columnGap = 0.5

    const iconSO = global.scene.createSceneObject("Icon")
    iconSO.setParent(face)
    const img = iconSO.createComponent("Component.Image") as Image
    this.actionIconMat = IMAGE_MATERIAL.clone()
    this.actionIconMat.mainPass.baseTex = ICON_PLAY
    this.actionIconMat.mainPass.depthTest = true
    this.actionIconMat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(this.actionIconMat)
    iconSO.getTransform().setLocalScale(new vec3(ICON_CM, ICON_CM, 1))
    const iconItem = iconSO.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.overrideWidth = ICON_CM
    iconItem.overrideHeight = ICON_CM

    const labelSO = global.scene.createSceneObject("Label")
    labelSO.setParent(face)
    const t = labelSO.createComponent("Component.Text") as Text
    t.text = "Start"
    t.depthTest = true
    applyTextRole(t, "Button")
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-LABEL_W / 2, LABEL_W / 2, -1.2, 1.2)
    const labelItem = labelSO.createComponent(FlexItem.getTypeName()) as FlexItem
    labelItem.overrideWidth = LABEL_W
    labelItem.overrideHeight = 2.4
    this.actionLabel = t
  }

  private setTexts(caption: string, value: string): void {
    if (this.caption) this.caption.text = caption
    if (this.value) this.value.text = value
  }

  private applyMode(): void {
    if (!this.ready || !this.actionLabel) return
    if (this.mode === "idle") {
      this.actionLabel.text = "Start"
      this.actionIconMat.mainPass.baseTex = ICON_PLAY
    } else if (this.mode === "finished") {
      this.actionLabel.text = "Retry"
      this.actionIconMat.mainPass.baseTex = ICON_REPLAY
    } else {
      this.actionLabel.text = "Reset"
      this.actionIconMat.mainPass.baseTex = ICON_RESET
    }
  }
}
