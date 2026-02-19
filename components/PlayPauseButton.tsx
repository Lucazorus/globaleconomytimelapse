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
        background: playing
          ? "linear-gradient(135deg, #4DB882 0%, #3a9e6e 100%)"
          : "linear-gradient(135deg, #3a6eaf 0%, #2a5280 100%)",
        color: "#fff",
        border: "none",
        boxShadow: playing
          ? "0 0 18px rgba(77,184,130,0.45), 0 4px 12px rgba(0,0,0,0.3)"
          : "0 0 14px rgba(91,143,212,0.35), 0 4px 12px rgba(0,0,0,0.3)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.25s, box-shadow 0.25s",
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
          fill="#fff"
          opacity={playing ? 0 : 1}
          style={{ transition: "opacity 0.2s" }}
        />
        {/* Pause Bars */}
        <rect
          x="15" y="13"
          width="5" height="18"
          rx="2.5"
          fill="#fff"
          opacity={playing ? 1 : 0}
          style={{ transition: "opacity 0.2s" }}
        />
        <rect
          x="24" y="13"
          width="5" height="18"
          rx="2.5"
          fill="#fff"
          opacity={playing ? 1 : 0}
          style={{ transition: "opacity 0.2s" }}
        />
      </svg>
    </button>
  );
}
