export default function IconButton({ title, onClick, children, className = "", disabled = false, active = false }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
