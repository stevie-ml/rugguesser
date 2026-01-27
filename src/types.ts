export interface MuseumRug {
  id: string;
  source: 'met' | 'cleveland' | 'aic' | 'smithsonian' | 'europeana' | 'va';
  title: string;
  imageUrl: string;
  date: string;
  medium: string;
  dimensions: string;
  culture: string;
  provenance: string;
  creditLine: string;
  museumUrl: string;
  artist: string;
  description: string;
}

export interface ValidatedRug extends MuseumRug {
  location: {
    name: string;
    lat: number;
    lng: number;
  };
}

export interface RoundResult {
  rug: ValidatedRug;
  guessLat: number;
  guessLng: number;
  distanceKm: number;
  score: number;
}

export type GamePhase = 'loading' | 'playing' | 'guessed' | 'gameover';
