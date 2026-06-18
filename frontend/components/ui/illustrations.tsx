import React from 'react';

interface IllustrationProps {
  className?: string;
  width?: number;
  height?: number;
}

export function IllustrationEmptyInbox({ className, width = 200, height = 160 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Empty Inbox Illustration"
      className={className}
    >
      <style>
        {`
          @keyframes sway {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
          }
          @keyframes swingLegs {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(15deg); }
          }
          .sway-character {
            transform-origin: 100px 95px;
            animation: sway 3s ease-in-out infinite;
          }
          .swing-leg-left {
            transform-origin: 92px 105px;
            animation: swingLegs 2.5s ease-in-out infinite;
          }
          .swing-leg-right {
            transform-origin: 108px 105px;
            animation: swingLegs 2.5s ease-in-out infinite -0.5s;
          }
        `}
      </style>
      
      {/* Background Pastel Circle */}
      <circle cx="100" cy="80" r="65" fill="#FFF8F0" opacity="0.9" />
      
      {/* Mailbox body */}
      <rect x="50" y="80" width="100" height="45" rx="8" fill="#FDDCB5" stroke="#92400E" strokeWidth="1.5" />
      <path d="M50 85C50 70 150 70 150 85" fill="#FDDCB5" stroke="#92400E" strokeWidth="1.5" />
      
      {/* Mailbox door open */}
      <rect x="60" y="85" width="80" height="30" rx="4" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="12" fill="#FFF8F0" stroke="#92400E" strokeWidth="1.2" />
      
      {/* Question mark inside mailbox */}
      <text x="96" y="105" fill="#F59E0B" fontSize="16" fontWeight="bold" fontFamily="sans-serif">?</text>
      
      {/* Cute Character Sitting on Mailbox */}
      <g className="sway-character">
        {/* Shadow */}
        <ellipse cx="100" cy="72" rx="25" ry="5" fill="#FCA5A5" opacity="0.3" />
        
        {/* Legs dangling */}
        <rect className="swing-leg-left" x="90" y="100" width="5" height="15" rx="2" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        <rect className="swing-leg-right" x="105" y="100" width="5" height="15" rx="2" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Body */}
        <rect x="85" y="75" width="30" height="28" rx="10" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Head */}
        <circle cx="100" cy="58" r="20" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Blush cheeks */}
        <circle cx="88" cy="62" r="2.5" fill="#FCA5A5" />
        <circle cx="112" cy="62" r="2.5" fill="#FCA5A5" />
        
        {/* Eyes (Chibi Dots) */}
        <circle cx="94" cy="58" r="1.8" fill="#92400E" />
        <circle cx="106" cy="58" r="1.8" fill="#92400E" />
      </g>
    </svg>
  );
}

export function IllustrationEmptySearch({ className, width = 180, height = 150 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 180 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Empty Search Illustration"
      className={className}
    >
      <style>
        {`
          @keyframes magnify {
            0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
            50% { transform: translate(4px, -3px) rotate(8deg); }
          }
          @keyframes lookAround {
            0%, 100% { transform: translateX(-2px); }
            50% { transform: translateX(2px); }
          }
          .magnifier-lens {
            transform-origin: 105px 75px;
            animation: magnify 3.5s ease-in-out infinite;
          }
          .searcher-eyes {
            animation: lookAround 2s ease-in-out infinite;
          }
        `}
      </style>
      
      {/* Background Circle */}
      <circle cx="90" cy="75" r="60" fill="#EFF6FF" opacity="0.9" />
      
      {/* Character */}
      <g>
        {/* Body */}
        <rect x="70" y="80" width="40" height="35" rx="12" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Head */}
        <circle cx="90" cy="60" r="22" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Cheeks */}
        <circle cx="76" cy="65" r="3" fill="#FCA5A5" />
        <circle cx="104" cy="65" r="3" fill="#FCA5A5" />
        
        {/* Eyes */}
        <g className="searcher-eyes">
          <circle cx="84" cy="60" r="2" fill="#92400E" />
          <circle cx="96" cy="60" r="2" fill="#92400E" />
        </g>
      </g>
      
      {/* Magnifying Glass */}
      <g className="magnifier-lens">
        {/* Handle */}
        <line x1="108" y1="88" x2="128" y2="108" stroke="#92400E" strokeWidth="5" strokeLinecap="round" />
        {/* Lens Rim */}
        <circle cx="98" cy="78" r="18" fill="#FFF8F0" stroke="#F59E0B" strokeWidth="2.5" />
        <circle cx="98" cy="78" r="18" fill="none" stroke="#92400E" strokeWidth="1.5" />
        <path d="M88 74A12 12 0 0 1 106 72" stroke="#FFF8F0" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function IllustrationEmptyChat({ className, width = 200, height = 160 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Empty Chat Illustration"
      className={className}
    >
      <style>
        {`
          @keyframes floatChat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes typeHands {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          .floating-bubble-1 {
            animation: floatChat 4s ease-in-out infinite;
          }
          .floating-bubble-2 {
            animation: floatChat 4s ease-in-out infinite -1.5s;
          }
          .typing-hands {
            animation: typeHands 0.2s ease-in-out infinite;
          }
        `}
      </style>
      
      {/* Background Accent */}
      <circle cx="100" cy="80" r="62" fill="#FFF8F0" opacity="0.9" />
      
      {/* Laptop Base */}
      <rect x="70" y="110" width="60" height="6" rx="3" fill="#D97706" stroke="#92400E" strokeWidth="1.5" />
      
      {/* Character */}
      <g>
        {/* Body */}
        <rect x="80" y="85" width="40" height="30" rx="10" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Head */}
        <circle cx="100" cy="62" r="22" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Cheeks */}
        <circle cx="86" cy="66" r="2.5" fill="#FCA5A5" />
        <circle cx="114" cy="66" r="2.5" fill="#FCA5A5" />
        
        {/* Eyes */}
        <circle cx="94" cy="61" r="2" fill="#92400E" />
        <circle cx="106" cy="61" r="2" fill="#92400E" />
        
        {/* Hands typing */}
        <g className="typing-hands">
          <circle cx="88" cy="98" r="4" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
          <circle cx="112" cy="98" r="4" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        </g>
      </g>
      
      {/* Laptop Screen */}
      <path d="M80 110 L83 93 L117 93 L120 110 Z" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
      
      {/* Chat Bubbles */}
      <g className="floating-bubble-1">
        <rect x="125" y="35" width="45" height="24" rx="8" fill="#FDDCB5" stroke="#92400E" strokeWidth="1.5" />
        <polygon points="135,59 140,66 143,59" fill="#FDDCB5" stroke="#92400E" strokeWidth="1.5" />
        <circle cx="137" cy="47" r="2" fill="#D97706" />
        <circle cx="147" cy="47" r="2" fill="#D97706" />
        <circle cx="157" cy="47" r="2" fill="#D97706" />
      </g>
      
      <g className="floating-bubble-2">
        <rect x="35" y="45" width="36" height="20" rx="6" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        <polygon points="58,65 62,70 63,65" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        <line x1="43" y1="55" x2="53" y2="55" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="43" y1="60" x2="63" y2="60" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function IllustrationLoading({ className, width = 80, height = 40 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 80 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Loading..."
      className={className}
    >
      <style>
        {`
          @keyframes bounceDot {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          .loading-dot {
            animation: bounceDot 0.8s ease-in-out infinite;
          }
          .dot-1 { animation-delay: 0s; }
          .dot-2 { animation-delay: 0.15s; }
          .dot-3 { animation-delay: 0.3s; }
        `}
      </style>
      <defs>
        <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      
      <circle className="loading-dot dot-1" cx="20" cy="25" r="6" fill="url(#amberGradient)" />
      <circle className="loading-dot dot-2" cx="40" cy="25" r="6" fill="url(#amberGradient)" />
      <circle className="loading-dot dot-3" cx="60" cy="25" r="6" fill="url(#amberGradient)" />
    </svg>
  );
}

export function IllustrationSuccess({ className, width = 160, height = 140 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Success Illustration"
      className={className}
    >
      <style>
        {`
          @keyframes successJump {
            0%, 100% { transform: translateY(0) scaleY(1); }
            50% { transform: translateY(-15px) scaleY(1.05); }
          }
          @keyframes confettiFall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(110px) rotate(360deg); opacity: 0; }
          }
          .jumping-character {
            transform-origin: 80px 115px;
            animation: successJump 1.5s ease-in-out infinite;
          }
          .confetti {
            animation: confettiFall 2.5s linear infinite;
          }
          .c-1 { animation-delay: 0s; }
          .c-2 { animation-delay: 0.5s; }
          .c-3 { animation-delay: 1.2s; }
          .c-4 { animation-delay: 1.8s; }
        `}
      </style>
      
      {/* Background Circle */}
      <circle cx="80" cy="70" r="50" fill="#FFF8F0" opacity="0.9" />
      
      {/* Character */}
      <g className="jumping-character">
        {/* Legs */}
        <line x1="72" y1="108" x2="72" y2="118" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
        <line x1="88" y1="108" x2="88" y2="118" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
        
        {/* Body */}
        <rect x="62" y="78" width="36" height="30" rx="12" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Hands up */}
        <path d="M57 80Q50 68 53 62" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
        <path d="M103 80Q110 68 107 62" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="53" cy="61" r="3" fill="#FDE68A" stroke="#92400E" strokeWidth="1" />
        <circle cx="107" cy="61" r="3" fill="#FDE68A" stroke="#92400E" strokeWidth="1" />
        
        {/* Head */}
        <circle cx="80" cy="55" r="20" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Smile & Face */}
        <circle cx="74" cy="56" r="1.8" fill="#92400E" />
        <circle cx="86" cy="56" r="1.8" fill="#92400E" />
        <path d="M77 62Q80 65 83 62" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        
        <circle cx="68" cy="60" r="2.5" fill="#FCA5A5" />
        <circle cx="92" cy="60" r="2.5" fill="#FCA5A5" />
      </g>
      
      {/* Confetti */}
      <rect className="confetti c-1" x="30" y="20" width="6" height="6" fill="#F59E0B" rx="1" />
      <circle className="confetti c-2" cx="130" cy="30" r="3.5" fill="#10B981" />
      <rect className="confetti c-3" x="50" y="10" width="8" height="4" fill="#FCA5A5" rx="1" />
      <rect className="confetti c-4" x="110" y="15" width="4" height="8" fill="#3B82F6" rx="1" />
    </svg>
  );
}

export function IllustrationEmailLogo({ className, width = 36, height = 36 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Email Winged Logo"
      className={className}
    >
      <style>
        {`
          @keyframes flapWings {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.45); }
          }
          @keyframes hoverLogo {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          .flying-mail {
            animation: hoverLogo 2s ease-in-out infinite;
          }
          .logo-wing-left {
            transform-origin: 10px 18px;
            animation: flapWings 0.6s ease-in-out infinite;
          }
          .logo-wing-right {
            transform-origin: 26px 18px;
            animation: flapWings 0.6s ease-in-out infinite;
          }
        `}
      </style>
      
      <g className="flying-mail">
        {/* Left Wing */}
        <path className="logo-wing-left" d="M10 18 C5 12 2 18 10 18 Z" fill="#FDE68A" stroke="#92400E" strokeWidth="1.2" />
        
        {/* Right Wing */}
        <path className="logo-wing-right" d="M26 18 C31 12 34 18 26 18 Z" fill="#FDE68A" stroke="#92400E" strokeWidth="1.2" />
        
        {/* Envelope Body */}
        <rect x="9" y="12" width="18" height="13" rx="2" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5" />
        
        {/* Envelope folds */}
        <path d="M9 13L18 19L27 13" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
