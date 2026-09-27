import { avatarTone, iconPath, initialsOf, isMediaRef } from "@polyxd/core";
import { useSurface } from "../context.tsx";

/** A person or thing's face: an image when the host can resolve the reference, otherwise initials. */
export function Avatar({ value, name, size = 40 }: { value?: unknown; name: string; size?: number }) {
  const s = useSurface();
  const ref = typeof value === "string" ? value : "";
  const url = isMediaRef(ref) ? s.resolveMedia?.(ref) : undefined;
  const initials = initialsOf(ref, name);
  const tone = avatarTone(name);
  return url ? (
    <img className="pxd-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className={`pxd-avatar pxd-avatar-${tone}`} aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials}
    </span>
  );
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPath(name)} />
    </svg>
  );
}
