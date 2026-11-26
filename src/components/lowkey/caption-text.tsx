import { Link } from "@tanstack/react-router";
import { useLowkey } from "@/lib/lowkey/store";

const TAG_RE = /(#[\p{L}\p{N}_-]{2,32})/gu;

/**
 * Renders a post caption with tappable #hashtags that open /app/tag/$tag.
 */
export function CaptionText({ text, className }: { text: string; className?: string }) {
  const { me } = useLowkey();
  if (!text) return null;
  const parts = text.split(TAG_RE);
  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith("#") && part.length > 2) {
          if (me?.hideHashtags) return null;
          const tag = part.slice(1).toLowerCase();
          return (
            <Link
              key={`${tag}-${idx}`}
              to="/app/tag/$tag"
              params={{ tag }}
              className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:opacity-80"
            >
              {part}
            </Link>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}