import { useState } from "react";

export default function Tooltip({ text, children, placement = "top" }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={-1}
    >
      {children}
      {text ? (
        <span
          className={`tooltip-bubble tooltip-${placement} ${visible ? "visible" : ""}`}
          role="tooltip"
          aria-hidden={!visible}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
