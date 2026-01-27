import { useState, useRef, useCallback, useEffect } from 'react';

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
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div className="rug-panel">
        <div className="rug-panel-header">
          <h3>Where was this rug made?</h3>
          <span className="round-indicator">
            Round {round}/{totalRounds}
          </span>
        </div>
        <div
          className="rug-image-container"
          onClick={() => setZoomed(true)}
        >
          <img
            src={imageUrl}
            alt="Mystery rug"
            className="rug-image"
          />
          <span className="zoom-hint">Click to zoom</span>
        </div>
      </div>

      {zoomed && (
        <ZoomModal
          imageUrl={imageUrl}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}

function ZoomModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.25, Math.min(10, s * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <div className="zoom-overlay" onClick={onClose}>
      <button
        className="zoom-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        &times;
      </button>

      <div className="zoom-controls" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() =>
            setScale((s) => Math.min(10, s * 1.3))
          }
        >
          +
        </button>
        <button
          onClick={() =>
            setScale((s) => Math.max(0.25, s / 1.3))
          }
        >
          &minus;
        </button>
        <button onClick={resetView}>Reset</button>
      </div>

      <div
        className="zoom-viewport"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="Zoomed rug"
          className="zoom-image"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            cursor: dragging.current ? 'grabbing' : 'grab',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
