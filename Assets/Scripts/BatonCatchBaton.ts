// BatonCatchBaton — one runtime baton + the shared code-authored cylinder mesh.
// Owns: a single baton's SceneObject tree (unit-scale root with the grab collider + SIK Interactable,
//       visual child with the cylinder RenderMeshVisual), its per-baton material clone (hover highlight),
//       and its own fall integration. Plain TS class — not a @component.
// Expects: BatonCatchMain to create it, call drop()/step()/destroy(), and listen via onCaught.
// Must NOT: keep score, decide round flow, or touch UI.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"

export type BatonState = "hanging" | "falling" | "caught" | "missed"

export interface BatonLook {
  lengthCm: number
  diameterCm: number
  grabPaddingCm: number
  material: Material
  color: vec4
  highlightColor: vec4
  debugCollider: boolean
}

// ── Shared cylinder mesh (built once per length/diameter) ────────────────────
let cachedMesh: RenderMesh | null = null
let cachedKey = ""

export function getBatonMesh(lengthCm: number, diameterCm: number, segments: number = 20): RenderMesh {
  const key = `${lengthCm}_${diameterCm}_${segments}`
  if (cachedMesh && cachedKey === key) return cachedMesh

  const mb = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  mb.topology = MeshTopology.Triangles
  mb.indexType = MeshIndexType.UInt16

  const r = diameterCm / 2
  const h = lengthCm / 2
  const verts: number[] = []
  const idx: number[] = []

  // Side wall: pairs (bottom, top) per ring step, outward normals.
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    const u = i / segments
    verts.push(r * c, -h, r * s, c, 0, s, u, 0)
    verts.push(r * c, h, r * s, c, 0, s, u, 1)
  }
  for (let i = 0; i < segments; i++) {
    const b0 = i * 2
    const t0 = b0 + 1
    const b1 = b0 + 2
    const t1 = b0 + 3
    idx.push(b0, t0, t1, b0, t1, b1)
  }

  // Caps: center + ring with flat normals.
  const addCap = (y: number, ny: number) => {
    const center = verts.length / 8
    verts.push(0, y, 0, 0, ny, 0, 0.5, 0.5)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      verts.push(r * c, y, r * s, 0, ny, 0, 0.5 + 0.5 * c, 0.5 + 0.5 * s)
    }
    for (let i = 0; i < segments; i++) {
      const p0 = center + 1 + i
      const p1 = p0 + 1
      if (ny > 0) idx.push(center, p1, p0)
      else idx.push(center, p0, p1)
    }
  }
  addCap(h, 1)
  addCap(-h, -1)

  mb.appendVerticesInterleaved(verts)
  mb.appendIndices(idx)
  mb.updateMesh()
  cachedMesh = mb.getMesh()
  cachedKey = key
  return cachedMesh
}

// ── One baton ────────────────────────────────────────────────────────────────
export class BatonCatchBaton {
  readonly root: SceneObject
  readonly name: string
  state: BatonState = "hanging"

  private transform: Transform
  private material: Material
  private collider: ColliderComponent
  private velocity = 0
  private look: BatonLook

  /** Fired once when the user grabs this baton while it is falling. */
  onCaught: ((baton: BatonCatchBaton) => void) | null = null

  constructor(parent: SceneObject, name: string, localPos: vec3, look: BatonLook) {
    this.look = look
    this.name = name

    // Unit-scale, identity-rotation root carries the collider + Interactable (Hard Rule 6).
    this.root = global.scene.createSceneObject(name)
    this.root.setParent(parent)
    this.transform = this.root.getTransform()
    this.transform.setLocalPosition(localPos)

    const visual = global.scene.createSceneObject("Visual")
    visual.setParent(this.root)
    const rmv = visual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = getBatonMesh(look.lengthCm, look.diameterCm)
    this.material = look.material.clone()
    this.material.mainPass.baseColor = look.color
    rmv.mainMaterial = this.material

    // Grab area: a box a bit larger than the baton so a thin falling target is still catchable.
    this.collider = this.root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    const pad = look.grabPaddingCm * 2
    box.size = new vec3(look.diameterCm + pad, look.lengthCm + pad, look.diameterCm + pad)
    this.collider.shape = box
    this.collider.fitVisual = false
    this.collider.debugDrawEnabled = look.debugCollider

    const interactable = this.root.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onHoverEnter.add(() => this.setHighlight(true))
    interactable.onHoverExit.add(() => this.setHighlight(false))
    interactable.onTriggerStart.add(() => this.tryCatch())
  }

  get isAlive(): boolean {
    return this.state === "hanging" || this.state === "falling"
  }

  /** World-space Y of the baton's bottom end. */
  get bottomY(): number {
    return this.transform.getWorldPosition().y - this.look.lengthCm / 2
  }

  drop(): void {
    if (this.state !== "hanging") return
    this.state = "falling"
    this.velocity = 0
  }

  /** Integrates the fall. Returns true when the bottom has crossed floorY this frame. */
  step(dt: number, gravityCmPerS2: number, floorY: number): boolean {
    if (this.state !== "falling") return false
    this.velocity += gravityCmPerS2 * dt
    const p = this.transform.getWorldPosition()
    this.transform.setWorldPosition(new vec3(p.x, p.y - this.velocity * dt, p.z))
    return this.bottomY <= floorY
  }

  /** Public so tests / tools can simulate a grab without a hand. */
  tryCatch(): boolean {
    if (this.state !== "falling") return false
    this.state = "caught"
    this.hide()
    if (this.onCaught) this.onCaught(this)
    return true
  }

  markMissed(): void {
    if (this.state !== "falling") return
    this.state = "missed"
    this.hide()
  }

  setDebugCollider(on: boolean): void {
    if (!isNull(this.collider)) this.collider.debugDrawEnabled = on
  }

  destroy(): void {
    if (!isNull(this.root)) this.root.destroy()
  }

  private hide(): void {
    // Disabled immediately (out of view + out of interaction); BatonCatchMain destroys it next frame
    // so we never destroy an Interactable inside its own SIK callback.
    if (!isNull(this.root)) this.root.enabled = false
  }

  private setHighlight(on: boolean): void {
    if (!this.isAlive || isNull(this.material)) return
    this.material.mainPass.baseColor = on ? this.look.highlightColor : this.look.color
  }
}
