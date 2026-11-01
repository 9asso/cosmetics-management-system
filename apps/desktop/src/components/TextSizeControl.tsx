import { AArrowDown, AArrowUp } from "lucide-react";
import { useState } from "react";
import {
  defaultTextScale,
  nextTextScale,
  readTextScale,
  saveTextScale,
  textScaleSteps,
} from "../lib/text-scale";
import { ui } from "../lib/ui";

export function TextSizeControl() {
  const [scale, setScale] = useState(readTextScale);
  const change = (next: number) => {
    setScale(next);
    saveTextScale(next);
  };
  return (
    <div className={ui("text-size-control")} role="group" aria-label="Taille du texte">
      <button
        type="button"
        aria-label="Réduire la taille du texte"
        title="Réduire le texte"
        disabled={scale === textScaleSteps[0]}
        onClick={() => change(nextTextScale(scale, -1))}
      >
        <AArrowDown size={17} />
      </button>
      <button
        type="button"
        className="max-md:hidden"
        aria-label={`Taille du texte ${Math.round(scale * 100)} %, rétablir la taille normale`}
        title="Rétablir la taille normale"
        onClick={() => change(defaultTextScale)}
      >
        {Math.round(scale * 100)} %
      </button>
      <button
        type="button"
        aria-label="Augmenter la taille du texte"
        title="Agrandir le texte"
        disabled={scale === textScaleSteps.at(-1)}
        onClick={() => change(nextTextScale(scale, 1))}
      >
        <AArrowUp size={17} />
      </button>
    </div>
  );
}
