// src/ui/meshIcons.jsx

import React from "react";

export function BoxIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M3 7.5L12 3l9 4.5v7L12 21 3 14.5v-7z" />
    </svg>
  );
}

export function SphereIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function CylinderIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <ellipse cx="12" cy="5" rx="7" ry="2" />
      <path d="M5 5v11c0 1.1 3.1 2 7 2s7-.9 7-2V5" />
    </svg>
  );
}

export function ConeIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M12 2 L20 20 H4 Z" />
    </svg>
  );
}

export function LineIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M4 12 L10 8 L14 16 L20 12" stroke="currentColor" fill="none" strokeWidth="2" />
    </svg>
  );
}

export function TetraIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M12 3L3.5 18h17L12 3Z" />
      <path d="M12 3l-4.2 8.4h8.4L12 3Z" opacity="0.28" />
    </svg>
  );
}

export function TorusIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Zm0 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}

export function TextBoxIcon(props) {
  return (
    <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm1.5 2.2a.8.8 0 0 1 .8-.8h7.4a.8.8 0 0 1 .8.8v7.6a.8.8 0 0 1-.8.8H8.3a.8.8 0 0 1-.8-.8V8.2Z"
      />
      <path d="M9 10.2h6v1.2H9z" opacity="0.55" />
      <path d="M9 12.4h5v1.2H9z" opacity="0.55" />
      <path d="M9 14.6h4v1.2H9z" opacity="0.55" />
    </svg>
  );
}
