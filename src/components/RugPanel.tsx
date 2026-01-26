interface RugPanelProps {
  imageUrl: string;
  round: number;
  totalRounds: number;
}

export default function RugPanel({
  imageUrl,
  round,
  totalRounds,
}: RugPanelProps) {
  return (
    <div className="rug-panel">
      <div className="rug-panel-header">
        <h3>Where was this rug made?</h3>
        <span className="round-indicator">
          Round {round}/{totalRounds}
        </span>
      </div>
      <div className="rug-image-container">
        <img src={imageUrl} alt="Mystery rug" className="rug-image" />
      </div>
    </div>
  );
}
