interface LoadingProps {
  messages: string[];
}

export default function Loading({ messages }: LoadingProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-panel">
        <h2>RugGuessr</h2>
        <p className="loading-subtitle">
          Loading rugs from museum collections...
        </p>
        <div className="loading-spinner" />
        <div className="loading-messages">
          {messages.map((msg, i) => (
            <p
              key={i}
              className={
                i === messages.length - 1
                  ? 'loading-current'
                  : 'loading-done'
              }
            >
              {msg}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
