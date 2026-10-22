import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/account/forms";

export const metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold">Profile</h1>
      <ProfileForm name={user.name} email={user.email} phone={profile?.phone ?? ""} />
    </>
  );
}
