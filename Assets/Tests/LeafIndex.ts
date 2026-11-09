import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {BatonCountdownScenario} from "./BatonCountdownScenario"
import {BatonCatchClickScenario} from "./BatonCatchClickScenario"
import {BatonMissScenario} from "./BatonMissScenario"
import {BatonFinalScoreScenario} from "./BatonFinalScoreScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "1-start-countdown-first-drop", typename: BatonCountdownScenario.getTypeName()},
    {id: "2-click-falling-baton-scores", typename: BatonCatchClickScenario.getTypeName(), parameters: {fallSlowdown: "8"}},
    {id: "3-missed-baton-disappears-at-floor", typename: BatonMissScenario.getTypeName()},
    {id: "4-final-score-and-retry", typename: BatonFinalScoreScenario.getTypeName(), parameters: {fallSlowdown: "8"}},
  ]
}
