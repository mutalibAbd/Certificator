import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const features = [
  "Upload PDF templates",
  "Design certificate layouts with drag-and-drop",
  "Generate certificates in bulk from CSV data",
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <main className="w-full max-w-md rounded-lg border border-border bg-canvas-bg p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Certificator
        </h1>
        <p className="mt-2 text-foreground-muted">
          Create beautiful certificates from PDF templates
        </p>

        <ul className="mt-6 space-y-2 text-sm text-foreground-muted">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-0.5 text-primary" aria-hidden="true">
                &bull;
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href="/signup"
          className="mt-8 flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Get Started
        </Link>

        <p className="mt-4 text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
