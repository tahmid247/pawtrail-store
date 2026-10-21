import type { Metadata } from "next";
import { Container } from "@/components/ui/misc";
import { TrackForm } from "@/components/store/track-form";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default function TrackPage() {
  return (
    <Container className="max-w-lg py-16">
      <h1 className="text-3xl font-extrabold">Track your order</h1>
      <p className="mt-3 text-muted">Enter your order number (e.g. WP-XXXXXXXX) and the email used at checkout.</p>
      <TrackForm />
    </Container>
  );
}
