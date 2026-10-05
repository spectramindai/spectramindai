export function ISO27001Badge({ className = "h-14 w-auto" }) {
  return (
    <div
      className="inline-block select-none cursor-default transition-all duration-200 ease-out hover:-translate-y-1.5 hover:drop-shadow-md"
      title="ISO 27001 Certified — Information Security Management"
    >
      <svg
        viewBox="0 0 100 130"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="ISO 27001 Certified Badge"
      >
        <title>ISO 27001 Certified</title>
        {/* Shield Frame */}
        <path
          d="M 12 7 C 12 3.1 15.1 0 19 0 L 81 0 C 84.9 0 88 3.1 88 7 L 88 92 C 88 94.6 86.6 97 84.3 98.4 L 51.8 127 C 50.7 127.9 49.3 127.9 48.2 127 L 15.7 98.4 C 13.4 97 12 94.6 12 92 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Proper ISO Globe Grid Mark */}
        <g transform="translate(50, 18)">
          <circle cx="0" cy="0" r="9" fill="#0f172a" />
          <circle cx="0" cy="0" r="8" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.95" />
          <ellipse cx="0" cy="0" rx="4.2" ry="8" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.95" />
          <line x1="-8" y1="0" x2="8" y2="0" stroke="#ffffff" strokeWidth="0.8" opacity="0.95" />
          <line x1="0" y1="-8" x2="0" y2="8" stroke="#ffffff" strokeWidth="0.8" opacity="0.95" />
          <path d="M -6.5 -4 Q 0 -1.5 6.5 -4" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.75" />
          <path d="M -6.5 4 Q 0 1.5 6.5 4" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.75" />
        </g>

        {/* Typography */}
        <text
          x="50"
          y="47"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="16"
          fontWeight="900"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          ISO
        </text>
        <text
          x="50"
          y="67"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="16"
          fontWeight="900"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.2"
        >
          27001
        </text>
        <text
          x="50"
          y="80"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="6.5"
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="1.2"
        >
          CERTIFIED
        </text>

        {/* Bottom Emerald Chevron */}
        <path
          d="M 17 96 L 50 123.5 L 83 96 L 85.5 101 L 50 128 L 14.5 101 Z"
          fill="#0d7853"
        />
      </svg>
    </div>
  );
}

export function SOC2Badge({ className = "h-14 w-auto" }) {
  return (
    <div
      className="inline-block select-none cursor-default transition-all duration-200 ease-out hover:-translate-y-1.5 hover:drop-shadow-md"
      title="SOC 2 Type II Certified — Monitored by Compvd"
    >
      <svg
        viewBox="0 0 100 130"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="SOC 2 Certified Badge"
      >
        <title>SOC 2 Certified - Monitored by Compvd</title>
        {/* Shield Frame */}
        <path
          d="M 12 7 C 12 3.1 15.1 0 19 0 L 81 0 C 84.9 0 88 3.1 88 7 L 88 92 C 88 94.6 86.6 97 84.3 98.4 L 51.8 127 C 50.7 127.9 49.3 127.9 48.2 127 L 15.7 98.4 C 13.4 97 12 94.6 12 92 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Proper AICPA SOC Keyhole Shield Mark */}
        <g transform="translate(50, 18)">
          <path
            d="M -8.5 -8.5 C -8.5 -8.5 0 -10.5 0 -10.5 C 0 -10.5 8.5 -8.5 8.5 -8.5 C 8.5 0.5 7.5 7.5 0 11.5 C -7.5 7.5 -8.5 0.5 -8.5 -8.5 Z"
            fill="#0f172a"
          />
          <circle cx="0" cy="-1.5" r="3" fill="#ffffff" />
          <polygon points="-1.8,-1.5 1.8,-1.5 2.5,4.5 -2.5,4.5" fill="#ffffff" />
        </g>

        {/* Typography */}
        <text
          x="50"
          y="49"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="17"
          fontWeight="900"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.4"
        >
          SOC 2
        </text>

        {/* Green Ribbon Pill */}
        <rect x="8" y="57" width="84" height="15" rx="3.5" fill="#0d7853" />
        <text
          x="50"
          y="67.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="7.5"
          fontWeight="800"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="1"
        >
          CERTIFIED
        </text>

        {/* Subtext */}
        <text
          x="50"
          y="79.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="5"
          fontWeight="700"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.3"
        >
          MONITORED BY
        </text>
        <text
          x="50"
          y="87.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="6.5"
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          COMPVD
        </text>

        {/* Bottom Emerald Chevron */}
        <path
          d="M 17 96 L 50 123.5 L 83 96 L 85.5 101 L 50 128 L 14.5 101 Z"
          fill="#0d7853"
        />
      </svg>
    </div>
  );
}

export function CMMCBadge({ className = "h-14 w-auto" }) {
  return (
    <div
      className="inline-block select-none cursor-default transition-all duration-200 ease-out hover:-translate-y-1.5 hover:drop-shadow-md"
      title="CMMC Level 2 Compliant — DoD Cybersecurity"
    >
      <svg
        viewBox="0 0 100 130"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="CMMC Level 2 Compliant Badge"
      >
        <title>CMMC Level 2 Compliant</title>
        {/* Shield Frame */}
        <path
          d="M 12 7 C 12 3.1 15.1 0 19 0 L 81 0 C 84.9 0 88 3.1 88 7 L 88 92 C 88 94.6 86.6 97 84.3 98.4 L 51.8 127 C 50.7 127.9 49.3 127.9 48.2 127 L 15.7 98.4 C 13.4 97 12 94.6 12 92 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Proper DoD Defense Eagle Shield & Stars */}
        <g transform="translate(50, 18)">
          <path
            d="M -9 -9.5 L 9 -9.5 L 9 0.5 C 9 6.5 0 11 0 11 C 0 11 -9 6.5 -9 0.5 Z"
            fill="#0f172a"
          />
          {/* Defense Stars */}
          <polygon points="-5,-6 -4.2,-4.5 -2.7,-4.5 -3.9,-3.6 -3.4,-2.2 -5,-3.1 -6.6,-2.2 -6.1,-3.6 -7.3,-4.5 -5.8,-4.5" fill="#ffffff" />
          <polygon points="0,-7.5 0.8,-6 2.3,-6 1.1,-5.1 1.6,-3.7 0,-4.6 -1.6,-3.7 -1.1,-5.1 -2.3,-6 -0.8,-6" fill="#ffffff" />
          <polygon points="5,-6 5.8,-4.5 7.3,-4.5 6.1,-3.6 6.6,-2.2 5,-3.1 3.4,-2.2 3.9,-3.6 2.7,-4.5 4.2,-4.5" fill="#ffffff" />
          {/* Eagle / Wings Chevron */}
          <path d="M -6.5 0 L 0 -3.5 L 6.5 0 L 0 5 Z" fill="#ffffff" />
          <path d="M -4.5 4 L 0 7.5 L 4.5 4" fill="none" stroke="#ffffff" strokeWidth="0.8" />
        </g>

        {/* Typography */}
        <text
          x="50"
          y="49"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="16"
          fontWeight="900"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          CMMC
        </text>

        {/* Green Ribbon Pill */}
        <rect x="8" y="57" width="84" height="15" rx="3.5" fill="#0d7853" />
        <text
          x="50"
          y="67.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="7.5"
          fontWeight="800"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="1"
        >
          LEVEL 2
        </text>

        {/* Subtext */}
        <text
          x="50"
          y="82"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="6.5"
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="1.2"
        >
          COMPLIANT
        </text>

        {/* Bottom Emerald Chevron */}
        <path
          d="M 17 96 L 50 123.5 L 83 96 L 85.5 101 L 50 128 L 14.5 101 Z"
          fill="#0d7853"
        />
      </svg>
    </div>
  );
}

export function TISAXBadge({ className = "h-14 w-auto" }) {
  return (
    <div
      className="inline-block select-none cursor-default transition-all duration-200 ease-out hover:-translate-y-1.5 hover:drop-shadow-md"
      title="TISAX Assessed — Automotive Information Security (ENX / VDA ISA)"
    >
      <svg
        viewBox="0 0 100 130"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TISAX Assessed Badge"
      >
        <title>TISAX Assessed</title>
        {/* Shield Frame */}
        <path
          d="M 12 7 C 12 3.1 15.1 0 19 0 L 81 0 C 84.9 0 88 3.1 88 7 L 88 92 C 88 94.6 86.6 97 84.3 98.4 L 51.8 127 C 50.7 127.9 49.3 127.9 48.2 127 L 15.7 98.4 C 13.4 97 12 94.6 12 92 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Proper ENX Automotive Information Security Emblem */}
        <g transform="translate(50, 18)">
          <path
            d="M -9.5 -5 L 0 -10.5 L 9.5 -5 L 9.5 5 L 0 10.5 L -9.5 5 Z"
            fill="#0f172a"
          />
          <circle cx="0" cy="0" r="5.5" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          <path
            d="M -4.5 -2 C -2 -5.5 4 -5.5 5 -1.5 C 5.5 2 -1 3.5 -3 4.5"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="1.6" fill="#ffffff" />
        </g>

        {/* Typography */}
        <text
          x="50"
          y="49"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="17"
          fontWeight="900"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          TISAX
        </text>

        {/* Green Ribbon Pill */}
        <rect x="8" y="57" width="84" height="15" rx="3.5" fill="#0d7853" />
        <text
          x="50"
          y="67.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="7.5"
          fontWeight="800"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="1"
        >
          ASSESSED
        </text>

        {/* Subtext */}
        <text
          x="50"
          y="79.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="5"
          fontWeight="700"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.4"
        >
          ENX / VDA ISA
        </text>
        <text
          x="50"
          y="87.5"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="6.5"
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          AL3 READY
        </text>

        {/* Bottom Emerald Chevron */}
        <path
          d="M 17 96 L 50 123.5 L 83 96 L 85.5 101 L 50 128 L 14.5 101 Z"
          fill="#0d7853"
        />
      </svg>
    </div>
  );
}

export default function ComplianceBadgesRow({ badgeHeight = "h-12 md:h-14", className = "" }) {
  return (
    <div className={`flex items-center gap-3 md:gap-4 flex-wrap ${className}`}>
      <ISO27001Badge className={`${badgeHeight} w-auto`} />
      <SOC2Badge className={`${badgeHeight} w-auto`} />
      <CMMCBadge className={`${badgeHeight} w-auto`} />
      <TISAXBadge className={`${badgeHeight} w-auto`} />
    </div>
  );
}
