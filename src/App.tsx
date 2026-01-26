import { useState, useCallback, useRef, useEffect } from 'react';
import { ValidatedRug, RoundResult, GamePhase } from './types';
import { haversineDistance, calculateScore } from './scoring';
import { buildRugPool } from './api/rug-pool';
import GameMap from './components/GameMap';
import RugPanel from './components/RugPanel';
import ResultPanel from './components/ResultPanel';
import GameOver from './components/GameOver';
import Loading from './components/Loading';
import './App.css';

const TOTAL_ROUNDS = 10;

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [rugs, setRugs] = useState<ValidatedRug[]>([]);
  const [round, setRound] = useState(1);
  const [guessLat, setGuessLat] = useState<number | null>(null);
  const [guessLng, setGuessLng] = useState<number | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState<string[]>([
    'Starting RugGuessr...',
  ]);
  const [error, setError] = useState<string | null>(null);
  const loadStarted = useRef(false);

  const startGame = useCallback(() => {
    setPhase('loading');
    setRound(1);
    setGuessLat(null);
    setGuessLng(null);
    setResults([]);
    setTotalScore(0);
    setError(null);
    setLoadingMessages(['Starting RugGuessr...']);

    buildRugPool((msg) => {
      setLoadingMessages((prev) => [...prev, msg]);
    })
      .then((pool) => {
        if (pool.length === 0) {
          setError(
            'Could not find any rugs with specific-enough origins. Check your network connection and try again.'
          );
          return;
        }
        if (pool.length < TOTAL_ROUNDS) {
          setLoadingMessages((prev) => [
            ...prev,
            `Note: only ${pool.length} valid rugs found (need ${TOTAL_ROUNDS}). Playing with fewer rounds.`,
          ]);
        }
        setRugs(pool.slice(0, TOTAL_ROUNDS));
        setPhase('playing');
      })
      .catch((err) => {
        setError(`Failed to load rugs: ${err.message}`);
      });
  }, []);

  // Auto-start on mount
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    startGame();
  }, [startGame]);

  const currentRug = rugs[round - 1];
  const actualRounds = Math.min(TOTAL_ROUNDS, rugs.length);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (phase !== 'playing') return;
      setGuessLat(lat);
      setGuessLng(lng);
    },
    [phase]
  );

  const handleConfirm = useCallback(() => {
    if (guessLat == null || guessLng == null || !currentRug) return;

    const dist = haversineDistance(
      guessLat,
      guessLng,
      currentRug.location.lat,
      currentRug.location.lng
    );
    const score = calculateScore(dist);

    const result: RoundResult = {
      rug: currentRug,
      guessLat,
      guessLng,
      distanceKm: dist,
      score,
    };

    setResults((prev) => [...prev, result]);
    setTotalScore((prev) => prev + score);
    setPhase('guessed');
  }, [guessLat, guessLng, currentRug]);

  const handleNext = useCallback(() => {
    if (round >= actualRounds) {
      setPhase('gameover');
    } else {
      setRound((prev) => prev + 1);
      setGuessLat(null);
      setGuessLng(null);
      setPhase('playing');
    }
  }, [round, actualRounds]);

  const handlePlayAgain = useCallback(() => {
    loadStarted.current = false;
    startGame();
  }, [startGame]);

  // --- Render ---

  if (phase === 'loading') {
    return <Loading messages={loadingMessages} />;
  }

  if (error && rugs.length === 0) {
    return (
      <div className="error-screen">
        <h2>RugGuessr</h2>
        <p className="error-msg">{error}</p>
        <button className="btn btn-play-again" onClick={handlePlayAgain}>
          Try Again
        </button>
      </div>
    );
  }

  if (phase === 'gameover') {
    return (
      <GameOver
        results={results}
        totalScore={totalScore}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  const lastResult = results[results.length - 1];

  return (
    <div className="game-container">
      <GameMap
        onGuess={handleMapClick}
        guessLat={guessLat}
        guessLng={guessLng}
        actualLat={
          phase === 'guessed' ? (currentRug?.location.lat ?? null) : null
        }
        actualLng={
          phase === 'guessed' ? (currentRug?.location.lng ?? null) : null
        }
        showResult={phase === 'guessed'}
        disabled={phase !== 'playing'}
        round={round}
      />

      {phase === 'playing' && currentRug && (
        <RugPanel
          imageUrl={currentRug.imageUrl}
          round={round}
          totalRounds={actualRounds}
        />
      )}

      {phase === 'playing' && guessLat != null && (
        <div className="confirm-bar">
          <button className="btn btn-confirm" onClick={handleConfirm}>
            Confirm Guess
          </button>
        </div>
      )}

      {phase === 'guessed' && lastResult && (
        <ResultPanel
          rug={lastResult.rug}
          distanceKm={lastResult.distanceKm}
          score={lastResult.score}
          totalScore={totalScore}
          round={round}
          totalRounds={actualRounds}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
