import { redirect } from "next/navigation";
import { verifyAction } from "../actions";

interface VerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <Layout title="Sign-in link missing">
        This link is missing its token. Request a new one from{" "}
        <a href="/app/sign-in" className="text-ink underline">
          /app/sign-in
        </a>
        .
      </Layout>
    );
  }

  const result = await verifyAction(token);
  if (!result.ok) {
    return (
      <Layout title="Sign-in link invalid">
        {result.error}. Request a new link from{" "}
        <a href="/app/sign-in" className="text-ink underline">
          /app/sign-in
        </a>
        .
      </Layout>
    );
  }

  redirect(result.destination);
}

function Layout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-md">
        <p className="eyebrow mb-4">Sign in</p>
        <h1 className="font-display text-3xl leading-tight text-ink">{title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          {children}
        </p>
      </div>
    </div>
  );
}
