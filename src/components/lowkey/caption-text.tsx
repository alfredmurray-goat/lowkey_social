import { Link } from "@tanstack/react-router";
import { Hash } from "lucide-react";
import { useLowkey } from "@/lib/lowkey/store";
import { extractTagsFromCaption } from "@/lib/lowkey/rank";

const TAG_RE = /(#[\p{L}\p{N}_-]{2,32})/gu;
const TOKEN_RE = /(#[\p{L}\p{N}_-]{2,32}|(?<=^|[\s([{"'])@[a-zA-Z0-9_.-]{2,30}\b)/gu;

/**
 * Renders text with tappable @mentions and #hashtags (and optional rounded yellow tag chips below).
 */
export function CaptionText({
  text,
  className,
  chips = false,
  linkHashtags = true,
}: {
  text: string;
  className?: string;
  chips?: boolean;
  linkHashtags?: boolean;
}) {
  const { me } = useLowkey();
  if (!text) return null;
  const tags = chips && linkHashtags && !me?.hideHashtags ? extractTagsFromCaption(text) : [];
  const cleanBody = chips ? text.replace(TAG_RE, "").replace(/\s{2,}/g, " ").trim() : null;

  const renderTokens = (value: string) =>
    value.split(TOKEN_RE).map((part, idx) => {
      if (part.startsWith("#") && part.length > 2) {
        if (!linkHashtags) return <span key={idx}>{part}</span>;
        if (me?.hideHashtags) return null;
        const tag = part.slice(1).toLowerCase();
        return (
          <Link
            key={`tag-${tag}-${idx}`}
            to="/app/tag/$tag"
            params={{ tag }}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:opacity-80"
          >
            {part}
          </Link>
        );
      }
      if (part.startsWith("@") && part.length > 2) {
        const handle = part.slice(1).toLowerCase();
        const isMe = me?.handle.toLowerCase() === handle;
        return (
          <Link
            key={`mention-${handle}-${idx}`}
            {...(isMe
              ? { to: "/app/profile" as const }
              : { to: "/app/u/$handle" as const, params: { handle } })}
            onClick={(e) => e.stopPropagation()}
            className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:opacity-80"
          >
            {part}
          </Link>
        );
      }
      return <span key={idx}>{part}</span>;
    });

  return (
    <span className={className}>
      {chips ? (
        <>
          {cleanBody && <span>{renderTokens(cleanBody)}</span>}
          {tags.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  to="/app/tag/$tag"
                  params={{ tag }}
                  onClick={(e) => e.stopPropagation()}
                  className="lowkey inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-foreground transition-transform active:scale-95"
                >
                  <Hash className="size-3 text-primary" strokeWidth={2.5} />
                  {tag}
                </Link>
              ))}
            </span>
          )}
        </>
      ) : (
        renderTokens(text)
      )}
    </span>
  );
}