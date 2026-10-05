const FULL_LOGO_SRC = "/branding/compvd-logo.png";
const MARK_LOGO_SRC = "/branding/compvd-mark.png";

export default function BrandLogo({
  compact = false,
  className = "",
  alt = "Compvd.ai — Compliance Verified",
}) {
  return (
    <img
      src={compact ? MARK_LOGO_SRC : FULL_LOGO_SRC}
      alt={alt}
      className={`block object-contain ${className}`}
    />
  );
}
