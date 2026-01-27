import { ValidatedRug } from '../types';

const SOURCE_NAMES: Record<string, string> = {
  met: 'The Metropolitan Museum of Art',
  cleveland: 'Cleveland Museum of Art',
  aic: 'Art Institute of Chicago',
  smithsonian: 'Smithsonian Institution',
  europeana: 'Europeana',
  va: 'Victoria and Albert Museum',
  dpla: 'Digital Public Library of America',
  wikidata: 'Wikidata / Wikimedia Commons',
};

interface ResultPanelProps {
  rug: ValidatedRug;
  distanceKm: number;
  score: number;
  totalScore: number;
  round: number;
  totalRounds: number;
  onNext: () => void;
}

export default function ResultPanel({
  rug,
  distanceKm,
  score,
  totalScore,
  round,
  totalRounds,
  onNext,
}: ResultPanelProps) {
  return (
    <div className="result-panel">
      <div className="result-score-section">
        <div className="result-stat">
          <strong>Distance:</strong> {distanceKm.toFixed(1)} km
        </div>
        <div className="result-stat">
          <strong>Score:</strong> {score} / 5,000
        </div>
        <div className="result-stat">
          <strong>Total:</strong> {totalScore.toLocaleString()}
        </div>
      </div>

      <div className="result-details">
        <h3>{rug.title}</h3>

        <div className="result-image-container">
          <img src={rug.imageUrl} alt={rug.title} className="result-image" />
        </div>

        <table className="result-info">
          <tbody>
            <tr>
              <td>
                <strong>Origin</strong>
              </td>
              <td>{rug.location.name}</td>
            </tr>
            {rug.date && (
              <tr>
                <td>
                  <strong>Date</strong>
                </td>
                <td>{rug.date}</td>
              </tr>
            )}
            {rug.culture && (
              <tr>
                <td>
                  <strong>Culture</strong>
                </td>
                <td>{rug.culture}</td>
              </tr>
            )}
            {rug.medium && (
              <tr>
                <td>
                  <strong>Medium</strong>
                </td>
                <td>{rug.medium}</td>
              </tr>
            )}
            {rug.dimensions && (
              <tr>
                <td>
                  <strong>Dimensions</strong>
                </td>
                <td>{rug.dimensions}</td>
              </tr>
            )}
            {rug.artist && (
              <tr>
                <td>
                  <strong>Artist</strong>
                </td>
                <td>{rug.artist}</td>
              </tr>
            )}
            {rug.creditLine && (
              <tr>
                <td>
                  <strong>Credit</strong>
                </td>
                <td>{rug.creditLine}</td>
              </tr>
            )}
            {rug.description && (
              <tr>
                <td>
                  <strong>Description</strong>
                </td>
                <td>{rug.description}</td>
              </tr>
            )}
            <tr>
              <td>
                <strong>Source</strong>
              </td>
              <td>
                {rug.museumUrl ? (
                  <a
                    href={rug.museumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {SOURCE_NAMES[rug.source] || rug.source}
                  </a>
                ) : (
                  SOURCE_NAMES[rug.source] || rug.source
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button className="btn btn-next" onClick={onNext}>
        {round < totalRounds ? 'Next Round' : 'See Final Score'}
      </button>
    </div>
  );
}
