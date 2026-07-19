import type React from "react";
import { Composition } from "remotion";
import { MaploguePromptToMap } from "./MaploguePromptToMap";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MaploguePromptToMap"
    component={MaploguePromptToMap}
    durationInFrames={450}
    fps={30}
    width={1440}
    height={810}
  />
);
