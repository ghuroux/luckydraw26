import { PrizeDrawManager, type PrizeForDraw } from "./PrizeDrawManager";
import {
  WinnerDrawManager,
  type ParkedWinner,
  type PrizeForWinnerDraw,
} from "./WinnerDrawManager";

export type { PrizeForDraw };

interface Props {
  eventId: string;
  drawMode: "PRIZE_DRAW" | "WINNER_DRAW";
  prizes: PrizeForWinnerDraw[];
  parkedWinners: ParkedWinner[];
  canDraw: boolean;
}

export function DrawManager({
  eventId,
  drawMode,
  prizes,
  parkedWinners,
  canDraw,
}: Props) {
  if (drawMode === "WINNER_DRAW") {
    return (
      <WinnerDrawManager
        eventId={eventId}
        prizes={prizes}
        parkedWinners={parkedWinners}
        canDraw={canDraw}
      />
    );
  }
  return <PrizeDrawManager prizes={prizes} canDraw={canDraw} />;
}
