export default function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel-component ${className}`}>
      {title ? <div className="panel-header"><strong>{title}</strong></div> : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
