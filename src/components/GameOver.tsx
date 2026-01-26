import { RoundResult } from '../types';

interface GameOverProps {
  results: RoundResult[];
  totalScore: number;
  onPlayAgain: () => void;
}

export default function GameOver({
  results,
  totalScore,
  onPlayAgain,
}: GameOverProps) {
  const maxScore = results.length * 5000;

  return (
    <div className="gameover-overlay">
      <div className="gameover-panel">
        <h2>Game Over</h2>

        <div className="final-score">
          <span className="score-number">
            {totalScore.toLocaleString()}
          </span>
          <span className="score-max">
            {' '}
            / {maxScore.toLocaleString()}
          </span>
        </div>

        <div className="results-list">
          <div className="result-row result-header">
            <span className="result-round">#</span>
            <span className="result-name">Rug</span>
            <span className="result-origin">Origin</span>
            <span className="result-dist">Distance</span>
            <span className="result-score-cell">Score</span>
          </div>
          {results.map((r, i) => (
            <div key={i} className="result-row">
              <span className="result-round">{i + 1}</span>
              <span className="result-name" title={r.rug.title}>
                {r.rug.title.length > 25
                  ? r.rug.title.slice(0, 25) + '...'
                  : r.rug.title}
              </span>
              <span className="result-origin">
                {r.rug.location.name}
              </span>
              <span className="result-dist">
                {r.distanceKm.toFixed(0)} km
              </span>
              <span className="result-score-cell">{r.score}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-play-again" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
