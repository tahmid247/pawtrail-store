import { Container } from "@/components/ui/misc";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-soft sm:p-10">{children}</div>
    </Container>
  );
}
