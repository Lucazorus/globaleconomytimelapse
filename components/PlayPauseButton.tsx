import React from "react";

type Props = {
  playing: boolean;
  onClick: () => void;
  size?: number;
  disabled?: boolean;
};

export default function PlayPauseButton({ playing, onClick, size = 48, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={playing ? "Pause" : "Play"}
      className={`
        flex items-center justify-center
        rounded-full
        shadow-md
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: "#1a2327",
        backgroundColor: "#1a2327",
        color: "#fff",
        border: "none",
        boxShadow: "0 4px 12px #0002",
        cursor: disabled ? "not-allowed" : "pointer", // ← ajout du curseur main
        transition: "background 0.16s"
      }}
      tabIndex={0}
    >
      <svg
        viewBox="0 0 44 44"
        width={size * 0.85}
        height={size * 0.85}
        className="transition-all duration-300"
      >
        {/* Triangle Play */}
        <polygon
          points="17,12 34,22 17,32"
          fill="#fff"
          opacity={playing ? 0 : 1}
          className="transition-all duration-200"
        />
        {/* Pause Bars */}
        <rect
          x="16" y="13"
          width="5" height="18"
          rx="2"
          fill="#fff"
          opacity={playing ? 1 : 0}
          className="transition-all duration-200"
        />
        <rect
          x="24" y="13"
          width="5" height="18"
          rx="2"
          fill="#fff"
          opacity={playing ? 1 : 0}
          className="transition-all duration-200"
        />
      </svg>
    </button>
  );
}
