import Link from "next/link";
import { getSettings } from "@/lib/settings";

export async function AnnouncementBar() {
  const { announcement } = await getSettings();
  if (!announcement.enabled || !announcement.text) return null;
  const inner = <span className="truncate">{announcement.text}</span>;
  return (
    <div className="bg-gradient-to-r from-primary-deep via-primary to-primary-deep text-white">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-4 text-center text-xs font-semibold tracking-wide sm:text-[0.8rem]">
        {announcement.link ? (
          <Link href={announcement.link} className="truncate hover:underline">{inner}</Link>
        ) : inner}
      </div>
    </div>
  );
}
