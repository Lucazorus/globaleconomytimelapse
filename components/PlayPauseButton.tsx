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
        ${disabled ? "opacity-40 pointer-events-none" : ""}
      `}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: "transparent",
        color: "#fff",
        border: "none",
        boxShadow: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.2s",
      }}
      tabIndex={0}
    >
      <svg
        viewBox="0 0 44 44"
        width={size * 0.78}
        height={size * 0.78}
        className="transition-all duration-300"
      >
        {/* Triangle Play */}
        <polygon
          points="18,12 35,22 18,32"
          fill="#4DB882"
          opacity={playing ? 0 : 1}
          style={{ transition: "opacity 0.2s" }}
        />
        {/* Pause Bars */}
        <rect
          x="15" y="13"
          width="5" height="18"
          rx="2.5"
          fill="rgba(255,255,255,0.75)"
          opacity={playing ? 1 : 0}
          style={{ transition: "opacity 0.2s" }}
        />
        <rect
          x="24" y="13"
          width="5" height="18"
          rx="2.5"
          fill="rgba(255,255,255,0.75)"
          opacity={playing ? 1 : 0}
          style={{ transition: "opacity 0.2s" }}
        />
      </svg>
    </button>
  );
}
