/**
 * SynapseOS logo mark. Uses the shared brand asset (/logo.png — byte-identical
 * to apps/web's synapse-logo.png) so every Synapse surface shows one logo.
 * Pass Tailwind size classes via className (e.g. "h-9 w-9"); the image keeps
 * its rounded-square treatment and aspect ratio.
 */
export function SynapseMark({
  className = "h-10 w-10",
  alt = "SynapseOS",
}: {
  className?: string
  alt?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={alt}
      className={`rounded-[22%] object-contain ${className}`}
      draggable={false}
    />
  )
}

export default SynapseMark
